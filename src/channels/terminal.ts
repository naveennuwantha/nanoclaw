import { Channel, NewMessage } from '../types.js';
import { ChannelOpts, registerChannel } from './registry.js';
import readline from 'readline';
import { logger } from '../logger.js';

export class TerminalChannel implements Channel {
  name = 'terminal';
  private rl: readline.Interface | null = null;
  private connected = false;

  constructor(private opts: ChannelOpts) {}

  async connect(): Promise<void> {
    this.connected = true;

    // Register the 'main' chat in the database to satisfy FOREIGN KEY constraints
    this.opts.onChatMetadata(
      'main',
      new Date().toISOString(),
      'Main Console',
      'terminal',
      false,
    );

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    });

    this.rl.on('line', (line) => {
      const text = line.trim();
      if (!text) return;

      const msg: NewMessage = {
        id: `msg-${Date.now()}`,
        chat_jid: 'main',
        sender: 'user',
        sender_name: 'User',
        content: text,
        timestamp: new Date().toISOString(),
        is_from_me: false,
        is_bot_message: false,
      };

      this.opts.onMessage('main', msg);
    });

    console.log('\n>>> Terminal channel connected. Type your messages below. <<<');
    console.log('>>> Trigger word: @Andy (or just type if it is the main group) <<<\n');
  }

  async sendMessage(jid: string, text: string): Promise<void> {
    console.log(`\n[Andy]: ${text}\n`);
  }

  isConnected(): boolean {
    return this.connected;
  }

  ownsJid(jid: string): boolean {
    return jid === 'main';
  }

  async disconnect(): Promise<void> {
    this.rl?.close();
    this.connected = false;
  }
}

registerChannel('terminal', (opts) => new TerminalChannel(opts));
