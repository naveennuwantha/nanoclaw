import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';

// Manual .env loading for the simple proxy
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join('=').trim().replace(/^"(.*)"$/, '$1');
    }
  });
}

const PORT = 4000;
const OLLAMA_HOST = 'ollama.com';

const server = http.createServer((req, res) => {
  const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY;
  console.log(`[Proxy] Request: ${req.method} ${req.url}`);
  if (req.method === 'POST' && (req.url.startsWith('/v1/messages') || req.url.startsWith('/messages'))) {
    let body = '';
    req.on('data', chunk => {
      console.log(`[Proxy] Received chunk: ${chunk.length} bytes`);
      body += chunk;
    });
    req.on('end', async () => {
      console.log(`[Proxy] Body fully received. Total length: ${body.length}`);
      try {
        const anthropicReq = JSON.parse(body);
        console.log(`[Proxy] Received message request for model: ${anthropicReq.model}`);

        // Map Anthropic request to Ollama (OpenAI-compatible) request
        const ollamaReq = {
          model: 'gemma4:31b', // Always use the correct model name discovered
          messages: anthropicReq.messages.map(m => ({
            role: m.role,
            content: typeof m.content === 'string' ? m.content : m.content[0].text
          })),
          stream: anthropicReq.stream || false
        };

        const postData = JSON.stringify(ollamaReq);
        const options = {
          hostname: OLLAMA_HOST,
          path: '/v1/chat/completions',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OLLAMA_API_KEY}`,
            'Content-Length': Buffer.byteLength(postData)
          }
        };

        const proxyReq = https.request(options, (proxyRes) => {
          console.log(`[Proxy] Upstream Status: ${proxyRes.statusCode}`);
          res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' });

          if (ollamaReq.stream) {
            // TODO: Basic streaming support if needed
            proxyRes.pipe(res);
          } else {
            let responseBody = '';
            proxyRes.on('data', chunk => responseBody += chunk);
            proxyRes.on('end', () => {
              console.log(`[Proxy] Upstream Body: ${responseBody.slice(0, 500)}`);
              try {
                const ollamaRes = JSON.parse(responseBody);
                // Map Ollama (OpenAI) response back to Anthropic
                const anthropicRes = {
                  id: ollamaRes.id,
                  type: 'message',
                  role: 'assistant',
                  content: [{ type: 'text', text: ollamaRes.choices[0].message.content }],
                  model: ollamaRes.model,
                  stop_reason: 'end_turn',
                  usage: {
                    input_tokens: ollamaRes.usage?.prompt_tokens || 0,
                    output_tokens: ollamaRes.usage?.completion_tokens || 0
                  }
                };
                res.end(JSON.stringify(anthropicRes));
              } catch (e) {
                console.error('[Proxy] Error parsing Ollama response:', e);
                res.end(JSON.stringify({ error: 'Failed to parse upstream response' }));
              }
            });
          }
        });

        proxyReq.on('error', (e) => {
          console.error('[Proxy] Upstream error:', e);
          res.writeHead(500);
          res.end(JSON.stringify({ error: e.message }));
        });

        proxyReq.write(postData);
        proxyReq.end();

      } catch (e) {
        console.error('[Proxy] Request error:', e);
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid Anthropic request' }));
      }
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(PORT, () => {
  console.log(`[Proxy] Anthropic-to-Ollama bridge running on http://localhost:${PORT}`);
});
