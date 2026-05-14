import Phaser from 'phaser';

export class MenuScene extends Phaser.Scene {
  constructor() { super('MenuScene'); }

  create(): void {
    const { width, height } = this.scale;

    this.add.text(width / 2, height / 4, 'YugiohLegend', {
      fontSize: '48px', color: '#e2b96e', fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(width / 2, height / 3, '유희왕 레전드', {
      fontSize: '20px', color: '#aaaaaa',
    }).setOrigin(0.5);

    this.createButton(width / 2, height / 2 - 40, '싱글 플레이 (vs AI)', () => {
      this.scene.start('GameScene', { mode: 'single' });
    });

    this.createButton(width / 2, height / 2 + 30, '덱 빌더', () => {
      this.scene.start('DeckBuilderScene');
    });
  }

  private createButton(x: number, y: number, label: string, onClick: () => void): void {
    const btn = this.add.rectangle(x, y, 280, 50, 0x2d4a7a).setInteractive();
    const txt = this.add.text(x, y, label, { fontSize: '18px', color: '#ffffff' }).setOrigin(0.5);

    btn.on('pointerover', () => btn.setFillStyle(0x3a65a8));
    btn.on('pointerout',  () => btn.setFillStyle(0x2d4a7a));
    btn.on('pointerdown', onClick);
  }
}
