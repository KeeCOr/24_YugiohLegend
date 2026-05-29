import Phaser from 'phaser';
import { ART_KEYS } from '../art/ProceduralArt';
import { CardSprite } from './CardSprite';
import type { Card } from '../data/CardTypes';

const HAND_RAIL_W = 960;
const HAND_RAIL_H = 200;
const HAND_LAYOUTS = {
  few: { scale: 0.88, gapX: 148, angle: 4.5 },
  many: { scale: 0.78, gapX: 112, angle: 3.4 },
};

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
    private onCardSelect: (card: Card, sprite: CardSprite) => void,
    private onCardHover?: (card: Card, sprite: CardSprite) => void,
    private onCardOut?: () => void
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
      const sprite = new CardSprite(
        this.scene,
        offset * layout.gapX,
        0,
        hand[i]
      );
      sprite.setBaseScale(layout.scale);
      sprite.setRotation(Phaser.Math.DegToRad(offset * layout.angle));
      const playable = this.playableIds.has(hand[i].id);
      sprite.setPlayable(playable);
      sprite.setBlocked(!playable);
      sprite.setInteractive(new Phaser.Geom.Rectangle(-CardSprite.W / 2, -CardSprite.H / 2, CardSprite.W, CardSprite.H), Phaser.Geom.Rectangle.Contains);
      sprite.setDepth(i + 1);
      sprite.on('pointerdown', () => this.selectCard(hand[i], sprite));
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
