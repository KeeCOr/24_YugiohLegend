import { describe, it, expect } from 'vitest';
import { resolveBattle } from '../src/BattleResolver';
import type { Card, LaneState, PlayerState } from '../../shared/types';

function monster(id: string, atk: number): Card {
  return { id, type: 'monster', name: id, atk };
}
function lane(mon: Card | null = null, trap: Card | null = null): LaneState {
  return { monster: mon, trap, tempAtkBoost: 0 };
}
function player(index: 0 | 1, lp: number, l0: LaneState, l1: LaneState, l2: LaneState): PlayerState {
  return { index, lp, hand: [], deck: [], lanes: [l0, l1, l2] };
}

describe('resolveBattle', () => {
  it('양쪽 레인이 모두 비어있으면 LP 변화 없음', () => {
    const p0 = player(0, 4000, lane(), lane(), lane());
    const p1 = player(1, 4000, lane(), lane(), lane());
    const result = resolveBattle(p0, p1);
    expect(result.p0LpDelta).toBe(0);
    expect(result.p1LpDelta).toBe(0);
  });

  it('p0 몬스터가 빈 레인 공격 → p1 다이렉트 데미지', () => {
    const p0 = player(0, 4000, lane(monster('m', 1500)), lane(), lane());
    const p1 = player(1, 4000, lane(), lane(), lane());
    const result = resolveBattle(p0, p1);
    expect(result.p1LpDelta).toBe(-1500);
    expect(result.p0LpDelta).toBe(0);
    expect(result.events[0].type).toBe('direct_attack');
    expect(result.events[0].attackerIndex).toBe(0);
  });

  it('p1 몬스터가 빈 레인 공격 → p0 다이렉트 데미지', () => {
    const p0 = player(0, 4000, lane(), lane(), lane());
    const p1 = player(1, 4000, lane(monster('m', 1000)), lane(), lane());
    const result = resolveBattle(p0, p1);
    expect(result.p0LpDelta).toBe(-1000);
    expect(result.p1LpDelta).toBe(0);
  });

  it('p0 몬스터 ATK > p1 몬스터 ATK → p1 몬스터 파괴, 차이만큼 LP 감소', () => {
    const p0 = player(0, 4000, lane(monster('a', 2000)), lane(), lane());
    const p1 = player(1, 4000, lane(monster('b', 1500)), lane(), lane());
    const result = resolveBattle(p0, p1);
    expect(result.p1LpDelta).toBe(-500);
    expect(result.p0LpDelta).toBe(0);
    expect(result.events[0].destroyedCards).toEqual([{ playerIndex: 1, card: monster('b', 1500) }]);
  });

  it('ATK 동일 → 양쪽 파괴, LP 변화 없음', () => {
    const p0 = player(0, 4000, lane(monster('a', 1000)), lane(), lane());
    const p1 = player(1, 4000, lane(monster('b', 1000)), lane(), lane());
    const result = resolveBattle(p0, p1);
    expect(result.p0LpDelta).toBe(0);
    expect(result.p1LpDelta).toBe(0);
    expect(result.events[0].destroyedCards).toHaveLength(2);
  });

  it('tempAtkBoost가 ATK에 반영됨', () => {
    const boostedLane: LaneState = { monster: monster('a', 1000), trap: null, tempAtkBoost: 500 };
    const p0 = player(0, 4000, boostedLane, lane(), lane());
    const p1 = player(1, 4000, lane(monster('b', 1200)), lane(), lane());
    // p0 effective ATK = 1500 > 1200 → p1 monster destroyed, p1 lp -300
    const result = resolveBattle(p0, p1);
    expect(result.p1LpDelta).toBe(-300);
  });

  it('on_attacked negate_attack 트랩 → 공격 무효화, LP 변화 없음', () => {
    const trapCard: Card = { id: 'counter_trap', type: 'trap', name: '반격', trapCondition: 'on_attacked', trapEffect: 'negate_attack' };
    const p0 = player(0, 4000, lane(monster('a', 1500)), lane(), lane());
    const p1 = player(1, 4000, lane(monster('b', 1000), trapCard), lane(), lane());
    // p1 lane has trap: p0's attack on p1 is negated; p1's attack on p0 still resolves
    const result = resolveBattle(p0, p1);
    // p0 attack negated → no damage to p1
    // p1 monster (1000) attacks p0 monster (1500) → p1 monster destroyed, p0 lp -0 (1000 < 1500)
    expect(result.p1LpDelta).toBe(0);
    expect(result.p0LpDelta).toBe(0);
    const mvmEvent = result.events.find(e => e.type === 'monster_vs_monster');
    expect(mvmEvent?.negated).toBe(true);
  });

  it('on_direct_attack reduce_damage_500 → 다이렉트 데미지 500 감소', () => {
    const trapCard: Card = { id: 'direct_shield', type: 'trap', name: '실드', trapCondition: 'on_direct_attack', trapEffect: 'reduce_damage_500' };
    const p0 = player(0, 4000, lane(monster('a', 1000)), lane(), lane());
    const p1 = player(1, 4000, lane(null, trapCard), lane(), lane());
    const result = resolveBattle(p0, p1);
    expect(result.p1LpDelta).toBe(-500); // 1000 - 500 = 500
    expect(result.events[0].trapTriggered?.card.id).toBe('direct_shield');
  });

  it('3개 레인 모두 독립적으로 처리', () => {
    const p0 = player(0, 4000, lane(monster('a', 500)), lane(monster('b', 1000)), lane(monster('c', 1500)));
    const p1 = player(1, 4000, lane(), lane(monster('d', 1500)), lane(monster('e', 1000)));
    const result = resolveBattle(p0, p1);
    // lane0: p0 direct 500 → p1 lp -500
    // lane1: p0(1000) vs p1(1500) → p0 monster destroyed, p0 lp -500
    // lane2: p0(1500) vs p1(1000) → p1 monster destroyed, p1 lp -500
    expect(result.p1LpDelta).toBe(-1000);
    expect(result.p0LpDelta).toBe(-500);
  });
});
