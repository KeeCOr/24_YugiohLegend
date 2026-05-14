import Phaser from 'phaser';
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

    const isWin  = winner === myIndex;
    const isDraw = winner === 'draw';
    const label  = isDraw ? '무승부!' : isWin ? '승리!' : '패배...';
    const color  = isDraw ? '#aaaaaa' : isWin ? '#ffdd00' : '#ff4444';

    this.add.text(width / 2, height / 3, label, {
      fontSize: '72px', color, fontStyle: 'bold',
    }).setOrigin(0.5);

    const myLp = finalLPs[myIndex];
    const opLp = finalLPs[myIndex === 0 ? 1 : 0];
    this.add.text(width / 2, height / 2, `내 LP: ${myLp}  상대 LP: ${opLp}`, {
      fontSize: '24px', color: '#ffffff',
    }).setOrigin(0.5);

    // 다시하기
    const retry = this.add.text(width / 2, height * 0.65, '다시 하기', {
      fontSize: '22px', color: '#88aaff',
    }).setOrigin(0.5).setInteractive();
    retry.on('pointerdown', () => this.scene.start('GameScene', { mode: 'single' }));
    retry.on('pointerover', () => retry.setColor('#aaccff'));
    retry.on('pointerout',  () => retry.setColor('#88aaff'));

    // 메뉴로
    const menu = this.add.text(width / 2, height * 0.75, '메인 메뉴', {
      fontSize: '22px', color: '#88aaff',
    }).setOrigin(0.5).setInteractive();
    menu.on('pointerdown', () => this.scene.start('MenuScene'));
    menu.on('pointerover', () => menu.setColor('#aaccff'));
    menu.on('pointerout',  () => menu.setColor('#88aaff'));
  }
}
