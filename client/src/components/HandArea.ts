import Phaser from 'phaser';
import { ART_KEYS } from '../art/ProceduralArt';
import { CardSprite } from './CardSprite';
import type { Card } from '../data/CardTypes';

const HAND_CARD_SCALE = 1.5;
const HAND_CARD_W = CardSprite.W * HAND_CARD_SCALE;
const HAND_CARD_H = CardSprite.H * HAND_CARD_SCALE;
const HAND_RAIL_W = 520;
const HAND_RAIL_H = 760;

export class HandArea extends Phaser.GameObjects.Container {
  private sprites: CardSprite[] = [];
  private selectedSprite: CardSprite | null = null;
  private rail: Phaser.GameObjects.Image;
  private countText: Phaser.GameObjects.Text;
  private playableIds = new Set<string>();

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private onCardSelect: (card: Card, sprite: CardSprite) => void
  ) {
    super(scene, x, y);
    scene.add.existing(this);
    this.setDepth(1000);
    this.rail = scene.add.image(0, 0, ART_KEYS.panel).setDisplaySize(HAND_RAIL_W, HAND_RAIL_H).setAlpha(0.86);
    const title = scene.add.text(0, -HAND_RAIL_H / 2 + 32, 'HAND', {
      fontSize: '24px',
      color: '#f2c86a',
      fontStyle: 'bold',
      stroke: '#120912',
      strokeThickness: 4,
    }).setOrigin(0.5);
    this.countText = scene.add.text(0, -HAND_RAIL_H / 2 + 62, '0 CARDS', {
      fontSize: '14px',
      color: '#d8e7ff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.add([this.rail, title, this.countText]);
  }

  setHand(hand: Card[]): void {
    for (const s of this.sprites) s.destroy();
    this.sprites = [];
    this.selectedSprite = null;
    this.countText.setText(`${hand.length} CARD${hand.length === 1 ? '' : 'S'}`);
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
    const columns = total > 4 ? 2 : 1;
    const rowGap = total > 8 ? 116 : 140;
    const colGap = 210;
    const rows = Math.ceil(total / columns);
    const startX = -((columns - 1) * colGap) / 2;
    const startY = -((rows - 1) * rowGap) / 2;
    this.rail.setDisplaySize(HAND_RAIL_W, HAND_RAIL_H);

    for (let i = 0; i < total; i++) {
      const col = i % columns;
      const row = Math.floor(i / columns);
      const sprite = new CardSprite(this.scene, startX + col * colGap, startY + row * rowGap, hand[i]);
      sprite.setBaseScale(HAND_CARD_SCALE);
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
    const columns = total > 4 ? 2 : 1;
    const rowGap = total > 8 ? 116 : 140;
    const colGap = 210;
    const rows = Math.ceil(total / columns);
    const startX = -((columns - 1) * colGap) / 2;
    const startY = -((rows - 1) * rowGap) / 2;
    this.rail.setDisplaySize(HAND_RAIL_W, HAND_RAIL_H);
    this.sprites.forEach((s, i) => {
      const col = i % columns;
      const row = Math.floor(i / columns);
      this.scene.tweens.add({
        targets: s,
        x: startX + col * colGap,
        y: startY + row * rowGap,
        rotation: 0,
        duration: 180,
        ease: 'Sine.easeOut',
      });
    });
  }
}
