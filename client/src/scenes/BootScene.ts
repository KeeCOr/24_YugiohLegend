import Phaser from 'phaser';
import cardsJson from 'shared/cards.json';
import type { Card } from '../data/CardTypes';

export const ALL_CARDS: Card[] = cardsJson as Card[];

export class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  preload(): void {
    // 카드 배경 (직사각형 그래픽으로 대체 — 별도 이미지 에셋 불필요)
    // 실제 이미지가 있을 때 this.load.image(key, url) 추가
  }

  create(): void {
    this.scene.start('MenuScene');
  }
}
