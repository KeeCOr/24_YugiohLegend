import Phaser from 'phaser';
import cardsJson from 'shared/cards.json';
import type { Card } from '../data/CardTypes';
import { ART_KEYS, cardArtKey, registerProceduralArt } from '../art/ProceduralArt';

export const ALL_CARDS: Card[] = cardsJson as Card[];

export class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  preload(): void {
    // AI-generated textures
    this.load.image(ART_KEYS.backdrop, 'assets/generated/art_backdrop.png');
    this.load.image(ART_KEYS.cardBack, 'assets/generated/art_cardBack.png');
    this.load.image(ART_KEYS.cardMonster, 'assets/generated/art_cardMonster.png');
    this.load.image(ART_KEYS.cardSpell, 'assets/generated/art_cardSpell.png');
    this.load.image(ART_KEYS.lane, 'assets/generated/art_lane.png');
    this.load.image(ART_KEYS.laneEnemy, 'assets/generated/art_laneEnemy.png');
    this.load.image(ART_KEYS.panel, 'assets/generated/art_panel.png');
    this.load.image(ART_KEYS.button, 'assets/generated/art_button.png');
    this.load.image(ART_KEYS.buttonPrimary, 'assets/generated/art_buttonPrimary.png');
    this.load.image(ART_KEYS.hudFrame, 'assets/generated/art_hudFrame.png');
    this.load.image(ART_KEYS.handRail, 'assets/generated/art_handRail.png');
    this.load.image(ART_KEYS.laneFrame, 'assets/generated/art_laneFrame.png');
    this.load.image(ART_KEYS.glow, 'assets/generated/art_glow.png');
    this.load.image(ART_KEYS.slash, 'assets/generated/art_slash.png');
    for (const card of ALL_CARDS) {
      this.load.image(cardArtKey(card.id), `assets/cards/${card.id}.png`);
    }
  }

  create(): void {
    registerProceduralArt(this);
    this.scene.start('MenuScene');
  }
}
