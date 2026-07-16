import { describe, expect, it } from 'vitest';
import { getBoardBattlePressure, getLaneBattlePreview } from '../../shared/battlePreview';
import type { Card, LaneState } from '../../shared/types';

function monster(id: string, atk: number, hp = 1000): Card {
  return { id, type: 'monster', name: id, atk, hp };
}

function lane(mon: Card | null = null, tempAtkBoost = 0): LaneState {
  return { monster: mon, spell: null, faceDownSpell: null, tempAtkBoost };
}

describe('getLaneBattlePreview', () => {
  it('describes direct damage when only the player has a monster', () => {
    const preview = getLaneBattlePreview(lane(monster('attacker', 1200)), lane());

    expect(preview).toEqual({
      kind: 'direct',
      attacker: 'player',
      damage: 1200,
      label: 'LP -1200',
      tone: 'advantage',
    });
  });

  it('describes HP loss and survival for a monster clash', () => {
    const preview = getLaneBattlePreview(lane(monster('player', 1800)), lane(monster('rival', 1500, 800)));

    expect(preview).toEqual({
      kind: 'clash',
      attacker: 'player',
      damage: 300,
      target: 'opponent',
      hpAfter: 500,
      lpDamage: 0,
      survives: true,
      label: 'HP -300 | survives 500',
      tone: 'advantage',
    });
  });

  it('describes overflow LP damage when a monster is defeated below zero', () => {
    const preview = getLaneBattlePreview(lane(monster('player', 1100, 300)), lane(monster('rival', 1700)));

    expect(preview).toEqual({
      kind: 'clash',
      attacker: 'opponent',
      damage: 600,
      target: 'player',
      hpAfter: -300,
      lpDamage: 300,
      survives: false,
      label: 'KO | LP -300',
      tone: 'danger',
    });
  });
});
describe('getBoardBattlePressure', () => {
  it('summarizes rival direct LP pressure across open lanes', () => {
    const pressure = getBoardBattlePressure(
      [lane(), lane(monster('guard', 900)), lane()],
      [lane(monster('rival-a', 1200)), lane(monster('rival-b', 800)), lane(monster('rival-c', 600))]
    );

    expect(pressure).toEqual({
      playerLpRisk: 1800,
      opponentLpRisk: 0,
      playerWinningTrades: 1,
      rivalWinningTrades: 0,
      quietLanes: 0,
      tone: 'danger',
      headline: 'RIVAL PRESSURE +1800',
      detail: 'Your LP risk 1800 / rival LP risk 0',
    });
  });

  it('marks player pressure as advantage when the board threatens more rival LP', () => {
    const pressure = getBoardBattlePressure(
      [lane(monster('player-a', 1500)), lane(monster('player-b', 1100)), lane()],
      [lane(), lane(monster('rival-b', 600, 300)), lane()]
    );

    expect(pressure.tone).toBe('advantage');
    expect(pressure.headline).toBe('YOU PRESSURE +1700');
    expect(pressure.playerLpRisk).toBe(0);
    expect(pressure.opponentLpRisk).toBe(1700);
    expect(pressure.playerWinningTrades).toBe(1);
  });

  it('counts quiet lanes when neither side has a battle preview', () => {
    const pressure = getBoardBattlePressure([lane(), lane(), lane()], [lane(), lane(), lane()]);

    expect(pressure).toEqual({
      playerLpRisk: 0,
      opponentLpRisk: 0,
      playerWinningTrades: 0,
      rivalWinningTrades: 0,
      quietLanes: 3,
      tone: 'neutral',
      headline: 'BOARD QUIET',
      detail: 'No LP pressure yet',
    });
  });
});
