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
    expect(storage).toContain('MIN_DECK_SIZE = 12');
    expect(storage).toContain('MAX_DECK_SIZE = 12');
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

  it('carries the active deck into rematch so deck counters reset correctly', () => {
    const gameScene = readProjectFile('client/src/scenes/GameScene.ts');
    const resultScene = readProjectFile('client/src/scenes/ResultScene.ts');

    expect(gameScene).toContain('private duelDeck: Card[] = []');
    expect(gameScene).toContain('this.duelDeck = [...deck]');
    expect(gameScene).toContain('deck: this.duelDeck');
    expect(resultScene).toContain('deck: Card[]');
    expect(resultScene).toContain('const rematchDeck = [...data.deck]');
    expect(resultScene).toContain("this.scene.start('GameScene', { mode: 'single', deck: rematchDeck })");
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

  it('uses visual deck slots and drag-to-slot deck construction', () => {
    const deckBuilder = readProjectFile('client/src/scenes/DeckBuilderScene.ts');

    expect(deckBuilder).toContain('deckSlots');
    expect(deckBuilder).toContain('deckSlotSprites');
    expect(deckBuilder).toContain('createDeckSlots');
    expect(deckBuilder).toContain('startArchiveDrag');
    expect(deckBuilder).toContain('finishArchiveDrag');
    expect(deckBuilder).toContain('getSlotIndexAt');
    expect(deckBuilder).toContain('placeCardInSlot');
    expect(deckBuilder).toContain('ARCHIVE_CARD_SCALE = 0.94');
    expect(deckBuilder).toContain('SLOT_CARD_SCALE = 0.62');
    expect(deckBuilder).not.toContain('deckTexts');
  });
});
