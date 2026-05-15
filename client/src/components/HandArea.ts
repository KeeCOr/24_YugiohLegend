import Phaser from 'phaser';
import { ART_KEYS } from '../art/ProceduralArt';
import { CardSprite } from './CardSprite';
import type { Card } from '../data/CardTypes';

export class HandArea extends Phaser.GameObjects.Container {
  private sprites: CardSprite[] = [];
  private selectedSprite: CardSprite | null = null;
  private rail: Phaser.GameObjects.Image;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private onCardSelect: (card: Card, sprite: CardSprite) => void
  ) {
    super(scene, x, y);
    scene.add.existing(this);
    this.rail = scene.add.image(0, 12, ART_KEYS.panel).setDisplaySize(820, 140).setAlpha(0.86);
    this.add(this.rail);
  }

  setHand(hand: Card[]): void {
    for (const s of this.sprites) s.destroy();
    this.sprites = [];
    this.selectedSprite = null;
    this.layoutCards(hand);
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
    this.reflow();
  }

  private layoutCards(hand: Card[]): void {
    const total = hand.length;
    const gap = total > 6 ? 88 : CardSprite.W + 14;
    const startX = -((total - 1) * gap) / 2;
    this.rail.setDisplaySize(Math.min(840, Math.max(500, total * gap + 110)), 140);

    for (let i = 0; i < total; i++) {
      const sprite = new CardSprite(this.scene, startX + i * gap, 0, hand[i]);
      sprite.setInteractive(new Phaser.Geom.Rectangle(-CardSprite.W / 2, -CardSprite.H / 2, CardSprite.W, CardSprite.H), Phaser.Geom.Rectangle.Contains);
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

  private reflow(): void {
    const total = this.sprites.length;
    const gap = total > 6 ? 88 : CardSprite.W + 14;
    const startX = -((total - 1) * gap) / 2;
    this.rail.setDisplaySize(Math.min(840, Math.max(500, total * gap + 110)), 140);
    this.sprites.forEach((s, i) => {
      this.scene.tweens.add({ targets: s, x: startX + i * gap, duration: 180, ease: 'Sine.easeOut' });
    });
  }
}
