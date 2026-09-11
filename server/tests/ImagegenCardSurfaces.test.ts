import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const bootScenePath = resolve(__dirname, '../../client/src/scenes/BootScene.ts');
const cardSpritePath = resolve(__dirname, '../../client/src/components/CardSprite.ts');
const proceduralArtPath = resolve(__dirname, '../../client/src/art/ProceduralArt.ts');

const bootSceneSource = readFileSync(bootScenePath, 'utf-8');
const cardSpriteSource = readFileSync(cardSpritePath, 'utf-8');
const proceduralArtSource = readFileSync(proceduralArtPath, 'utf-8');

describe('Imagegen card surfaces wiring', () => {
  it('BootScene preloads the card panel PNG through ART_KEYS.cardPanel', () => {
    expect(bootSceneSource).toMatch(/ART_KEYS\.cardPanel/);
    expect(bootSceneSource).toMatch(/yl-card-panel-9s\.png/);
  });

  it('BootScene preloads the art slot frame PNG through ART_KEYS.artSlotFrame', () => {
    expect(bootSceneSource).toMatch(/ART_KEYS\.artSlotFrame/);
    expect(bootSceneSource).toMatch(/yl-card-art-slot-frame\.png/);
  });

  it('face-up CardSprite renders with Phaser.GameObjects.NineSlice using cardPanel, while face-down keeps yl_card_frames', () => {
    expect(cardSpriteSource).toMatch(/Phaser\.GameObjects\.NineSlice/);
    expect(cardSpriteSource).toMatch(/ART_KEYS\.cardPanel/);
    expect(cardSpriteSource).toMatch(/yl_card_frames/);
  });

  it('artwork slot uses a bitmap NineSlice frame and introduces no new Rectangle for artFrame', () => {
    expect(cardSpriteSource).toMatch(/ART_KEYS\.artSlotFrame/);
    expect(cardSpriteSource).not.toMatch(/new\s+Phaser\.GameObjects\.Rectangle\([^)]*artFrame/);
  });

  it('fitArtworkToSlot keeps Math.max-based cover/crop scaling', () => {
    expect(cardSpriteSource).toMatch(/fitArtworkToSlot/);
    expect(cardSpriteSource).toMatch(/Math\.max/);
  });

  it('ProceduralArt no longer defines or calls createCardFrame, but keeps backdrop/lane/glow/slash procedural drawing', () => {
    expect(proceduralArtSource).not.toMatch(/createCardFrame/);
    expect(proceduralArtSource).toMatch(/backdrop/i);
    expect(proceduralArtSource).toMatch(/lane/i);
    expect(proceduralArtSource).toMatch(/glow/i);
    expect(proceduralArtSource).toMatch(/slash/i);
  });

  it('new card surface wiring contains no inline SVG or data URI sources', () => {
    const combined = `${bootSceneSource}\n${cardSpriteSource}`;
    expect(combined).not.toMatch(/<svg/i);
    expect(combined).not.toMatch(/data:image\//i);
  });
});
