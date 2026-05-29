import Phaser from 'phaser';
import { ART_KEYS, addSceneBackdrop } from '../art/ProceduralArt';
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

    this.createButton(width / 2, height * 0.47, 'SOLO DUEL', () => {
      if (hasSeenOnboarding()) {
        this.scene.start('GameScene', { mode: 'single' });
      } else {
        this.scene.start('OnboardingScene', { nextScene: 'GameScene', nextData: { mode: 'single' } });
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
