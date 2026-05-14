import { describe, it, expect } from 'vitest';
import { GameRoom } from '../src/GameRoom';
import type { Card, GameState, TurnAction } from '../../shared/types';
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
    room.addPlayer('p0', makeDeck()); // 첫 플레이어 → 빈 배열 반환
    const msgs = room.addPlayer('p1', makeDeck()); // 두 번째 플레이어 → [p0_start, p1_start] 반환
    const start0 = msgs.find(m => m.playerIndex === 0 && m.message.type === 'game_start');
    const start1 = msgs.find(m => m.playerIndex === 1 && m.message.type === 'game_start');
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

  it('heal_1000 스펠 사용 시 LP 1000 증가', () => {
    const room = new GameRoom('room1');
    room.addPlayer('p0', makeDeck());
    room.addPlayer('p1', makeDeck());

    const healCard = allCards.find(c => c.id === 'healing_light')!;
    // p0의 핸드에 heal 카드를 직접 추가
    (room.getState() as GameState).players[0].hand.push(healCard);

    const action: TurnAction = { spells: [healCard], traps: [] };
    room.submitAction(0, action);
    room.submitAction(1, emptyAction());

    // heal_1000 적용 후 LP는 4000 + 1000 = 5000
    expect(room.getState().players[0].lp).toBe(5000);
  });

  it('monster_smash 스펠 사용 시 상대 최강 몬스터 파괴', () => {
    const room = new GameRoom('room1');
    room.addPlayer('p0', makeDeck());
    room.addPlayer('p1', makeDeck());

    const smashCard = allCards.find(c => c.id === 'monster_smash')!;
    const strongMonster = allCards.find(c => c.id === 'hero_warrior')!; // ATK 2500
    const weakMonster = allCards.find(c => c.id === 'goblin_warrior')!; // ATK 1000

    // p1 필드에 몬스터 두 개 배치
    (room.getState() as GameState).players[1].lanes[0].monster = strongMonster;
    (room.getState() as GameState).players[1].lanes[1].monster = weakMonster;
    (room.getState() as GameState).players[0].hand.push(smashCard);

    const action: TurnAction = { spells: [smashCard], traps: [] };
    room.submitAction(0, action);
    room.submitAction(1, emptyAction());

    // 가장 강한 몬스터(2500)가 파괴됨
    expect(room.getState().players[1].lanes[0].monster).toBeNull();
    // 약한 몬스터는 살아있음 (단 전투에서 파괴될 수 있으니 전투 전 확인은 어려움)
    // 단순히 strong이 null인지만 확인
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
