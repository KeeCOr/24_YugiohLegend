import { describe, it, expect } from 'vitest';
import { randomAction, greedyAction } from '../src/AIEngine';
import type { Card, PlayerState, LaneState } from '../../shared/types';

function monster(id: string, atk: number): Card {
  return { id, type: 'monster', name: id, atk };
}

function emptyLane(): LaneState {
  return { monster: null, spell: null, faceDownSpell: null, tempAtkBoost: 0 };
}

function player(hand: Card[]): PlayerState {
  return { index: 0, lp: 4000, hand, deck: [], lanes: [emptyLane(), emptyLane(), emptyLane()] };
}

describe('randomAction', () => {
  it('summons a monster when hand has monsters and a lane is empty', () => {
    const p = player([monster('a', 1000), monster('b', 1500)]);
    const action = randomAction(p);
    expect(action.summon).toBeDefined();
    expect([0, 1, 2]).toContain(action.summon!.laneIndex);
    expect(action.spells).toBeDefined();
    expect(action.spells).toBeDefined();
  });

  it('does nothing with an empty hand', () => {
    const p = player([]);
    const action = randomAction(p);
    expect(action.summon).toBeUndefined();
    expect(action.spells).toHaveLength(0);
    expect(action.spells).toHaveLength(0);
  });

  it('does not summon when every lane has a monster', () => {
    const fullPlayer: PlayerState = {
      index: 0,
      lp: 4000,
      deck: [],
      hand: [monster('new', 1000)],
      lanes: [
        { monster: monster('a', 500), spell: null, faceDownSpell: null, tempAtkBoost: 0 },
        { monster: monster('b', 500), spell: null, faceDownSpell: null, tempAtkBoost: 0 },
        { monster: monster('c', 500), spell: null, faceDownSpell: null, tempAtkBoost: 0 },
      ],
    };
    const action = randomAction(fullPlayer);
    expect(action.summon).toBeUndefined();
  });

  it('can set a trap in the same lane as a summoned monster', () => {
    const faceDownSpell: Card = { id: 'ct', type: 'trap', spellMode: 'face_down', name: 'Trap', triggerCondition: 'on_attacked', effect: 'negate_attack' };
    const p: PlayerState = {
      index: 0,
      lp: 4000,
      deck: [],
      hand: [monster('m', 1000), faceDownSpell],
      lanes: [
        { monster: null, spell: null, faceDownSpell: null, tempAtkBoost: 0 },
        { monster: monster('x', 500), spell: null, faceDownSpell: null, tempAtkBoost: 0 },
        { monster: monster('y', 500), spell: null, faceDownSpell: null, tempAtkBoost: 0 },
      ],
    };
    const action = randomAction(p);
    expect(action.summon?.laneIndex).toBe(0);
    expect(action.spells).toHaveLength(1);
    expect(action.spells[0].laneIndex).toBe(0);
  });
});

describe('greedyAction', () => {
  it('summons the monster with the highest ATK', () => {
    const p = player([monster('weak', 500), monster('strong', 2000), monster('mid', 1000)]);
    const action = greedyAction(p);
    expect(action.summon?.card.id).toBe('strong');
  });

  it('sets spell cards in lanes', () => {
    const spell: Card = { id: 'boost', type: 'spell', name: 'Boost', effect: 'power_boost' };
    const p = player([spell, monster('m', 1000)]);
    const action = greedyAction(p);
    expect(action.spells).toHaveLength(1);
    expect(action.spells[0].card.id).toBe('boost');
  });

  it('sets a trap in the first empty lane', () => {
    const faceDownSpell: Card = { id: 'ct', type: 'trap', spellMode: 'face_down', name: 'Trap', triggerCondition: 'on_attacked', effect: 'negate_attack' };
    const p = player([faceDownSpell]);
    const action = greedyAction(p);
    expect(action.spells).toHaveLength(1);
    expect(action.spells[0].laneIndex).toBe(0);
  });

  it('can set a trap in the same lane as a summoned monster', () => {
    const faceDownSpell: Card = { id: 'ct', type: 'trap', spellMode: 'face_down', name: 'Trap', triggerCondition: 'on_attacked', effect: 'negate_attack' };
    const p: PlayerState = {
      index: 0,
      lp: 4000,
      deck: [],
      hand: [monster('m', 1000), faceDownSpell],
      lanes: [
        { monster: null, spell: null, faceDownSpell: null, tempAtkBoost: 0 },
        { monster: monster('x', 500), spell: null, faceDownSpell: null, tempAtkBoost: 0 },
        { monster: monster('y', 500), spell: null, faceDownSpell: null, tempAtkBoost: 0 },
      ],
    };
    const action = greedyAction(p);
    expect(action.summon?.laneIndex).toBe(0);
    expect(action.spells).toHaveLength(1);
    expect(action.spells[0].laneIndex).toBe(0);
  });

  it('turn 1 AI only uses lane 1', () => {
    const spell: Card = { id: 'boost', type: 'spell', name: 'Boost', effect: 'power_boost' };
    const faceDownSpell: Card = { id: 'ct', type: 'trap', spellMode: 'face_down', name: 'Trap', triggerCondition: 'on_attacked', effect: 'negate_attack' };
    const p = player([monster('m', 1000), spell, faceDownSpell]);
    const action = greedyAction(p, 1);

    expect(action.summon?.laneIndex).toBe(0);
    expect(action.spells.every(s => s.laneIndex === 0)).toBe(true);
    expect(action.spells.every(t => t.laneIndex === 0)).toBe(true);
  });

  it('turn 3 AI can use the third lane and never chooses a fourth lane', () => {
    const p: PlayerState = {
      index: 0,
      lp: 4000,
      deck: [],
      hand: [monster('m', 1000)],
      lanes: [
        { monster: monster('a', 500), spell: null, faceDownSpell: null, tempAtkBoost: 0 },
        { monster: monster('b', 500), spell: null, faceDownSpell: null, tempAtkBoost: 0 },
        { monster: null, spell: null, faceDownSpell: null, tempAtkBoost: 0 },
      ],
    };
    const action = greedyAction(p, 3);
    expect(action.summon?.laneIndex).toBe(2);
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
        { monster: material, spell: null, faceDownSpell: null, tempAtkBoost: 0 },
        { monster: null, spell: null, faceDownSpell: null, tempAtkBoost: 0 },
        { monster: null, spell: null, faceDownSpell: null, tempAtkBoost: 0 },
      ],
    };

    const action = greedyAction(p, 2);

    expect(action.summon?.card.id).toBe(tributeMonster.id);
    expect(action.summon?.tributeLaneIndices).toEqual([0]);
  });
});
