import Phaser from 'phaser';
import { ART_KEYS, addSceneBackdrop } from '../art/ProceduralArt';
import { getSavedDeck, isValidDeck } from '../data/DeckStorage';
import { hasSeenOnboarding } from './OnboardingScene';

export class MenuScene extends Phaser.Scene {
  constructor() { super('MenuScene'); }

  create(): void {
    const { width, height } = this.scale;
    addSceneBackdrop(this);

    this.add.text(width / 2, height * 0.22, 'YUGIOH LEGEND', {
      fontSize: '56px',
      color: '#f2c86a',
      fontStyle: 'bold',
      stroke: '#170b0f',
      strokeThickness: 6,
    }).setOrigin(0.5);

    this.add.text(width / 2, height * 0.31, 'Three lanes. One setup turn. Four turns total.', {
      fontSize: '18px',
      color: '#b8c7e8',
    }).setOrigin(0.5);

    const savedDeck = getSavedDeck();
    const hasSavedDeck = isValidDeck(savedDeck);
    this.add.text(width / 2, height * 0.38, hasSavedDeck ? `Saved Deck: ${savedDeck.length} cards ready` : 'Saved Deck: build 8-12 cards first', {
      fontSize: '16px',
      color: hasSavedDeck ? '#8ef2ba' : '#fff3bf',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.createButton(width / 2, height * 0.47, 'SOLO DUEL', () => {
      if (!hasSavedDeck) {
        this.scene.start('DeckBuilderScene');
        return;
      }

      const nextData = { mode: 'single', deck: savedDeck };
      if (hasSeenOnboarding()) {
        this.scene.start('GameScene', nextData);
      } else {
        this.scene.start('OnboardingScene', { nextScene: 'GameScene', nextData: { mode: 'single', deck: savedDeck } });
      }
    });

    this.createButton(width / 2, height * 0.58, 'DECK BUILDER', () => {
      this.scene.start('DeckBuilderScene');
    });
  }

  private createButton(x: number, y: number, label: string, onClick: () => void): void {
    const btn = this.add.image(x, y, ART_KEYS.buttonPrimary).setDisplaySize(320, 76).setInteractive();
    const txt = this.add.text(x, y, label, {
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    btn.on('pointerover', () => {
      btn.setTint(0xffe29a);
      txt.setColor('#fff3bf');
    });
    btn.on('pointerout', () => {
      btn.clearTint();
      txt.setColor('#ffffff');
    });
    btn.on('pointerdown', onClick);
  }
}
