import Phaser from 'phaser';
import { ART_KEYS } from '../art/ProceduralArt';
import { CardSprite } from './CardSprite';
import type { Card } from '../data/CardTypes';

const HAND_CARD_SCALE = 1.5;
const HAND_CARD_W = CardSprite.W * HAND_CARD_SCALE;
const HAND_CARD_H = CardSprite.H * HAND_CARD_SCALE;
const HAND_RAIL_W = 330;
const HAND_RAIL_H = 760;

export class HandArea extends Phaser.GameObjects.Container {
  private sprites: CardSprite[] = [];
  private selectedSprite: CardSprite | null = null;
  private rail: Phaser.GameObjects.Image;
  private playableIds = new Set<string>();

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private onCardSelect: (card: Card, sprite: CardSprite) => void
  ) {
    super(scene, x, y);
    scene.add.existing(this);
    this.rail = scene.add.image(0, 0, ART_KEYS.panel).setDisplaySize(HAND_RAIL_W, HAND_RAIL_H).setAlpha(0.86);
    this.add(this.rail);
  }

  setHand(hand: Card[]): void {
    for (const s of this.sprites) s.destroy();
    this.sprites = [];
    this.selectedSprite = null;
    this.layoutCards(hand);
  }

  setPlayableCards(cardIds: Set<string>): void {
    this.playableIds = new Set(cardIds);
    for (const sprite of this.sprites) {
      sprite.setPlayable(this.playableIds.has(sprite.card.id));
    }
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
    const gap = total > 6 ? 68 : 92;
    const startY = -((total - 1) * gap) / 2;
    this.rail.setDisplaySize(HAND_RAIL_W, HAND_RAIL_H);

    for (let i = 0; i < total; i++) {
      const centerOffset = i - (total - 1) / 2;
      const sprite = new CardSprite(this.scene, centerOffset * 14, startY + i * gap, hand[i]);
      sprite.setBaseScale(HAND_CARD_SCALE);
      sprite.setRotation(Phaser.Math.DegToRad(centerOffset * 3.5));
      sprite.setPlayable(this.playableIds.has(hand[i].id));
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
    const gap = total > 6 ? 68 : 92;
    const startY = -((total - 1) * gap) / 2;
    this.rail.setDisplaySize(HAND_RAIL_W, HAND_RAIL_H);
    this.sprites.forEach((s, i) => {
      const centerOffset = i - (total - 1) / 2;
      this.scene.tweens.add({
        targets: s,
        x: centerOffset * 14,
        y: startY + i * gap,
        rotation: Phaser.Math.DegToRad(centerOffset * 3.5),
        duration: 180,
        ease: 'Sine.easeOut',
      });
    });
  }
}
