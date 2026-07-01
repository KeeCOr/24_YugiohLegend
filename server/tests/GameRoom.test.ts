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

  it('battle_result summarizes setup-turn actions before the next draw', () => {
    const room = new GameRoom('room1');
    room.addPlayer('p0', makeDeck());
    room.addPlayer('p1', makeDeck());
    const monsterCard = allCards.find(c => c.id === 'goblin_warrior')!;
    const spellCard = allCards.find(c => c.id === 'power_boost')!;

    room.submitAction(0, { summon: { card: monsterCard, laneIndex: 0 }, spells: [] });
    const msgs = room.submitAction(1, { spells: [{ card: spellCard, laneIndex: 0 }] });
    const result = msgs.find(m => m.message.type === 'battle_result')?.message;

    expect(result?.type).toBe('battle_result');
    if (result?.type === 'battle_result') {
      expect((result as any).turnSummary).toMatchObject({
        turn: 1,
        isSetupTurn: true,
        playerSummons: [1, 0],
        playerActions: [1, 1],
        lpDelta: [0, 0],
        battleEventCount: 0,
        nextTurn: 2,
      });
    }
  });

  it('battle_result summarizes LP change and combat event count', () => {
    const room = new GameRoom('room1');
    room.addPlayer('p0', makeDeck());
    room.addPlayer('p1', makeDeck());
    const attacker: Card = { id: 'summary_attacker', type: 'monster', name: 'Summary Attacker', atk: 1300, hp: 800 };

    const state = room.getState() as GameState;
    state.turn = 2;
    state.players[0].lanes[0].monster = attacker;

    room.submitAction(0, emptyAction());
    const msgs = room.submitAction(1, emptyAction());
    const result = msgs.find(m => m.message.type === 'battle_result')?.message;

    expect(result?.type).toBe('battle_result');
    if (result?.type === 'battle_result') {
      expect((result as any).turnSummary).toMatchObject({
        turn: 2,
        isSetupTurn: false,
        playerSummons: [0, 0],
        playerActions: [0, 0],
        lpDelta: [0, -1300],
        battleEventCount: 1,
        nextTurn: 3,
      });
    }
  });

  it('final turn battle_result summary does not promise another draw', () => {
    const room = new GameRoom('room1');
    room.addPlayer('p0', makeDeck());
    room.addPlayer('p1', makeDeck());
    const attacker: Card = { id: 'summary_final_attacker', type: 'monster', name: 'Summary Final Attacker', atk: 900, hp: 800 };

    const state = room.getState() as GameState;
    state.turn = 4;
    state.players[0].lanes[0].monster = attacker;

    room.submitAction(0, emptyAction());
    const msgs = room.submitAction(1, emptyAction());
    const firstResult = msgs.find(m => m.message.type === 'battle_result')?.message;

    expect(firstResult?.type).toBe('battle_result');
    if (firstResult?.type === 'battle_result') {
      expect((firstResult as any).turnSummary).toMatchObject({
        turn: 4,
        lpDelta: [0, -900],
        nextTurn: null,
      });
    }
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

  it('includes pre-battle lanes before HP and LP results are applied', () => {
    const room = new GameRoom('room1');
    room.addPlayer('p0', makeDeck());
    room.addPlayer('p1', makeDeck());
    const strong: Card = { id: 'strong_prebattle_monster', type: 'monster', name: 'Strong', atk: 2000, hp: 500 };
    const fragile: Card = { id: 'fragile_prebattle_monster', type: 'monster', name: 'Fragile', atk: 1500, hp: 300 };

    room.submitAction(0, { summon: { card: strong, laneIndex: 0 }, spells: [] });
    room.submitAction(1, { summon: { card: fragile, laneIndex: 0 }, spells: [] });
    room.submitAction(0, emptyAction());
    const msgs = room.submitAction(1, emptyAction());
    const result = msgs.find(m => m.message.type === 'battle_result')?.message;

    expect(result?.type).toBe('battle_result');
    if (result?.type === 'battle_result') {
      expect(result.preBattleLanes[1][0].monster?.id).toBe(fragile.id);
      expect(result.preBattleLanes[1][0].monster?.hp).toBe(300);
      expect(result.lanes[1][0].monster).toBeNull();
      expect(result.lps).toEqual([4000, 3800]);
    }
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

  it('tribute summon can replace the chosen tribute monster in its lane', () => {
    const room = new GameRoom('room1');
    room.addPlayer('p0', makeDeck());
    room.addPlayer('p1', makeDeck());
    const tributeMonster: Card = { id: 'replacement_titan', type: 'monster', name: 'Replacement Titan', atk: 2400, hp: 1800, tributeCost: 1 };
    const material = allCards.find(c => c.id === 'village_guard')!;

    (room.getState() as GameState).players[0].hand.push(material);
    (room.getState() as GameState).players[0].hand.push(tributeMonster);

    room.submitAction(0, { summon: { card: material, laneIndex: 0 }, spells: [] });
    room.submitAction(1, emptyAction());

    room.submitAction(0, { summon: { card: tributeMonster, laneIndex: 0, tributeLaneIndices: [0] }, spells: [] });
    room.submitAction(1, emptyAction());

    expect(room.getState().players[0].lanes[0].monster?.id).toBe(tributeMonster.id);
    expect(room.getState().players[0].hand.map(card => card.id)).not.toContain(tributeMonster.id);
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

  it('reveal shows opponent face-up spells and hides traps', () => {
    const room = new GameRoom('room1');
    room.addPlayer('p0', makeDeck());
    room.addPlayer('p1', makeDeck());
    const spell = allCards.find(c => c.id === 'backrow_break')!;
    const trap = allCards.find(c => c.id === 'mirror_snare')!;

    room.submitAction(0, emptyAction());
    const msgs = room.submitAction(1, {
      spells: [{ card: spell, laneIndex: 1 }, { card: trap, laneIndex: 1 }],
    });
    const revealForP0 = msgs.find(m => m.playerIndex === 0 && m.message.type === 'reveal')?.message;
    const revealForP1 = msgs.find(m => m.playerIndex === 1 && m.message.type === 'reveal')?.message;

    expect(revealForP0?.type).toBe('reveal');
    expect(revealForP1?.type).toBe('reveal');
    if (revealForP0?.type === 'reveal' && revealForP1?.type === 'reveal') {
      expect(revealForP0.opponentAction.spells[0].card.id).toBe(spell.id);
      expect(revealForP0.opponentAction.spells[1].card.id).toBe('hidden_face_down_spell');
      expect(revealForP1.yourAction.spells[0].card.id).toBe(spell.id);
      expect(revealForP1.yourAction.spells[1].card.id).toBe(trap.id);
    }
  });


  it('marks a direct attack as a finisher when it drops LP to zero', () => {
    const room = new GameRoom('room1');
    room.addPlayer('p0', makeDeck());
    room.addPlayer('p1', makeDeck());
    const lethalAttacker: Card = { id: 'lethal_direct', type: 'monster', name: 'Lethal Direct', atk: 1200, hp: 800 };

    const state = room.getState() as GameState;
    state.turn = 2;
    state.players[1].lp = 1000;
    state.players[0].lanes[0].monster = lethalAttacker;

    room.submitAction(0, emptyAction());
    const msgs = room.submitAction(1, emptyAction());
    const result = msgs.find(m => m.message.type === 'battle_result')?.message;

    expect(result?.type).toBe('battle_result');
    if (result?.type === 'battle_result') {
      expect(result.events[0]).toMatchObject({ type: 'direct_attack', attackerIndex: 0, damage: 1200, finisher: true });
      expect(result.lps[1]).toBe(-200);
    }
    expect(msgs.find(m => m.message.type === 'game_over')).toBeDefined();
  });

  it('marks overflow LP damage as a finisher when monster combat ends the duel', () => {
    const room = new GameRoom('room1');
    room.addPlayer('p0', makeDeck());
    room.addPlayer('p1', makeDeck());
    const attacker: Card = { id: 'lethal_overflow', type: 'monster', name: 'Lethal Overflow', atk: 2200, hp: 900 };
    const defender: Card = { id: 'fragile_wall', type: 'monster', name: 'Fragile Wall', atk: 1600, hp: 300 };

    const state = room.getState() as GameState;
    state.turn = 2;
    state.players[1].lp = 250;
    state.players[0].lanes[0].monster = attacker;
    state.players[1].lanes[0].monster = defender;

    room.submitAction(0, emptyAction());
    const msgs = room.submitAction(1, emptyAction());
    const result = msgs.find(m => m.message.type === 'battle_result')?.message;

    expect(result?.type).toBe('battle_result');
    if (result?.type === 'battle_result') {
      expect(result.events[0]).toMatchObject({ type: 'monster_vs_monster', attackerIndex: 0, damage: 600, finisher: true });
      expect(result.events[0].hpChanges).toEqual([{ playerIndex: 1, card: defender, hpBefore: 300, hpAfter: -300 }]);
      expect(result.lps[1]).toBe(-50);
    }
  });

  it('does not mark non-lethal LP damage as a finisher', () => {
    const room = new GameRoom('room1');
    room.addPlayer('p0', makeDeck());
    room.addPlayer('p1', makeDeck());
    const attacker: Card = { id: 'non_lethal_direct', type: 'monster', name: 'Non Lethal Direct', atk: 800, hp: 800 };

    const state = room.getState() as GameState;
    state.turn = 2;
    state.players[1].lp = 1800;
    state.players[0].lanes[0].monster = attacker;

    room.submitAction(0, emptyAction());
    const msgs = room.submitAction(1, emptyAction());
    const result = msgs.find(m => m.message.type === 'battle_result')?.message;

    expect(result?.type).toBe('battle_result');
    if (result?.type === 'battle_result') {
      expect(result.events[0]).toMatchObject({ type: 'direct_attack', damage: 800 });
      expect(result.events[0].finisher).toBeUndefined();
      expect(result.lps[1]).toBe(1000);
    }
    expect(msgs.find(m => m.message.type === 'game_over')).toBeUndefined();
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
  it('turn summary gives a readable setup draw-action-next-turn chain', () => {
    const room = new GameRoom('room1');
    room.addPlayer('p0', makeDeck());
    room.addPlayer('p1', makeDeck());
    const monsterCard = allCards.find(c => c.id === 'goblin_warrior')!;

    room.submitAction(0, { summon: { card: monsterCard, laneIndex: 0 }, spells: [] });
    const msgs = room.submitAction(1, emptyAction());
    const result = msgs.find(m => m.message.type === 'battle_result')?.message;

    expect(result?.type).toBe('battle_result');
    if (result?.type === 'battle_result') {
      expect(result.turnSummary?.headline).toBe('T1 setup: P1 played 1 card, P2 played 0 cards. Next: draw for T2.');
      expect(result.turnSummary?.steps).toEqual([
        'Draw: next turn both duelists draw 1 card.',
        'Action: P1 summoned 1 monster and played 1 total card; P2 played 0 cards.',
        'LP: no LP change this turn.',
        'End: proceed to T2 draw.',
      ]);
    }
  });

  it('turn summary explains LP loss and the next draw', () => {
    const room = new GameRoom('room1');
    room.addPlayer('p0', makeDeck());
    room.addPlayer('p1', makeDeck());
    const attacker: Card = { id: 'summary_chain_attacker', type: 'monster', name: 'Summary Chain Attacker', atk: 1300, hp: 800 };

    const state = room.getState() as GameState;
    state.turn = 2;
    state.players[0].lanes[0].monster = attacker;

    room.submitAction(0, emptyAction());
    const msgs = room.submitAction(1, emptyAction());
    const result = msgs.find(m => m.message.type === 'battle_result')?.message;

    expect(result?.type).toBe('battle_result');
    if (result?.type === 'battle_result') {
      expect(result.turnSummary?.headline).toBe('T2 battle: P2 LP -1300 across 1 clash. Next: draw for T3.');
      expect(result.turnSummary?.steps).toEqual([
        'Draw: next turn both duelists draw 1 card.',
        'Action: P1 played 0 cards; P2 played 0 cards.',
        'LP: P1 0, P2 -1300.',
        'End: proceed to T3 draw.',
      ]);
    }
  });

  it('turn summary calls out an LP 0 duel finish', () => {
    const room = new GameRoom('room1');
    room.addPlayer('p0', makeDeck());
    room.addPlayer('p1', makeDeck());
    const attacker: Card = { id: 'summary_finish_attacker', type: 'monster', name: 'Summary Finish Attacker', atk: 1200, hp: 800 };

    const state = room.getState() as GameState;
    state.turn = 2;
    state.players[1].lp = 1000;
    state.players[0].lanes[0].monster = attacker;

    room.submitAction(0, emptyAction());
    const msgs = room.submitAction(1, emptyAction());
    const result = msgs.find(m => m.message.type === 'battle_result')?.message;

    expect(result?.type).toBe('battle_result');
    if (result?.type === 'battle_result') {
      expect(result.turnSummary?.headline).toBe('T2 finish: P2 LP reached 0. Duel ends now.');
      expect(result.turnSummary?.steps).toContain('End: P2 LP 0, game over before the next draw.');
    }
  });
});
