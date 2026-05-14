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
      // 대기 중인 멀티플레이어가 연결 해제되면 대기실 정리
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
    }
  }

  private joinRoom(ws: WebSocket, mode: 'single' | 'multi', deck: Card[]): void {
    if (mode === 'single') {
      const roomId = `single_${Date.now()}`;
      const room = new GameRoom(roomId);
      this.rooms.set(roomId, room);

      const conn: PlayerConnection = { ws, roomId, playerIndex: 0 };
      this.connections.set(ws, conn);

      // 두 플레이어 참가 → game_start 메시지 포함된 msgs 반환
      room.addPlayer('human', deck);         // p0 단독 → []
      const msgs = room.addPlayer('ai', [...deck]); // p1 → [p0_start, p1_start]
      this.broadcast(roomId, msgs);

      this.scheduleAIAction(room, roomId);
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

  private scheduleAIAction(room: GameRoom, roomId: string): void {
    const flag = { cancelled: false };
    this.aiCancelFlags.set(roomId, flag);

    const tryAISubmit = () => {
      if (flag.cancelled) return;
      const state = room.getState();
      if (state.phase !== 'action') return;
      if (state.submitted[1]) return;

      const delay = 500 + Math.random() * 1000;
      setTimeout(() => {
        if (flag.cancelled) return;
        // 딜레이 직전이 아닌 직후에 최신 상태로 행동 결정
        const latestState = room.getState();
        if (latestState.phase !== 'action' || latestState.submitted[1]) return;
        const action = greedyAction(latestState.players[1]);
        const outMsgs = room.submitAction(1, action);
        this.broadcast(roomId, outMsgs);
        if (room.getState().phase === 'action') {
          tryAISubmit();
        }
      }, delay);
    };

    setTimeout(tryAISubmit, 100);
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

    // game_over 메시지가 포함된 경우 방 정리
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
