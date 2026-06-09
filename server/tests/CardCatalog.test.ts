import { describe, expect, it } from 'vitest';
import cards from '../../shared/cards.json';
import type { Card } from '../../shared/types';

const allCards = cards as Card[];
const monsters = allCards.filter(card => card.type === 'monster');
const spells = allCards.filter(card => card.type === 'spell');
const basicMonsters = monsters.filter(card => (card.tributeCost ?? 0) === 0);

describe('monster card catalog', () => {
  it('classifies every basic monster into a clear combat role', () => {
    expect(monsters.length).toBeGreaterThanOrEqual(8);
    for (const monster of monsters) {
      expect(monster.atk).toBeTypeOf('number');
      expect(monster.hp).toBeTypeOf('number');
      expect(monster.tributeCost).toBeTypeOf('number');
      expect(monster.monsterRole).toMatch(/^(striker|guardian|utility)$/);
    }
  });

  it('has high attack monsters with low survivability', () => {
    const strikers = basicMonsters.filter(card => card.monsterRole === 'striker');
    expect(strikers.length).toBeGreaterThanOrEqual(2);
    for (const card of strikers) {
      expect(card.atk ?? 0).toBeGreaterThanOrEqual(1800);
      expect(card.hp ?? 9999).toBeLessThanOrEqual(1200);
    }
  });

  it('has durable monsters with low attack', () => {
    const guardians = basicMonsters.filter(card => card.monsterRole === 'guardian');
    expect(guardians.length).toBeGreaterThanOrEqual(2);
    for (const card of guardians) {
      expect(card.atk ?? 99).toBeLessThanOrEqual(1000);
      expect(card.hp ?? 0).toBeGreaterThanOrEqual(1300);
    }
  });

  it('has low stat utility monsters with movement or special effects', () => {
    const utilities = basicMonsters.filter(card => card.monsterRole === 'utility');
    expect(utilities.length).toBeGreaterThanOrEqual(2);
    for (const card of utilities) {
      expect(card.atk ?? 99).toBeLessThanOrEqual(1200);
      expect(card.hp ?? 9999).toBeLessThanOrEqual(1000);
      expect(card.monsterAbility).toBeDefined();
      expect(card.abilityText).toBeTruthy();
    }
  });

  it('has tribute monsters across the requested premium archetypes', () => {
    const tributeMonsters = monsters.filter(card => (card.tributeCost ?? 0) > 0);
    const tributeRoles = new Set(tributeMonsters.map(card => card.tributeRole));

    expect(tributeMonsters.length).toBeGreaterThanOrEqual(5);
    expect(tributeRoles).toEqual(new Set([
      'bruiser',
      'ally_booster',
      'field_booster',
      'mobile',
      'tribute_scaler',
    ]));

    for (const card of tributeMonsters) {
      expect(card.abilityText).toBeTruthy();
      expect(card.monsterAbility).toBeDefined();
    }
  });

  it('keeps tribute bruisers high in both attack and survivability', () => {
    const bruisers = monsters.filter(card => card.tributeRole === 'bruiser');
    expect(bruisers.length).toBeGreaterThanOrEqual(1);
    for (const card of bruisers) {
      expect(card.atk ?? 0).toBeGreaterThanOrEqual(2200);
      expect(card.hp ?? 0).toBeGreaterThanOrEqual(1800);
    }
  });

  it('keeps only monster and face-up/face-down spell cards in the catalog', () => {
    expect(allCards.map(card => card.type)).not.toContain('trap');
    expect(spells.length).toBeGreaterThanOrEqual(4);
    expect(spells.map(card => card.effect)).not.toContain('heal_1000');

    const faceUpEffects = new Set(spells.filter(card => card.spellMode !== 'face_down').map(card => card.effect));
    expect(faceUpEffects).toEqual(new Set([
      'power_boost',
      'monster_smash',
      'backrow_break',
      'extra_summon_next_turn',
    ]));

    for (const spell of spells) {
      expect(spell.spellMode).toMatch(/^(face_up|face_down)$/);
      if (spell.spellMode === 'face_down') {
        expect(spell.triggerCondition).toMatch(/^(on_attacked|on_direct_attack|on_opponent_summon_two_plus)$/);
        expect(['negate_attack', 'reduce_damage_500', 'destroy_all_monsters']).toContain(spell.effect);
      } else {
        expect(spell.spellDelayTurns).toBeGreaterThanOrEqual(1);
      }
    }
  });
});
