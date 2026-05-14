import Phaser from 'phaser';
import { CardSprite } from './CardSprite';
import type { Card } from '../data/CardTypes';

export class HandArea extends Phaser.GameObjects.Container {
  private sprites: CardSprite[] = [];
  private onCardSelect: (card: Card, sprite: CardSprite) => void;
  private selectedSprite: CardSprite | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number, y: number,
    onCardSelect: (card: Card, sprite: CardSprite) => void
  ) {
    super(scene, x, y);
    scene.add.existing(this);
    this.onCardSelect = onCardSelect;
  }

  setHand(hand: Card[]): void {
    for (const s of this.sprites) s.destroy();
    this.sprites = [];
    this.selectedSprite = null;

    const total = hand.length;
    const startX = -((total - 1) * (CardSprite.W + 10)) / 2;
    for (let i = 0; i < total; i++) {
      const sx = startX + i * (CardSprite.W + 10);
      const sprite = new CardSprite(this.scene, sx, 0, hand[i]);
      this.scene.add.existing(sprite);
      sprite.setInteractive();
      sprite.on('pointerdown', () => this.selectCard(hand[i], sprite));
      sprite.on('pointerover', () => sprite.highlight(true));
      sprite.on('pointerout', () => { if (this.selectedSprite !== sprite) sprite.highlight(false); });
      this.add(sprite);
      this.sprites.push(sprite);
    }
  }

  private selectCard(card: Card, sprite: CardSprite): void {
    if (this.selectedSprite) this.selectedSprite.highlight(false);
    this.selectedSprite = sprite;
    sprite.highlight(true);
    this.onCardSelect(card, sprite);
  }

  deselectAll(): void {
    if (this.selectedSprite) this.selectedSprite.highlight(false);
    this.selectedSprite = null;
  }

  removeCard(cardId: string): void {
    const idx = this.sprites.findIndex(s => s.card.id === cardId);
    if (idx < 0) return;
    this.sprites[idx].destroy();
    this.sprites.splice(idx, 1);
    // 재배치
    const total = this.sprites.length;
    const startX = -((total - 1) * (CardSprite.W + 10)) / 2;
    this.sprites.forEach((s, i) => { s.x = startX + i * (CardSprite.W + 10); });
  }
}
