import Phaser from 'phaser';
import { ART_KEYS } from '../art/ProceduralArt';
import { CardSprite } from './CardSprite';
import type { Card } from '../data/CardTypes';

const HAND_RAIL_W = 1060;
const HAND_RAIL_H = 240;
const HAND_LAYOUTS = {
  few: { scale: 1.05, gapX: 152, angle: 4.0 },
  many: { scale: 0.88, gapX: 118, angle: 3.2 },
};
const DRAG_THRESHOLD = 8;

export class HandArea extends Phaser.GameObjects.Container {
  private sprites: CardSprite[] = [];
  private selectedSprite: CardSprite | null = null;
  private rail: Phaser.GameObjects.Image;
  private countText: Phaser.GameObjects.Text;
  private playableIds = new Set<string>();

  private dragGhost: CardSprite | null = null;
  private dragCard: Card | null = null;
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private onCardSelect: (card: Card, sprite: CardSprite) => void,
    private onCardHover?: (card: Card, sprite: CardSprite) => void,
    private onCardOut?: () => void,
    private onCardDrop?: (card: Card, worldX: number, worldY: number) => void
  ) {
    super(scene, x, y);
    scene.add.existing(this);
    this.setDepth(1000);
    this.rail = scene.add.image(0, 0, ART_KEYS.handRail).setDisplaySize(HAND_RAIL_W, HAND_RAIL_H).setAlpha(0.96);
    const title = scene.add.text(-HAND_RAIL_W / 2 + 65, -HAND_RAIL_H / 2 + 30, 'HAND', {
      fontSize: '20px',
      color: '#f2c86a',
      fontStyle: 'bold',
      stroke: '#120912',
      strokeThickness: 4,
    }).setOrigin(0.5);
    this.countText = scene.add.text(-HAND_RAIL_W / 2 + 65, -HAND_RAIL_H / 2 + 55, '0 CARDS', {
      fontSize: '13px',
      color: '#d8e7ff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.add([this.rail, title, this.countText]);
  }

  setHand(hand: Card[]): void {
    this.cleanupDrag();
    for (const s of this.sprites) s.destroy();
    this.sprites = [];
    this.selectedSprite = null;
    this.countText.setText(`${hand.length} CARD${hand.length === 1 ? '' : 'S'}`);
    this.layoutCards(hand);
  }

  setPlayableCards(cardIds: Set<string>): void {
    this.playableIds = new Set(cardIds);
    for (const sprite of this.sprites) {
      const playable = this.playableIds.has(sprite.card.id);
      sprite.setPlayable(playable);
      sprite.setBlocked(!playable);
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
    const layout = total <= 5 ? HAND_LAYOUTS.few : HAND_LAYOUTS.many;
    this.rail.setDisplaySize(HAND_RAIL_W, HAND_RAIL_H);

    for (let i = 0; i < total; i++) {
      const offset = i - (total - 1) / 2;
      const sprite = new CardSprite(this.scene, offset * layout.gapX, 0, hand[i]);
      sprite.setBaseScale(layout.scale);
      sprite.setRotation(Phaser.Math.DegToRad(offset * layout.angle));
      const playable = this.playableIds.has(hand[i].id);
      sprite.setPlayable(playable);
      sprite.setBlocked(!playable);
      sprite.setInteractive(
        new Phaser.Geom.Rectangle(-CardSprite.W / 2, -CardSprite.H / 2, CardSprite.W, CardSprite.H),
        Phaser.Geom.Rectangle.Contains
      );
      sprite.setDepth(i + 1);
      sprite.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        this.selectCard(hand[i], sprite);
        this.startDrag(hand[i], pointer);
      });
      sprite.on('pointerover', () => {
        sprite.highlight(true);
        this.onCardHover?.(hand[i], sprite);
      });
      sprite.on('pointerout', () => {
        if (this.selectedSprite !== sprite) sprite.highlight(false);
        this.onCardOut?.();
      });
      this.add(sprite);
      this.sprites.push(sprite);
    }
  }

  private selectCard(card: Card, sprite: CardSprite): void {
    if (this.selectedSprite) this.selectedSprite.highlight(false);
    this.selectedSprite = sprite;
    sprite.setDepth(100);
    sprite.highlight(true);
    this.onCardSelect(card, sprite);
  }

  private startDrag(card: Card, pointer: Phaser.Input.Pointer): void {
    this.dragCard = card;
    this.dragStartX = pointer.x;
    this.dragStartY = pointer.y;
    this.isDragging = false;
    this.scene.input.on('pointermove', this.onDragMove, this);
    this.scene.input.on('pointerup', this.onDragEnd, this);
  }

  private onDragMove(pointer: Phaser.Input.Pointer): void {
    if (!this.dragCard) return;
    const dist = Phaser.Math.Distance.Between(pointer.x, pointer.y, this.dragStartX, this.dragStartY);
    if (!this.isDragging && dist > DRAG_THRESHOLD) {
      this.isDragging = true;
      this.dragGhost = new CardSprite(this.scene, pointer.worldX, pointer.worldY, this.dragCard);
      this.dragGhost.setBaseScale(0.92);
      this.dragGhost.setAlpha(0.82);
      this.dragGhost.setDepth(2000);
      this.scene.add.existing(this.dragGhost);
    }
    if (this.isDragging && this.dragGhost) {
      this.dragGhost.x = pointer.worldX;
      this.dragGhost.y = pointer.worldY;
    }
  }

  private onDragEnd(pointer: Phaser.Input.Pointer): void {
    this.scene.input.off('pointermove', this.onDragMove, this);
    this.scene.input.off('pointerup', this.onDragEnd, this);
    const wasDragging = this.isDragging;
    if (this.dragGhost) { this.dragGhost.destroy(); this.dragGhost = null; }
    this.isDragging = false;
    if (wasDragging && this.dragCard) {
      this.onCardDrop?.(this.dragCard, pointer.worldX, pointer.worldY);
    }
    this.dragCard = null;
  }

  private cleanupDrag(): void {
    this.scene.input.off('pointermove', this.onDragMove, this);
    this.scene.input.off('pointerup', this.onDragEnd, this);
    if (this.dragGhost) { this.dragGhost.destroy(); this.dragGhost = null; }
    this.dragCard = null;
    this.isDragging = false;
  }

  private reflow(): void {
    const total = this.sprites.length;
    const layout = total <= 5 ? HAND_LAYOUTS.few : HAND_LAYOUTS.many;
    this.rail.setDisplaySize(HAND_RAIL_W, HAND_RAIL_H);
    this.sprites.forEach((s, i) => {
      const offset = i - (total - 1) / 2;
      s.setBaseScale(layout.scale);
      s.setBlocked(!this.playableIds.has(s.card.id));
      s.setDepth(i + 1);
      this.scene.tweens.add({
        targets: s,
        x: offset * layout.gapX,
        y: 0,
        rotation: Phaser.Math.DegToRad(offset * layout.angle),
        duration: 180,
        ease: 'Sine.easeOut',
      });
    });
  }
}
