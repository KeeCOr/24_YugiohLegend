import { describe, it, expect } from 'vitest';
import { randomAction, greedyAction } from '../src/AIEngine';
import type { Card, PlayerState, LaneState } from '../../shared/types';

function monster(id: string, atk: number): Card {
  return { id, type: 'monster', name: id, atk };
}
function emptyLane(): LaneState {
  return { monster: null, trap: null, tempAtkBoost: 0 };
}
function player(hand: Card[]): PlayerState {
  return { index: 0, lp: 4000, hand, deck: [], lanes: [emptyLane(), emptyLane(), emptyLane()] };
}

describe('randomAction', () => {
  it('핸드에 몬스터 있으면 소환 포함 가능', () => {
    const p = player([monster('a', 1000), monster('b', 1500)]);
    const action = randomAction(p);
    // 소환 없을 수도 있음 (랜덤), 하지만 항상 유효한 TurnAction이어야 함
    expect(action.spells).toBeDefined();
    expect(action.traps).toBeDefined();
    if (action.summon) {
      expect([0, 1, 2]).toContain(action.summon.laneIndex);
    }
  });

  it('핸드가 비어있으면 아무 액션도 없음', () => {
    const p = player([]);
    const action = randomAction(p);
    expect(action.summon).toBeUndefined();
    expect(action.spells).toHaveLength(0);
    expect(action.traps).toHaveLength(0);
  });

  it('이미 몬스터가 있는 레인에는 소환하지 않음', () => {
    const fullPlayer: PlayerState = {
      index: 0, lp: 4000, deck: [],
      hand: [monster('new', 1000)],
      lanes: [
        { monster: monster('a', 500), trap: null, tempAtkBoost: 0 },
        { monster: monster('b', 500), trap: null, tempAtkBoost: 0 },
        { monster: monster('c', 500), trap: null, tempAtkBoost: 0 },
      ],
    };
    const action = randomAction(fullPlayer);
    expect(action.summon).toBeUndefined(); // 빈 레인 없음
  });
});

describe('greedyAction', () => {
  it('몬스터 중 ATK 가장 높은 것을 소환', () => {
    const p = player([monster('weak', 500), monster('strong', 2000), monster('mid', 1000)]);
    const action = greedyAction(p);
    expect(action.summon?.card.id).toBe('strong');
  });

  it('마법 카드는 모두 사용', () => {
    const spell: Card = { id: 'heal', type: 'spell', name: '치유', effect: 'heal_1000' };
    const p = player([spell, monster('m', 1000)]);
    const action = greedyAction(p);
    expect(action.spells).toHaveLength(1);
    expect(action.spells[0].id).toBe('heal');
  });

  it('함정 카드는 첫 번째 빈 레인에 세트', () => {
    const trap: Card = { id: 'ct', type: 'trap', name: '함정', trapCondition: 'on_attacked', trapEffect: 'negate_attack' };
    const p = player([trap]);
    const action = greedyAction(p);
    expect(action.traps).toHaveLength(1);
    expect(action.traps[0].laneIndex).toBe(0);
  });
});
