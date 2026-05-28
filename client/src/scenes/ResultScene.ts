import Phaser from 'phaser';
import { ART_KEYS, addSceneBackdrop } from '../art/ProceduralArt';
import type { PlayerIndex } from '../data/CardTypes';

interface ResultData {
  winner: PlayerIndex | 'draw';
  myIndex: PlayerIndex;
  finalLPs: [number, number];
}

export class ResultScene extends Phaser.Scene {
  constructor() { super('ResultScene'); }

  create(data: ResultData): void {
    const { width, height } = this.scale;
    const { winner, myIndex, finalLPs } = data;
    addSceneBackdrop(this);

    const isWin = winner === myIndex;
    const isDraw = winner === 'draw';
    const label = isDraw ? 'DRAW' : isWin ? 'VICTORY' : 'DEFEAT';
    const color = isDraw ? '#d8e7ff' : isWin ? '#f2c86a' : '#ff667c';

    this.add.image(width / 2, height * 0.39, ART_KEYS.hudFrame).setDisplaySize(540, 230);
    this.add.text(width / 2, height * 0.32, label, {
      fontSize: '70px',
      color,
      fontStyle: 'bold',
      stroke: '#120912',
      strokeThickness: 6,
    }).setOrigin(0.5);

    const myLp = finalLPs[myIndex];
    const opLp = finalLPs[myIndex === 0 ? 1 : 0];
    this.add.text(width / 2, height * 0.44, `Your LP ${myLp}   Rival LP ${opLp}`, {
      fontSize: '23px',
      color: '#ffffff',
    }).setOrigin(0.5);

    this.createTextButton(width / 2, height * 0.61, 'REMATCH', () => {
      this.scene.start('GameScene', { mode: 'single' });
    });
    this.createTextButton(width / 2, height * 0.72, 'MAIN MENU', () => {
      this.scene.start('MenuScene');
    });
  }

  private createTextButton(x: number, y: number, label: string, onClick: () => void): void {
    const btn = this.add.image(x, y, ART_KEYS.buttonPrimary).setDisplaySize(280, 68).setInteractive();
    const txt = this.add.text(x, y, label, {
      fontSize: '17px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    btn.on('pointerdown', onClick);
    btn.on('pointerover', () => {
      btn.setTint(0xffe29a);
      txt.setColor('#fff3bf');
    });
    btn.on('pointerout', () => {
      btn.clearTint();
      txt.setColor('#ffffff');
    });
  }
}
