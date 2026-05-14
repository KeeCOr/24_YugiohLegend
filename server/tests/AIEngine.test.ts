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
  it('핸드에 몬스터 있고 빈 레인이면 항상 소환', () => {
    const p = player([monster('a', 1000), monster('b', 1500)]);
    const action = randomAction(p);
    expect(action.summon).toBeDefined();
    expect([0, 1, 2]).toContain(action.summon!.laneIndex);
    expect(action.spells).toBeDefined();
    expect(action.traps).toBeDefined();
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

  it('randomAction: 소환 레인과 함정 레인이 겹치지 않음', () => {
    const trap: Card = { id: 'ct', type: 'trap', name: '함정', trapCondition: 'on_attacked', trapEffect: 'negate_attack' };
    // 레인 0만 비어있는 상태에서 몬스터+함정 모두 핸드에 있으면
    const p: PlayerState = {
      index: 0, lp: 4000, deck: [],
      hand: [monster('m', 1000), trap],
      lanes: [
        { monster: null, trap: null, tempAtkBoost: 0 },     // 빈 레인
        { monster: monster('x', 500), trap: null, tempAtkBoost: 0 }, // 점유
        { monster: monster('y', 500), trap: null, tempAtkBoost: 0 }, // 점유
      ],
    };
    const action = randomAction(p);
    // 유일한 빈 레인(0)에 소환 → 함정 세트 불가
    expect(action.summon?.laneIndex).toBe(0);
    expect(action.traps).toHaveLength(0);
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

  it('greedyAction: 소환 레인과 함정 레인이 겹치지 않음', () => {
    const trap: Card = { id: 'ct', type: 'trap', name: '함정', trapCondition: 'on_attacked', trapEffect: 'negate_attack' };
    const p: PlayerState = {
      index: 0, lp: 4000, deck: [],
      hand: [monster('m', 1000), trap],
      lanes: [
        { monster: null, trap: null, tempAtkBoost: 0 },
        { monster: monster('x', 500), trap: null, tempAtkBoost: 0 },
        { monster: monster('y', 500), trap: null, tempAtkBoost: 0 },
      ],
    };
    const action = greedyAction(p);
    expect(action.summon?.laneIndex).toBe(0);
    expect(action.traps).toHaveLength(0);
  });
});
