import type { ClientMessage, ServerMessage } from '../data/CardTypes';

type MessageHandler = (msg: ServerMessage) => void;

export class SocketManager {
  private ws: WebSocket | null = null;
  private handlers: MessageHandler[] = [];
  private url: string;

  constructor(url: string = `ws://localhost:8080`) {
    this.url = url;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(e);
      this.ws.onmessage = (e) => {
        try {
          const msg: ServerMessage = JSON.parse(e.data);
          for (const h of this.handlers) h(msg);
        } catch { /* ignore malformed */ }
      };
    });
  }

  send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  on(handler: MessageHandler): () => void {
    this.handlers.push(handler);
    return () => { this.handlers = this.handlers.filter(h => h !== handler); };
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
  }
}
