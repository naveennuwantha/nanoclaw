# NanoClaw VPS Deployment Guide

This guide documents the setup of NanoClaw on an Ubuntu 22.04 VPS for 24/7 operation.

## 1. Architecture Overview
- **Core Server**: Node.js application running in `tmux`.
- **Agent Environment**: Docker (Isolated environment for tool execution).
- **Proxy Bridge**: `scripts/ollama-proxy.js` translates Anthropic SDK calls into Ollama-compatible requests.
- **Port**: `4999` (Used for internal communication between Docker and Proxy).

## 2. Setting Up the Proxy
The proxy bridge allows us to use **Gemma/Ollama** models while pretending to be Claude 3.5 Sonnet to satisfy the assistant's validation.

```bash
# Start the proxy in the background
node scripts/ollama-proxy.js > proxy.log 2>&1 &
```

## 3. Environment Configuration (`.env`)
The `.env` and `data/env/env` files must point to the Docker Host IP.
- **Docker Bridge IP**: `10.0.0.1` (Specific to this VPS setup).
- **Base URL**: `http://10.0.0.1:4999`
- **Model Override**: `CLAUDE_CODE_MODEL="claude-3-5-sonnet-20241022"`

## 4. WhatsApp Authentication
To link a new phone:
1. Run `npm run setup:whatsapp`.
2. Choose **Pairing Code**.
3. Enter the code in WhatsApp > Linked Devices > Link a Device.

## 5. Maintenance Commands
| Task | Command |
| :--- | :--- |
| **Start NanoClaw** | `tmux new-session -d -s nanoclaw "npm run dev"` |
| **View Logs** | `tmux attach -t nanoclaw` |
| **Restart Proxy** | `fuser -k 4999/tcp && node scripts/ollama-proxy.js > proxy.log 2>&1 &` |
| **Kill Everything** | `tmux kill-server && fuser -k 4999/tcp` |

## 6. Troubleshooting "Model Not Found"
If you see a model error:
1. Ensure the Proxy is running (`ps aux | grep ollama-proxy`).
2. Verify `cat proxy.log` shows the initialization.
3. Check the firewall: `ufw allow 4999/tcp`.
4. Rebuild the agent image if code changes were made: `cd container && docker build -t nanoclaw-agent .`
