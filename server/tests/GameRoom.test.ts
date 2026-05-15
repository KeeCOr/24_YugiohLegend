import { describe, it, expect } from 'vitest';
import { GameRoom } from '../src/GameRoom';
import type { Card, GameState, TurnAction } from '../../shared/types';
import cards from '../../shared/cards.json';

const allCards = cards as Card[];

function makeDeck(): Card[] {
  return allCards.slice(0, 8).concat(allCards.slice(0, 2));
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
    room.submitAction(1, emptyAction());
    room.submitAction(0, emptyAction());
    room.submitAction(1, { summon: { card: lockedTurn2, laneIndex: 3 }, spells: [] });
    expect(room.getState().players[1].lanes[3].monster?.id).toBe(lockedTurn2.id);
  });

  it('spell is set on a lane first and resolves on the next turn', () => {
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
    room.submitAction(1, emptyAction());

    expect(room.getState().players[0].lanes[0].tempAtkBoost).toBe(0);
    expect(room.getState().players[0].lanes[0].spell?.card.id).toBe(boostCard.id);

    room.submitAction(0, emptyAction());
    room.submitAction(1, emptyAction());

    expect(room.getState().players[0].lanes[0].monster?.id).toBe(monster.id);
    expect(room.getState().players[1].lanes[0].monster).toBeNull();
    expect(room.getState().players[0].lanes[0].spell).toBeNull();
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
    room.submitAction(1, emptyAction());

    expect(room.getState().players[1].lanes[0].monster?.id).toBe(strongMonster.id);

    room.submitAction(0, emptyAction());
    room.submitAction(1, emptyAction());

    expect(room.getState().players[1].lanes[0].monster).toBeNull();
    expect(room.getState().players[1].lanes[1].monster?.id).toBe(weakMonster.id);
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
    room.submitAction(1, emptyAction());

    expect(room.getState().players[1].lanes[0].spell?.card.id).toBe(opponentSpell.id);

    room.submitAction(0, emptyAction());
    room.submitAction(1, emptyAction());

    expect(room.getState().players[1].lanes[0].spell).toBeNull();
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

  it('rejects deck sizes outside 8 to 12 cards', () => {
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

  it('tribute summon requires and consumes tribute monsters', () => {
    const room = new GameRoom('room1');
    room.addPlayer('p0', makeDeck());
    room.addPlayer('p1', makeDeck());
    const tributeMonster = allCards.find(c => c.id === 'iron_golem')!;
    const material = allCards.find(c => c.id === 'village_guard')!;

    (room.getState() as GameState).players[0].lanes[1].monster = material;
    (room.getState() as GameState).players[0].hand.push(tributeMonster);

    room.submitAction(0, { summon: { card: tributeMonster, laneIndex: 0 }, spells: [] });
    room.submitAction(1, emptyAction());
    expect(room.getState().players[0].lanes[0].monster).toBeNull();
    expect(room.getState().players[0].lanes[1].monster?.id).toBe(material.id);

    room.submitAction(0, { summon: { card: tributeMonster, laneIndex: 0, tributeLaneIndices: [1] }, spells: [] });
    room.submitAction(1, emptyAction());
    expect(room.getState().players[0].lanes[0].monster?.id).toBe(tributeMonster.id);
    expect(room.getState().players[0].lanes[1].monster).toBeNull();
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
