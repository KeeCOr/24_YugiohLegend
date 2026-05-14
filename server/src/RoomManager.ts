import { GameRoom } from './GameRoom';
import { greedyAction } from './AIEngine';
import type { Card, ClientMessage, PlayerIndex } from '../../shared/types';
import type WebSocket from 'ws';

interface PlayerConnection {
  ws: WebSocket;
  roomId: string;
  playerIndex: PlayerIndex;
}

export class RoomManager {
  private rooms = new Map<string, GameRoom>();
  private connections = new Map<WebSocket, PlayerConnection>();
  private waitingRoom: { roomId: string; ws: WebSocket } | null = null;

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
      this.broadcast(room.id, outMsgs);
    }
  }

  private joinRoom(ws: WebSocket, mode: 'single' | 'multi', deck: Card[]): void {
    if (mode === 'single') {
      const roomId = `single_${Date.now()}`;
      const room = new GameRoom(roomId);
      this.rooms.set(roomId, room);

      // 플레이어 참가
      const conn: PlayerConnection = { ws, roomId, playerIndex: 0 };
      this.connections.set(ws, conn);
      const msgs1 = room.addPlayer('human', deck);
      this.broadcast(roomId, msgs1);

      // AI 참가 (AI도 동일 덱 사용)
      const aiDeck = [...deck];
      const msgs2 = room.addPlayer('ai', aiDeck);
      this.broadcast(roomId, msgs2);

      // AI 자동 행동 설정
      this.scheduleAIAction(room, roomId);
    } else {
      // 멀티 — 대기실 매칭
      if (this.waitingRoom) {
        const { roomId, ws: opponentWs } = this.waitingRoom;
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
        this.send(ws, { type: 'error', message: '상대방을 기다리는 중...' });
      }
    }
  }

  private scheduleAIAction(room: GameRoom, roomId: string): void {
    const tryAISubmit = () => {
      const state = room.getState();
      if (state.phase !== 'action') return;
      if (state.submitted[1]) return;

      const aiPlayer = state.players[1];
      const action = greedyAction(aiPlayer);

      // AI 딜레이 (500~1500ms)
      const delay = 500 + Math.random() * 1000;
      setTimeout(() => {
        const outMsgs = room.submitAction(1, action);
        this.broadcast(roomId, outMsgs);
        // 다음 턴에도 반복
        if (room.getState().phase === 'action') {
          tryAISubmit();
        }
      }, delay);
    };

    setTimeout(tryAISubmit, 100);
  }

  broadcast(roomId: string, msgs: import('./GameRoom').OutgoingMessage[]): void {
    for (const { playerIndex, message } of msgs) {
      if (playerIndex === 'both') {
        for (const [ws, conn] of this.connections) {
          if (conn.roomId === roomId) this.send(ws, message);
        }
      } else {
        const ws = [...this.connections.entries()].find(
          ([, c]) => c.roomId === roomId && c.playerIndex === playerIndex
        )?.[0];
        if (ws) this.send(ws, message);
      }
    }
  }

  private send(ws: WebSocket, msg: import('../../shared/types').ServerMessage): void {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }
}
