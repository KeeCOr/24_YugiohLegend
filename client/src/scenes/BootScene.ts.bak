import Phaser from 'phaser';
import cardsJson from 'shared/cards.json';
import type { Card } from '../data/CardTypes';
import { cardArtKey, registerProceduralArt } from '../art/ProceduralArt';

export const ALL_CARDS: Card[] = cardsJson as Card[];

export class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  preload(): void {
    registerProceduralArt(this);
    for (const card of ALL_CARDS) {
      this.load.image(cardArtKey(card.id), `assets/cards/${card.id}.png`);
    }
  }

  create(): void {
    this.scene.start('MenuScene');
  }
}
