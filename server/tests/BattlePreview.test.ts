import { describe, expect, it } from 'vitest';
import { getLaneBattlePreview } from '../../shared/battlePreview';
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
      label: 'DIRECT -1200',
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
