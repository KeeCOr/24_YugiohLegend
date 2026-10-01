import { GameRoom } from './GameRoom';
import { greedyAction } from './AIEngine';
import type { Card, ClientMessage, PlayerIndex, ServerMessage } from '../../shared/types';
import type WebSocket from 'ws';
import type { OutgoingMessage } from './GameRoom';

interface PlayerConnection {
  ws: WebSocket;
  roomId: string;
  playerIndex: PlayerIndex;
}

export class RoomManager {
  private rooms = new Map<string, GameRoom>();
  private connections = new Map<WebSocket, PlayerConnection>();
  private waitingRoom: { roomId: string; ws: WebSocket } | null = null;
  private aiCancelFlags = new Map<string, { cancelled: boolean }>();

  handleConnection(ws: WebSocket): void {
    ws.on('message', (raw) => {
      try {
        const msg: ClientMessage = JSON.parse(raw.toString());
        this.handleMessage(ws, msg);
      } catch {
        this.send(ws, { type: 'error', message: '잘못된 메시지 형식' });
      }
    });

    ws.on('close', () => {
      this.connections.delete(ws);
      if (this.waitingRoom?.ws === ws) {
        this.rooms.delete(this.waitingRoom.roomId);
        this.waitingRoom = null;
      }
    });
  }

  private handleMessage(ws: WebSocket, msg: ClientMessage): void {
    if (msg.type === 'join_room') {
      this.joinRoom(ws, msg.mode, msg.deck);
    } else if (msg.type === 'submit_action') {
      const conn = this.connections.get(ws);
      if (!conn) return;
      const room = this.rooms.get(conn.roomId);
      if (!room) return;
      const outMsgs = room.submitAction(conn.playerIndex, msg.action);
      this.broadcast(conn.roomId, outMsgs);
      // human 제출로 새 턴이 시작됐고 AI 방이면 다음 턴 AI 액션 트리거
      const newTurnStarted = outMsgs.some(m => m.message.type === 'turn_start');
      if (newTurnStarted && this.aiCancelFlags.has(conn.roomId)) {
        this.triggerAIAction(room, conn.roomId);
      }
    } else if (msg.type === 'forfeit') {
      const conn = this.connections.get(ws);
      if (!conn) return;
      const room = this.rooms.get(conn.roomId);
      if (!room) return;
      const outMsgs = room.forfeit(conn.playerIndex);
      this.broadcast(conn.roomId, outMsgs);
    }
  }

  private joinRoom(ws: WebSocket, mode: 'single' | 'multi', deck: Card[]): void {
    if (mode === 'single') {
      const roomId = `single_${Date.now()}`;
      const room = new GameRoom(roomId);
      this.rooms.set(roomId, room);

      const conn: PlayerConnection = { ws, roomId, playerIndex: 0 };
      this.connections.set(ws, conn);

      room.addPlayer('human', deck);
      const msgs = room.addPlayer('ai', [...deck]);
      this.broadcast(roomId, msgs);

      this.initAI(room, roomId);
    } else {
      if (this.waitingRoom) {
        const { roomId } = this.waitingRoom;
        this.waitingRoom = null;
        const room = this.rooms.get(roomId)!;

        const conn: PlayerConnection = { ws, roomId, playerIndex: 1 };
        this.connections.set(ws, conn);
        const msgs = room.addPlayer('p1', deck);
        this.broadcast(roomId, msgs);
      } else {
        const roomId = `multi_${Date.now()}`;
        const room = new GameRoom(roomId);
        this.rooms.set(roomId, room);
        const conn: PlayerConnection = { ws, roomId, playerIndex: 0 };
        this.connections.set(ws, conn);
        room.addPlayer('p0', deck);
        this.waitingRoom = { roomId, ws };
        this.send(ws, { type: 'waiting', message: '상대방을 기다리는 중...' });
      }
    }
  }

  private initAI(room: GameRoom, roomId: string): void {
    const flag = { cancelled: false };
    this.aiCancelFlags.set(roomId, flag);
    this.triggerAIAction(room, roomId);
  }

  private triggerAIAction(room: GameRoom, roomId: string): void {
    const flag = this.aiCancelFlags.get(roomId);
    if (!flag) return;

    const delay = 500 + Math.random() * 1000;
    setTimeout(() => {
      if (flag.cancelled) return;
      const state = room.getState();
      if (state.phase !== 'action' || state.submitted[1]) return;
      const action = greedyAction(state.players[1], state.turn);
      const outMsgs = room.submitAction(1, action);
      this.broadcast(roomId, outMsgs);
      // AI 제출로 새 턴이 시작됐으면 다음 턴 AI 액션 트리거
      const newTurnStarted = outMsgs.some(m => m.message.type === 'turn_start');
      if (newTurnStarted) {
        this.triggerAIAction(room, roomId);
      }
    }, delay);
  }

  broadcast(roomId: string, msgs: OutgoingMessage[]): void {
    for (const { playerIndex, message } of msgs) {
      if (playerIndex === 'both') {
        for (const [ws, conn] of this.connections) {
          if (conn.roomId === roomId) this.send(ws, message);
        }
      } else {
        const entry = [...this.connections.entries()].find(
          ([, c]) => c.roomId === roomId && c.playerIndex === playerIndex
        );
        if (entry) this.send(entry[0], message);
      }
    }

    if (msgs.some(m => m.message.type === 'game_over')) {
      this.cleanupRoom(roomId);
    }
  }

  private cleanupRoom(roomId: string): void {
    this.rooms.delete(roomId);
    for (const [ws, conn] of this.connections) {
      if (conn.roomId === roomId) this.connections.delete(ws);
    }
    const flag = this.aiCancelFlags.get(roomId);
    if (flag) {
      flag.cancelled = true;
      this.aiCancelFlags.delete(roomId);
    }
  }

  private send(ws: WebSocket, msg: ServerMessage): void {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }
}
