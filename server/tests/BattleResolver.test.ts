import { describe, it, expect } from 'vitest';
import { resolveBattle } from '../src/BattleResolver';
import type { Card, LaneState, PlayerState } from '../../shared/types';

function monster(id: string, atk: number, hp = 1000): Card {
  return { id, type: 'monster', name: id, atk, hp };
}

function lane(mon: Card | null = null, trap: Card | null = null): LaneState {
  return { monster: mon, spell: null, faceDownSpell: trap, tempAtkBoost: 0 };
}

function player(index: 0 | 1, lp: number, l0: LaneState, l1: LaneState, l2: LaneState, l3: LaneState = lane()): PlayerState {
  return { index, lp, hand: [], deck: [], lanes: [l0, l1, l2, l3] };
}

describe('resolveBattle', () => {
  it('does not change LP when all lanes are empty', () => {
    const result = resolveBattle(
      player(0, 4000, lane(), lane(), lane()),
      player(1, 4000, lane(), lane(), lane())
    );
    expect(result.p0LpDelta).toBe(0);
    expect(result.p1LpDelta).toBe(0);
  });

  it('p0 direct attacks an empty lane', () => {
    const result = resolveBattle(
      player(0, 4000, lane(monster('m', 1500)), lane(), lane()),
      player(1, 4000, lane(), lane(), lane())
    );
    expect(result.p1LpDelta).toBe(-1500);
    expect(result.p0LpDelta).toBe(0);
    expect(result.events[0].type).toBe('direct_attack');
    expect(result.events[0].attackerIndex).toBe(0);
  });

  it('p1 direct attacks an empty lane', () => {
    const result = resolveBattle(
      player(0, 4000, lane(), lane(), lane()),
      player(1, 4000, lane(monster('m', 1000)), lane(), lane())
    );
    expect(result.p0LpDelta).toBe(-1000);
    expect(result.p1LpDelta).toBe(0);
  });

  it('higher ATK reduces lower monster HP by the difference without LP damage when it survives', () => {
    const result = resolveBattle(
      player(0, 4000, lane(monster('a', 2000, 500)), lane(), lane()),
      player(1, 4000, lane(monster('b', 1500, 900)), lane(), lane())
    );
    expect(result.p1LpDelta).toBe(0);
    expect(result.p0LpDelta).toBe(0);
    expect(result.events[0].damage).toBe(500);
    expect(result.events[0].destroyedCards).toEqual([]);
    expect(result.events[0].hpChanges).toEqual([
      { playerIndex: 1, card: monster('b', 1500, 900), hpBefore: 900, hpAfter: 400 },
    ]);
  });

  it('destroys a monster and deals overflow LP damage when ATK difference drops HP below zero', () => {
    const result = resolveBattle(
      player(0, 4000, lane(monster('a', 2000, 500)), lane(), lane()),
      player(1, 4000, lane(monster('b', 1500, 400)), lane(), lane())
    );
    expect(result.p1LpDelta).toBe(-100);
    expect(result.events[0].destroyedCards).toEqual([{ playerIndex: 1, card: monster('b', 1500, 400) }]);
    expect(result.events[0].hpChanges).toEqual([
      { playerIndex: 1, card: monster('b', 1500, 400), hpBefore: 400, hpAfter: -100 },
    ]);
  });

  it('destroys a monster without LP damage when ATK difference drops HP exactly to zero', () => {
    const result = resolveBattle(
      player(0, 4000, lane(monster('a', 2000, 500)), lane(), lane()),
      player(1, 4000, lane(monster('b', 1500, 500)), lane(), lane())
    );
    expect(result.p1LpDelta).toBe(0);
    expect(result.events[0].destroyedCards).toEqual([{ playerIndex: 1, card: monster('b', 1500, 500) }]);
    expect(result.events[0].hpChanges).toEqual([
      { playerIndex: 1, card: monster('b', 1500, 500), hpBefore: 500, hpAfter: 0 },
    ]);
  });

  it('equal ATK leaves both monsters standing without HP or LP damage', () => {
    const result = resolveBattle(
      player(0, 4000, lane(monster('a', 1000, 600)), lane(), lane()),
      player(1, 4000, lane(monster('b', 1000, 600)), lane(), lane())
    );
    expect(result.p0LpDelta).toBe(0);
    expect(result.p1LpDelta).toBe(0);
    expect(result.events[0].destroyedCards).toEqual([]);
    expect(result.events[0].hpChanges).toEqual([]);
  });

  it('tempAtkBoost changes effective ATK', () => {
    const boostedLane: LaneState = { monster: monster('a', 1000), spell: null, faceDownSpell: null, tempAtkBoost: 500 };
    const result = resolveBattle(
      player(0, 4000, boostedLane, lane(), lane()),
      player(1, 4000, lane(monster('b', 1200)), lane(), lane())
    );
    expect(result.p1LpDelta).toBe(0);
    expect(result.events[0].hpChanges).toEqual([
      { playerIndex: 1, card: monster('b', 1200), hpBefore: 1000, hpAfter: 700 },
    ]);
  });

  it('on_attacked negate_attack face-down spell negates one attack', () => {
    const trapCard: Card = { id: 'mirror_snare', type: 'spell', spellMode: 'face_down', name: 'Counter', triggerCondition: 'on_attacked', effect: 'negate_attack' };
    const result = resolveBattle(
      player(0, 4000, lane(monster('a', 1500)), lane(), lane()),
      player(1, 4000, lane(monster('b', 1000), trapCard), lane(), lane())
    );
    expect(result.p1LpDelta).toBe(0);
    expect(result.p0LpDelta).toBe(0);
    expect(result.events.find(e => e.type === 'monster_vs_monster')?.negated).toBe(true);
  });

  it('on_direct_attack reduce_damage_500 face-down spell reduces direct damage', () => {
    const trapCard: Card = { id: 'direct_shield', type: 'spell', spellMode: 'face_down', name: 'Shield', triggerCondition: 'on_direct_attack', effect: 'reduce_damage_500' };
    const result = resolveBattle(
      player(0, 4000, lane(monster('a', 1000)), lane(), lane()),
      player(1, 4000, lane(null, trapCard), lane(), lane())
    );
    expect(result.p1LpDelta).toBe(-500);
    expect(result.events[0].triggeredSpell?.card.id).toBe('direct_shield');
  });

  it('all 4 lanes resolve independently', () => {
    const result = resolveBattle(
      player(0, 4000, lane(monster('a', 500)), lane(monster('b', 1000)), lane(monster('c', 1500)), lane()),
      player(1, 4000, lane(), lane(monster('d', 1500)), lane(monster('e', 1000)), lane(monster('f', 700)))
    );
    expect(result.p1LpDelta).toBe(-500);
    expect(result.p0LpDelta).toBe(-700);
    expect(result.events[1].hpChanges).toEqual([
      { playerIndex: 0, card: monster('b', 1000), hpBefore: 1000, hpAfter: 500 },
    ]);
    expect(result.events[2].hpChanges).toEqual([
      { playerIndex: 1, card: monster('e', 1000), hpBefore: 1000, hpAfter: 500 },
    ]);
  });
});
