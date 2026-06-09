import { describe, it, expect } from 'vitest';
import { GameRoom } from '../src/GameRoom';
import type { Card, GameState, TurnAction } from '../../shared/types';
import cards from '../../shared/cards.json';

const allCards = cards as Card[];

function makeDeck(): Card[] {
  return allCards.slice(0, 12);
}

function emptyAction(): TurnAction {
  return { spells: [] };
}

describe('GameRoom', () => {
  it('sends game_start to both players with a 4 card hand', () => {
    const room = new GameRoom('room1');
    room.addPlayer('p0', makeDeck());
    const msgs = room.addPlayer('p1', makeDeck());
    const start0 = msgs.find(m => m.playerIndex === 0 && m.message.type === 'game_start');
    const start1 = msgs.find(m => m.playerIndex === 1 && m.message.type === 'game_start');
    expect(start0).toBeDefined();
    expect(start1).toBeDefined();
    if (start0?.message.type === 'game_start') {
      expect(start0.message.yourHand).toHaveLength(4);
    }
  });

  it('does not send game_start with only one player', () => {
    const room = new GameRoom('room1');
    const msgs = room.addPlayer('p0', makeDeck());
    expect(msgs.find(m => m.message.type === 'game_start')).toBeUndefined();
  });

  it('sends reveal and battle_result after both players submit', () => {
    const room = new GameRoom('room1');
    room.addPlayer('p0', makeDeck());
    room.addPlayer('p1', makeDeck());
    room.submitAction(0, emptyAction());
    const msgs = room.submitAction(1, emptyAction());
    expect(msgs.some(m => m.message.type === 'reveal')).toBe(true);
    expect(msgs.some(m => m.message.type === 'battle_result')).toBe(true);
  });

  it('does not reveal after only one player submits', () => {
    const room = new GameRoom('room1');
    room.addPlayer('p0', makeDeck());
    room.addPlayer('p1', makeDeck());
    const msgs = room.submitAction(0, emptyAction());
    expect(msgs.some(m => m.message.type === 'reveal')).toBe(false);
  });

  it('4 turns + final battle sends game_over', () => {
    const room = new GameRoom('room1');
    room.addPlayer('p0', makeDeck());
    room.addPlayer('p1', makeDeck());

    room.submitAction(0, emptyAction());
    room.submitAction(1, emptyAction());
    room.submitAction(0, emptyAction());
    room.submitAction(1, emptyAction());
    room.submitAction(0, emptyAction());
    const turn3Msgs = room.submitAction(1, emptyAction());
    expect(turn3Msgs.find(m => m.message.type === 'game_over')).toBeUndefined();
    room.submitAction(0, emptyAction());
    const msgs = room.submitAction(1, emptyAction());

    expect(msgs.find(m => m.message.type === 'game_over')).toBeDefined();
  });

  it('turn 1 is setup only and does not resolve attacks', () => {
    const room = new GameRoom('room1');
    room.addPlayer('p0', makeDeck());
    room.addPlayer('p1', makeDeck());
    const monsterCard = allCards.find(c => c.id === 'goblin_warrior')!;

    room.submitAction(0, { summon: { card: monsterCard, laneIndex: 0 }, spells: [] });
    const msgs = room.submitAction(1, emptyAction());
    const result = msgs.find(m => m.message.type === 'battle_result')?.message;

    expect(result?.type).toBe('battle_result');
    if (result?.type === 'battle_result') {
      expect(result.events).toHaveLength(0);
      expect(result.lps).toEqual([4000, 4000]);
      expect(result.lanes[0][0].monster?.id).toBe(monsterCard.id);
    }
    expect(room.getState().turn).toBe(2);
  });

  it('applies ATK difference as monster HP loss without LP damage', () => {
    const room = new GameRoom('room1');
    room.addPlayer('p0', makeDeck());
    room.addPlayer('p1', makeDeck());
    const strong: Card = { id: 'strong_test_monster', type: 'monster', name: 'Strong', atk: 2000, hp: 500 };
    const durable: Card = { id: 'durable_test_monster', type: 'monster', name: 'Durable', atk: 1500, hp: 900 };

    room.submitAction(0, { summon: { card: strong, laneIndex: 0 }, spells: [] });
    room.submitAction(1, { summon: { card: durable, laneIndex: 0 }, spells: [] });
    room.submitAction(0, emptyAction());
    const msgs = room.submitAction(1, emptyAction());
    const result = msgs.find(m => m.message.type === 'battle_result')?.message;

    expect(room.getState().players[0].lp).toBe(4000);
    expect(room.getState().players[1].lp).toBe(4000);
    expect(room.getState().players[1].lanes[0].monster?.hp).toBe(400);
    expect(result?.type).toBe('battle_result');
    if (result?.type === 'battle_result') {
      expect(result.lanes[1][0].monster?.hp).toBe(400);
      expect(result.events[0].hpChanges).toEqual([
        { playerIndex: 1, card: durable, hpBefore: 900, hpAfter: 400 },
      ]);
    }
  });

  it('only unlocks one additional lane each turn', () => {
    const room = new GameRoom('room1');
    room.addPlayer('p0', makeDeck());
    room.addPlayer('p1', makeDeck());
    const lockedTurn1 = allCards.find(c => c.id === 'goblin_warrior')!;
    const laneOneTurn1 = allCards.find(c => c.id === 'village_guard')!;
    const lockedTurn2 = allCards.find(c => c.id === 'dragon_mage')!;

    room.submitAction(0, { summon: { card: lockedTurn1, laneIndex: 1 }, spells: [] });
    room.submitAction(1, emptyAction());
    expect(room.getState().players[0].lanes[1].monster).toBeNull();

    room.submitAction(0, { summon: { card: laneOneTurn1, laneIndex: 0 }, spells: [] });
    room.submitAction(1, { summon: { card: lockedTurn2, laneIndex: 2 }, spells: [] });
    expect(room.getState().players[0].lanes[0].monster?.id).toBe(laneOneTurn1.id);
    expect(room.getState().players[1].lanes[2].monster).toBeNull();

    room.submitAction(0, emptyAction());
    room.submitAction(1, { summon: { card: lockedTurn2, laneIndex: 2 }, spells: [] });
    expect(room.getState().players[1].lanes[2].monster?.id).toBe(lockedTurn2.id);
  });

  it('spell resolves at the start of the next turn before players submit actions', () => {
    const room = new GameRoom('room1');
    room.addPlayer('p0', makeDeck());
    room.addPlayer('p1', makeDeck());

    const boostCard = allCards.find(c => c.id === 'power_boost')!;
    const monster = allCards.find(c => c.id === 'village_guard')!;
    const opponentMonster = allCards.find(c => c.id === 'shield_mason')!;
    (room.getState() as GameState).players[0].hand.push(boostCard);
    (room.getState() as GameState).players[0].lanes[0].monster = monster;
    (room.getState() as GameState).players[1].lanes[0].monster = opponentMonster;

    const action: TurnAction = { spells: [{ card: boostCard, laneIndex: 0 }] };
    room.submitAction(0, action);
    const turnStartMsgs = room.submitAction(1, emptyAction());

    expect(room.getState().turn).toBe(2);
    expect(room.getState().players[0].lanes[0].tempAtkBoost).toBe(500);
    expect(room.getState().players[0].lanes[0].spell).toBeNull();
    const turnStart = turnStartMsgs.find(m => m.playerIndex === 0 && m.message.type === 'turn_start')?.message;
    expect(turnStart?.type).toBe('turn_start');
    if (turnStart?.type === 'turn_start') {
      expect(turnStart.lanes[0][0].tempAtkBoost).toBe(500);
      expect(turnStart.lanes[0][0].spell).toBeNull();
    }

    room.submitAction(0, emptyAction());
    room.submitAction(1, emptyAction());

    expect(room.getState().players[0].lanes[0].monster?.id).toBe(monster.id);
    expect(room.getState().players[1].lanes[0].monster?.id).toBe(opponentMonster.id);
    expect(room.getState().players[1].lanes[0].monster?.hp).toBe(1100);
  });

  it('delayed spell is destroyed before resolving when its lane is hit', () => {
    const room = new GameRoom('room1');
    room.addPlayer('p0', makeDeck());
    room.addPlayer('p1', makeDeck());

    const boostCard = allCards.find(c => c.id === 'power_boost')!;
    const attacker = allCards.find(c => c.id === 'goblin_warrior')!;
    (room.getState() as GameState).players[0].hand.push(boostCard);

    room.submitAction(0, emptyAction());
    room.submitAction(1, emptyAction());

    room.submitAction(0, { spells: [{ card: boostCard, laneIndex: 0 }] });
    room.submitAction(1, { summon: { card: attacker, laneIndex: 0 }, spells: [] });

    expect(room.getState().players[0].lanes[0].spell).toBeNull();
    expect(room.getState().players[0].lp).toBe(2100);
  });

  it('monster_smash spell destroys the opponent monster after its delay', () => {
    const room = new GameRoom('room1');
    room.addPlayer('p0', makeDeck());
    room.addPlayer('p1', makeDeck());

    const smashCard = allCards.find(c => c.id === 'monster_smash')!;
    const strongMonster = allCards.find(c => c.id === 'iron_golem')!;
    const weakMonster = allCards.find(c => c.id === 'village_guard')!;

    (room.getState() as GameState).players[1].lanes[0].monster = strongMonster;
    (room.getState() as GameState).players[1].lanes[1].monster = weakMonster;
    (room.getState() as GameState).players[0].hand.push(smashCard);

    const action: TurnAction = { spells: [{ card: smashCard, laneIndex: 0 }] };
    room.submitAction(0, action);
    const turnStartMsgs = room.submitAction(1, emptyAction());

    expect(room.getState().turn).toBe(2);
    expect(room.getState().players[1].lanes[0].monster).toBeNull();
    expect(room.getState().players[1].lanes[1].monster?.id).toBe(weakMonster.id);
    const turnStart = turnStartMsgs.find(m => m.playerIndex === 0 && m.message.type === 'turn_start')?.message;
    expect(turnStart?.type).toBe('turn_start');
    if (turnStart?.type === 'turn_start') {
      expect(turnStart.lanes[1][0].monster).toBeNull();
    }
  });

  it('backrow_break spell destroys an opponent delayed spell before it resolves', () => {
    const room = new GameRoom('room1');
    room.addPlayer('p0', makeDeck());
    room.addPlayer('p1', makeDeck());

    const breaker = allCards.find(c => c.id === 'backrow_break')!;
    const opponentSpell = allCards.find(c => c.id === 'power_boost')!;

    (room.getState() as GameState).players[0].hand.push(breaker);
    (room.getState() as GameState).players[1].lanes[0].spell = {
      card: opponentSpell,
      remainingTurns: 2,
    };

    room.submitAction(0, { spells: [{ card: breaker, laneIndex: 0 }] });
    const turnStartMsgs = room.submitAction(1, emptyAction());

    expect(room.getState().players[1].lanes[0].spell).toBeNull();
    const turnStart = turnStartMsgs.find(m => m.playerIndex === 0 && m.message.type === 'turn_start')?.message;
    expect(turnStart?.type).toBe('turn_start');
    if (turnStart?.type === 'turn_start') {
      expect(turnStart.lanes[1][0].spell).toBeNull();
    }
  });

  it('backrow_break spell destroys an opponent trap when no delayed spell is available', () => {
    const room = new GameRoom('room1');
    room.addPlayer('p0', makeDeck());
    room.addPlayer('p1', makeDeck());

    const breaker = allCards.find(c => c.id === 'backrow_break')!;
    const trap = allCards.find(c => c.id === 'mirror_snare')!;

    (room.getState() as GameState).players[0].hand.push(breaker);
    (room.getState() as GameState).players[1].lanes[0].faceDownSpell = trap;

    room.submitAction(0, { spells: [{ card: breaker, laneIndex: 0 }] });
    room.submitAction(1, emptyAction());
    room.submitAction(0, emptyAction());
    room.submitAction(1, emptyAction());

    expect(room.getState().players[1].lanes[0].faceDownSpell).toBeNull();
  });

  it('rejects deck sizes that are not exactly 12 cards', () => {
    const room = new GameRoom('room1');
    const msgs = room.addPlayer('p0', allCards.slice(0, 5));
    expect(msgs.some(m => m.message.type === 'error')).toBe(true);
  });

  it('summon action places a monster on the field', () => {
    const room = new GameRoom('room1');
    room.addPlayer('p0', makeDeck());
    room.addPlayer('p1', makeDeck());
    const monsterCard = allCards.find(c => c.type === 'monster')!;
    const action: TurnAction = { summon: { card: monsterCard, laneIndex: 0 }, spells: [] };
    room.submitAction(0, action);
    room.submitAction(1, emptyAction());
    expect(room.getState().players[0].lanes[0].monster?.id).toBe(monsterCard.id);
  });

  it('allows only one summon unless an extra summon spell resolves', () => {
    const room = new GameRoom('room1');
    room.addPlayer('p0', makeDeck());
    room.addPlayer('p1', makeDeck());
    const first: Card = { id: 'first_free', type: 'monster', name: 'First', atk: 700, hp: 700, tributeCost: 0 };
    const second: Card = { id: 'second_free', type: 'monster', name: 'Second', atk: 800, hp: 700, tributeCost: 0 };

    room.submitAction(0, {
      summons: [
        { card: first, laneIndex: 0 },
        { card: second, laneIndex: 1 },
      ],
      spells: [],
    });
    room.submitAction(1, emptyAction());

    expect(room.getState().players[0].lanes[0].monster?.id).toBe(first.id);
    expect(room.getState().players[0].lanes[1].monster).toBeNull();
  });

  it('extra summon spell lets its owner summon twice on the next turn if it survives', () => {
    const room = new GameRoom('room1');
    room.addPlayer('p0', makeDeck());
    room.addPlayer('p1', makeDeck());
    const extraSummon = allCards.find(c => c.id === 'extra_summon')!;
    const first: Card = { id: 'first_extra_free', type: 'monster', name: 'First Extra', atk: 700, hp: 700, tributeCost: 0 };
    const second: Card = { id: 'second_extra_free', type: 'monster', name: 'Second Extra', atk: 800, hp: 700, tributeCost: 0 };

    (room.getState() as GameState).players[0].hand.push(extraSummon, first, second);
    room.submitAction(0, { spells: [{ card: extraSummon, laneIndex: 0 }] });
    const turnStartMsgs = room.submitAction(1, emptyAction());
    const turnStart = turnStartMsgs.find(m => m.playerIndex === 0 && m.message.type === 'turn_start')?.message;

    expect(room.getState().players[0].lanes[0].spell).toBeNull();
    expect(turnStart?.type).toBe('turn_start');
    if (turnStart?.type === 'turn_start') {
      expect(turnStart.summonLimit).toBe(2);
    }

    room.submitAction(0, {
      summons: [
        { card: first, laneIndex: 0 },
        { card: second, laneIndex: 1 },
      ],
      spells: [],
    });
    room.submitAction(1, emptyAction());

    expect(room.getState().players[0].lanes[0].monster?.id).toBe(first.id);
    expect(room.getState().players[0].lanes[1].monster?.id).toBe(second.id);
    expect(room.getState().players[0].lanes[0].spell).toBeNull();
  });

  it('overextend trap destroys all monsters when the opponent summons two or more monsters this turn', () => {
    const room = new GameRoom('room1');
    room.addPlayer('p0', makeDeck());
    room.addPlayer('p1', makeDeck());
    const trap = allCards.find(c => c.id === 'overextend_collapse')!;
    const extraSummon = allCards.find(c => c.id === 'extra_summon')!;
    const p0Existing: Card = { id: 'p0_existing', type: 'monster', name: 'P0 Existing', atk: 700, hp: 700, tributeCost: 0 };
    const p1Existing: Card = { id: 'p1_existing', type: 'monster', name: 'P1 Existing', atk: 700, hp: 700, tributeCost: 0 };
    const first: Card = { id: 'first_overextend', type: 'monster', name: 'First Over', atk: 700, hp: 700, tributeCost: 0 };
    const second: Card = { id: 'second_overextend', type: 'monster', name: 'Second Over', atk: 800, hp: 700, tributeCost: 0 };

    (room.getState() as GameState).turn = 3;
    (room.getState() as GameState).players[0].lanes[0].monster = p0Existing;
    (room.getState() as GameState).players[1].lanes[0].monster = p1Existing;
    (room.getState() as GameState).players[0].lanes[1].faceDownSpell = trap;
    (room as unknown as { extraSummonsThisTurn: [number, number] }).extraSummonsThisTurn = [0, 1];

    room.submitAction(0, emptyAction());
    room.submitAction(1, {
      summons: [
        { card: first, laneIndex: 1 },
        { card: second, laneIndex: 2 },
      ],
      spells: [],
    });

    expect(room.getState().players[0].lanes.every(lane => lane.monster === null)).toBe(true);
    expect(room.getState().players[1].lanes.every(lane => lane.monster === null)).toBe(true);
    expect(room.getState().players[0].lanes[1].faceDownSpell).toBeNull();
  });

  it('tribute summon automatically consumes a monster that was already summoned on the field', () => {
    const room = new GameRoom('room1');
    room.addPlayer('p0', makeDeck());
    room.addPlayer('p1', makeDeck());
    const tributeMonster = allCards.find(c => c.id === 'iron_golem')!;
    const material = allCards.find(c => c.id === 'village_guard')!;

    (room.getState() as GameState).players[0].hand.push(material);
    (room.getState() as GameState).players[0].hand.push(tributeMonster);

    room.submitAction(0, { summon: { card: material, laneIndex: 0 }, spells: [] });
    room.submitAction(1, emptyAction());

    expect(room.getState().turn).toBe(2);
    expect(room.getState().players[0].lanes[0].monster?.id).toBe(material.id);

    room.submitAction(0, { summon: { card: tributeMonster, laneIndex: 1 }, spells: [] });
    room.submitAction(1, emptyAction());

    expect(room.getState().players[0].lanes[0].monster).toBeNull();
    expect(room.getState().players[0].lanes[1].monster?.id).toBe(tributeMonster.id);
  });

  it('tribute summon does not use monsters from hand as tribute material', () => {
    const room = new GameRoom('room1');
    room.addPlayer('p0', makeDeck());
    room.addPlayer('p1', makeDeck());
    const tributeMonster = allCards.find(c => c.id === 'iron_golem')!;
    const handOnlyMaterial = allCards.find(c => c.id === 'village_guard')!;

    (room.getState() as GameState).players[0].hand.push(handOnlyMaterial);
    (room.getState() as GameState).players[0].hand.push(tributeMonster);

    room.submitAction(0, { summon: { card: tributeMonster, laneIndex: 0 }, spells: [] });
    room.submitAction(1, emptyAction());

    expect(room.getState().players[0].lanes[0].monster).toBeNull();
    expect(room.getState().players[0].hand.map(card => card.id)).toContain(handOnlyMaterial.id);
    expect(room.getState().players[0].hand.map(card => card.id)).toContain(tributeMonster.id);
  });

  it('reveal shows opponent face-up spells and hides face-down spells', () => {
    const room = new GameRoom('room1');
    room.addPlayer('p0', makeDeck());
    room.addPlayer('p1', makeDeck());
    const spell = allCards.find(c => c.id === 'backrow_break')!;
    const faceDownSpell = allCards.find(c => c.id === 'mirror_snare')!;

    room.submitAction(0, emptyAction());
    const msgs = room.submitAction(1, {
      spells: [{ card: spell, laneIndex: 1 }, { card: faceDownSpell, laneIndex: 1 }],
    });
    const revealForP0 = msgs.find(m => m.playerIndex === 0 && m.message.type === 'reveal')?.message;
    const revealForP1 = msgs.find(m => m.playerIndex === 1 && m.message.type === 'reveal')?.message;

    expect(revealForP0?.type).toBe('reveal');
    expect(revealForP1?.type).toBe('reveal');
    if (revealForP0?.type === 'reveal' && revealForP1?.type === 'reveal') {
      expect(revealForP0.opponentAction.spells[0].card.id).toBe(spell.id);
      expect(revealForP0.opponentAction.spells[1].card.id).toBe('hidden_face_down_spell');
      expect(revealForP1.yourAction.spells[0].card.id).toBe(spell.id);
      expect(revealForP1.yourAction.spells[1].card.id).toBe(faceDownSpell.id);
    }
  });

  it('battle_result includes both players lane state after summons', () => {
    const room = new GameRoom('room1');
    room.addPlayer('p0', makeDeck());
    room.addPlayer('p1', makeDeck());
    const p0Monster = allCards.find(c => c.id === 'goblin_warrior')!;
    const p1Monster = allCards.find(c => c.id === 'dragon_mage')!;

    room.submitAction(0, emptyAction());
    room.submitAction(1, emptyAction());
    room.submitAction(0, emptyAction());
    room.submitAction(1, emptyAction());

    room.submitAction(0, { summon: { card: p0Monster, laneIndex: 0 }, spells: [] });
    const msgs = room.submitAction(1, { summon: { card: p1Monster, laneIndex: 2 }, spells: [] });
    const result = msgs.find(m => m.message.type === 'battle_result')?.message;

    expect(result?.type).toBe('battle_result');
    if (result?.type === 'battle_result') {
      expect(result.lanes[0][0].monster?.id).toBe(p0Monster.id);
      expect(result.lanes[1][2].monster?.id).toBe(p1Monster.id);
    }
  });
});
