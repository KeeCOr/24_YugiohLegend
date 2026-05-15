import { describe, it, expect } from 'vitest';
import { randomAction, greedyAction } from '../src/AIEngine';
import type { Card, PlayerState, LaneState } from '../../shared/types';

function monster(id: string, atk: number): Card {
  return { id, type: 'monster', name: id, atk };
}

function emptyLane(): LaneState {
  return { monster: null, spell: null, trap: null, tempAtkBoost: 0 };
}

function player(hand: Card[]): PlayerState {
  return { index: 0, lp: 4000, hand, deck: [], lanes: [emptyLane(), emptyLane(), emptyLane(), emptyLane()] };
}

describe('randomAction', () => {
  it('summons a monster when hand has monsters and a lane is empty', () => {
    const p = player([monster('a', 1000), monster('b', 1500)]);
    const action = randomAction(p);
    expect(action.summon).toBeDefined();
    expect([0, 1, 2, 3]).toContain(action.summon!.laneIndex);
    expect(action.spells).toBeDefined();
    expect(action.traps).toBeDefined();
  });

  it('does nothing with an empty hand', () => {
    const p = player([]);
    const action = randomAction(p);
    expect(action.summon).toBeUndefined();
    expect(action.spells).toHaveLength(0);
    expect(action.traps).toHaveLength(0);
  });

  it('does not summon when every lane has a monster', () => {
    const fullPlayer: PlayerState = {
      index: 0,
      lp: 4000,
      deck: [],
      hand: [monster('new', 1000)],
      lanes: [
        { monster: monster('a', 500), spell: null, trap: null, tempAtkBoost: 0 },
        { monster: monster('b', 500), spell: null, trap: null, tempAtkBoost: 0 },
        { monster: monster('c', 500), spell: null, trap: null, tempAtkBoost: 0 },
        { monster: monster('d', 500), spell: null, trap: null, tempAtkBoost: 0 },
      ],
    };
    const action = randomAction(fullPlayer);
    expect(action.summon).toBeUndefined();
  });

  it('does not put a trap in the same lane as a summoned monster', () => {
    const trap: Card = { id: 'ct', type: 'trap', name: 'Trap', trapCondition: 'on_attacked', trapEffect: 'negate_attack' };
    const p: PlayerState = {
      index: 0,
      lp: 4000,
      deck: [],
      hand: [monster('m', 1000), trap],
      lanes: [
        { monster: null, spell: null, trap: null, tempAtkBoost: 0 },
        { monster: monster('x', 500), spell: null, trap: null, tempAtkBoost: 0 },
        { monster: monster('y', 500), spell: null, trap: null, tempAtkBoost: 0 },
        { monster: monster('z', 500), spell: null, trap: null, tempAtkBoost: 0 },
      ],
    };
    const action = randomAction(p);
    expect(action.summon?.laneIndex).toBe(0);
    expect(action.traps).toHaveLength(0);
  });
});

describe('greedyAction', () => {
  it('summons the monster with the highest ATK', () => {
    const p = player([monster('weak', 500), monster('strong', 2000), monster('mid', 1000)]);
    const action = greedyAction(p);
    expect(action.summon?.card.id).toBe('strong');
  });

  it('sets spell cards in lanes', () => {
    const spell: Card = { id: 'heal', type: 'spell', name: 'Heal', effect: 'heal_1000' };
    const p = player([spell, monster('m', 1000)]);
    const action = greedyAction(p);
    expect(action.spells).toHaveLength(1);
    expect(action.spells[0].card.id).toBe('heal');
  });

  it('sets a trap in the first empty lane', () => {
    const trap: Card = { id: 'ct', type: 'trap', name: 'Trap', trapCondition: 'on_attacked', trapEffect: 'negate_attack' };
    const p = player([trap]);
    const action = greedyAction(p);
    expect(action.traps).toHaveLength(1);
    expect(action.traps[0].laneIndex).toBe(0);
  });

  it('does not set a trap in the same lane as a summoned monster', () => {
    const trap: Card = { id: 'ct', type: 'trap', name: 'Trap', trapCondition: 'on_attacked', trapEffect: 'negate_attack' };
    const p: PlayerState = {
      index: 0,
      lp: 4000,
      deck: [],
      hand: [monster('m', 1000), trap],
      lanes: [
        { monster: null, spell: null, trap: null, tempAtkBoost: 0 },
        { monster: monster('x', 500), spell: null, trap: null, tempAtkBoost: 0 },
        { monster: monster('y', 500), spell: null, trap: null, tempAtkBoost: 0 },
        { monster: monster('z', 500), spell: null, trap: null, tempAtkBoost: 0 },
      ],
    };
    const action = greedyAction(p);
    expect(action.summon?.laneIndex).toBe(0);
    expect(action.traps).toHaveLength(0);
  });

  it('turn 1 AI only uses the center lane', () => {
    const spell: Card = { id: 'heal', type: 'spell', name: 'Heal', effect: 'heal_1000' };
    const trap: Card = { id: 'ct', type: 'trap', name: 'Trap', trapCondition: 'on_attacked', trapEffect: 'negate_attack' };
    const p = player([monster('m', 1000), spell, trap]);
    const action = greedyAction(p, 1);

    expect(action.summon?.laneIndex).toBe(1);
    expect(action.spells.every(s => s.laneIndex === 1)).toBe(true);
    expect(action.traps.every(t => t.laneIndex === 1)).toBe(true);
  });

  it('turn 4 AI can use the fourth lane', () => {
    const p: PlayerState = {
      index: 0,
      lp: 4000,
      deck: [],
      hand: [monster('m', 1000)],
      lanes: [
        { monster: monster('a', 500), spell: null, trap: null, tempAtkBoost: 0 },
        { monster: monster('b', 500), spell: null, trap: null, tempAtkBoost: 0 },
        { monster: monster('c', 500), spell: null, trap: null, tempAtkBoost: 0 },
        { monster: null, spell: null, trap: null, tempAtkBoost: 0 },
      ],
    };
    const action = greedyAction(p, 4);
    expect(action.summon?.laneIndex).toBe(3);
  });

  it('greedyAction includes tribute materials for tribute monsters', () => {
    const tributeMonster: Card = { id: 'boss', type: 'monster', name: 'Boss', atk: 2400, tributeCost: 1 };
    const material = monster('mat', 400);
    const p: PlayerState = {
      index: 0,
      lp: 4000,
      deck: [],
      hand: [tributeMonster],
      lanes: [
        { monster: material, spell: null, trap: null, tempAtkBoost: 0 },
        { monster: null, spell: null, trap: null, tempAtkBoost: 0 },
        { monster: null, spell: null, trap: null, tempAtkBoost: 0 },
        { monster: null, spell: null, trap: null, tempAtkBoost: 0 },
      ],
    };

    const action = greedyAction(p, 2);

    expect(action.summon?.card.id).toBe(tributeMonster.id);
    expect(action.summon?.tributeLaneIndices).toEqual([0]);
  });
});
