import { WebSocketServer } from 'ws';
import { RoomManager } from './RoomManager';

const PORT = Number(process.env.PORT ?? 8080);
const wss = new WebSocketServer({ port: PORT });
const manager = new RoomManager();

wss.on('connection', (ws) => {
  console.log('[server] client connected');
  manager.handleConnection(ws);
});

console.log(`[server] WebSocket server running on ws://localhost:${PORT}`);
