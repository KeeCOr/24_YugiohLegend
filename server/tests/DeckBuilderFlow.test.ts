import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '..', '..');

function readProjectFile(path: string): string {
  return readFileSync(resolve(root, path), 'utf8');
}

describe('deck building flow wiring', () => {
  it('centralizes saved deck storage and starter deck helpers', () => {
    const storage = readProjectFile('client/src/data/DeckStorage.ts');

    expect(storage).toContain("STORAGE_KEY = 'yugioh_deck'");
    expect(storage).toContain('getSavedDeck');
    expect(storage).toContain('saveDeck');
    expect(storage).toContain('isValidDeck');
    expect(storage).toContain('getStarterDeck');
    expect(storage).toContain('getDeckSummary');
  });

  it('routes solo duel through the saved deck when available', () => {
    const menu = readProjectFile('client/src/scenes/MenuScene.ts');

    expect(menu).toContain('getSavedDeck');
    expect(menu).toContain('isValidDeck');
    expect(menu).toContain('Saved Deck');
    expect(menu).toContain('DeckBuilderScene');
    expect(menu).toContain('deck: savedDeck');
  });

  it('presents deck construction as a guided process', () => {
    const deckBuilder = readProjectFile('client/src/scenes/DeckBuilderScene.ts');

    expect(deckBuilder).toContain('Deck Process');
    expect(deckBuilder).toContain('AUTO FILL');
    expect(deckBuilder).toContain('SAVE DECK');
    expect(deckBuilder).toContain('SAVE AND DUEL');
    expect(deckBuilder).toContain('deckStatsTxt');
    expect(deckBuilder).toContain('getDeckSummary');
  });
});
