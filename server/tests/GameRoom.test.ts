import { describe, it, expect } from 'vitest';
import { GameRoom } from '../src/GameRoom';
import type { Card, TurnAction } from '../../shared/types';
import cards from '../../shared/cards.json';

const allCards = cards as Card[];

function makeDeck(): Card[] {
  // 10장짜리 유효한 덱 (각 카드 최대 2장)
  return allCards.slice(0, 8).concat(allCards.slice(0, 2));
}

function emptyAction(): TurnAction {
  return { spells: [], traps: [] };
}

describe('GameRoom', () => {
  it('두 플레이어 참가 시 game_start 메시지 발송, 핸드 4장', () => {
    const room = new GameRoom('room1');
    const msgs0 = room.addPlayer('p0', makeDeck());
    const msgs1 = room.addPlayer('p1', makeDeck());
    const start0 = msgs0.find(m => m.playerIndex === 0 && m.message.type === 'game_start');
    const start1 = msgs1.find(m => m.playerIndex === 1 && m.message.type === 'game_start');
    expect(start0).toBeDefined();
    expect(start1).toBeDefined();
    if (start0?.message.type === 'game_start') {
      expect(start0.message.yourHand).toHaveLength(4);
    }
  });

  it('첫 번째 플레이어만 참가하면 game_start 없음', () => {
    const room = new GameRoom('room1');
    const msgs = room.addPlayer('p0', makeDeck());
    expect(msgs.find(m => m.message.type === 'game_start')).toBeUndefined();
  });

  it('양쪽 submit_action 제출 시 reveal + battle_result 발송', () => {
    const room = new GameRoom('room1');
    room.addPlayer('p0', makeDeck());
    room.addPlayer('p1', makeDeck());
    room.submitAction(0, emptyAction());
    const msgs = room.submitAction(1, emptyAction());
    expect(msgs.some(m => m.message.type === 'reveal')).toBe(true);
    expect(msgs.some(m => m.message.type === 'battle_result')).toBe(true);
  });

  it('한쪽만 제출하면 reveal 없음', () => {
    const room = new GameRoom('room1');
    room.addPlayer('p0', makeDeck());
    room.addPlayer('p1', makeDeck());
    const msgs = room.submitAction(0, emptyAction());
    expect(msgs.some(m => m.message.type === 'reveal')).toBe(false);
  });

  it('3턴 + 파이널 배틀 후 game_over 발송', () => {
    const room = new GameRoom('room1');
    room.addPlayer('p0', makeDeck());
    room.addPlayer('p1', makeDeck());
    // turn 1
    room.submitAction(0, emptyAction());
    room.submitAction(1, emptyAction());
    // turn 2
    room.submitAction(0, emptyAction());
    room.submitAction(1, emptyAction());
    // turn 3
    room.submitAction(0, emptyAction());
    const msgs = room.submitAction(1, emptyAction());
    // turn 3 종료 시 파이널 배틀 자동 실행 → game_over
    const gameOver = msgs.find(m => m.message.type === 'game_over');
    expect(gameOver).toBeDefined();
  });

  it('덱 크기 8~12장 밖이면 에러', () => {
    const room = new GameRoom('room1');
    const msgs = room.addPlayer('p0', allCards.slice(0, 5)); // 5장 → 에러
    expect(msgs.some(m => m.message.type === 'error')).toBe(true);
  });

  it('소환 액션 적용 후 필드에 몬스터 존재', () => {
    const room = new GameRoom('room1');
    room.addPlayer('p0', makeDeck());
    room.addPlayer('p1', makeDeck());
    const monsterCard = allCards.find(c => c.type === 'monster')!;
    const action: TurnAction = { summon: { card: monsterCard, laneIndex: 0 }, spells: [], traps: [] };
    room.submitAction(0, action);
    room.submitAction(1, emptyAction());
    expect(room.getState().players[0].lanes[0].monster?.id).toBe(monsterCard.id);
  });
});
