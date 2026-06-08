import cards from '../../../shared/cards.json';
import type { Card } from './CardTypes';

export const STORAGE_KEY = 'yugioh_deck';
export const MIN_DECK_SIZE = 12;
export const MAX_DECK_SIZE = 12;

const ALL_CARDS = cards as Card[];

export interface DeckSummary {
  total: number;
  monsters: number;
  spells: number;
  basicMonsters: number;
  tributeMonsters: number;
  faceUpSpells: number;
  faceDownSpells: number;
  valid: boolean;
  warning: string;
}

export function isValidDeck(deck: Card[]): boolean {
  return deck.length >= MIN_DECK_SIZE && deck.length <= MAX_DECK_SIZE;
}

export function getSavedDeck(): Card[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as Card[];
    if (!Array.isArray(parsed)) return [];

    const knownCards = new Map(ALL_CARDS.map(card => [card.id, card]));
    const seen = new Set<string>();
    const deck: Card[] = [];

    for (const item of parsed) {
      const card = knownCards.get(item?.id);
      if (!card || seen.has(card.id)) continue;
      deck.push(card);
      seen.add(card.id);
      if (deck.length >= MAX_DECK_SIZE) break;
    }

    return deck;
  } catch {
    return [];
  }
}

export function saveDeck(deck: Card[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(deck));
}

export function getStarterDeck(): Card[] {
  const recommendedIds = [
    'goblin_warrior',
    'village_guard',
    'swift_thief',
    'dragon_mage',
    'sky_lancer',
    'shield_mason',
    'iron_golem',
    'hero_warrior',
    'power_boost',
    'battle_fervor',
    'monster_smash',
    'backrow_break',
  ];
  const byId = new Map(ALL_CARDS.map(card => [card.id, card]));
  return recommendedIds.map(id => byId.get(id)).filter((card): card is Card => Boolean(card));
}

export function getDeckSummary(deck: Card[]): DeckSummary {
  const monsters = deck.filter(card => card.type === 'monster');
  const spells = deck.filter(card => card.type === 'spell');
  const tributeMonsters = monsters.filter(card => (card.tributeCost ?? 0) > 0);
  const basicMonsters = monsters.filter(card => (card.tributeCost ?? 0) <= 0);
  const faceUpSpells = spells.filter(card => card.spellMode === 'face_up');
  const faceDownSpells = spells.filter(card => card.spellMode === 'face_down');
  let warning = 'Ready to duel.';

  if (deck.length < MIN_DECK_SIZE) {
    warning = `${MIN_DECK_SIZE - deck.length} more card(s) needed.`;
  } else if (deck.length > MAX_DECK_SIZE) {
    warning = 'Deck is over the card limit.';
  } else if (monsters.length < 5) {
    warning = 'Add more monsters for stable lanes.';
  } else if (spells.length < 2) {
    warning = 'Add a few spells for lane control.';
  } else if (tributeMonsters.length > 0 && basicMonsters.length < 3) {
    warning = 'Tribute decks need more free monsters.';
  }

  return {
    total: deck.length,
    monsters: monsters.length,
    spells: spells.length,
    basicMonsters: basicMonsters.length,
    tributeMonsters: tributeMonsters.length,
    faceUpSpells: faceUpSpells.length,
    faceDownSpells: faceDownSpells.length,
    valid: isValidDeck(deck),
    warning,
  };
}
