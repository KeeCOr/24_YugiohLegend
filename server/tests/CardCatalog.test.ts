import { describe, expect, it } from 'vitest';
import cards from '../../shared/cards.json';
import type { Card } from '../../shared/types';

const allCards = cards as Card[];
const monsters = allCards.filter(card => card.type === 'monster');

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
    const strikers = monsters.filter(card => card.monsterRole === 'striker');
    expect(strikers.length).toBeGreaterThanOrEqual(2);
    for (const card of strikers) {
      expect(card.atk ?? 0).toBeGreaterThanOrEqual(1800);
      expect(card.hp ?? 99).toBeLessThanOrEqual(2);
    }
  });

  it('has durable monsters with low attack', () => {
    const guardians = monsters.filter(card => card.monsterRole === 'guardian');
    expect(guardians.length).toBeGreaterThanOrEqual(2);
    for (const card of guardians) {
      expect(card.atk ?? 99).toBeLessThanOrEqual(1000);
      expect(card.hp ?? 0).toBeGreaterThanOrEqual(4);
    }
  });

  it('has low stat utility monsters with movement or special effects', () => {
    const utilities = monsters.filter(card => card.monsterRole === 'utility');
    expect(utilities.length).toBeGreaterThanOrEqual(2);
    for (const card of utilities) {
      expect(card.atk ?? 99).toBeLessThanOrEqual(1200);
      expect(card.hp ?? 99).toBeLessThanOrEqual(2);
      expect(card.monsterAbility).toBeDefined();
      expect(card.abilityText).toBeTruthy();
    }
  });
});
