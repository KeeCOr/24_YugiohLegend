import Phaser from 'phaser';
import type { Card } from '../data/CardTypes';

export class CardSprite extends Phaser.GameObjects.Container {
  card: Card;
  private bg: Phaser.GameObjects.Rectangle;
  private nameText: Phaser.GameObjects.Text;
  private atkText: Phaser.GameObjects.Text | null = null;

  static readonly W = 90;
  static readonly H = 130;

  constructor(scene: Phaser.Scene, x: number, y: number, card: Card, faceDown = false) {
    super(scene, x, y);
    this.card = card;

    const color = faceDown ? 0x444466 : card.type === 'monster' ? 0x2255aa : card.type === 'spell' ? 0x22aa55 : 0xaa5522;
    this.bg = new Phaser.GameObjects.Rectangle(scene, 0, 0, CardSprite.W, CardSprite.H, color);
    this.bg.setStrokeStyle(2, 0xffffff);
    this.add(this.bg);

    if (!faceDown) {
      this.nameText = new Phaser.GameObjects.Text(scene, 0, -30, card.name, {
        fontSize: '11px', color: '#ffffff', wordWrap: { width: CardSprite.W - 8 }, align: 'center',
      });
      this.nameText.setOrigin(0.5);
      this.add(this.nameText);

      if (card.type === 'monster' && card.atk !== undefined) {
        this.atkText = new Phaser.GameObjects.Text(scene, 0, 45, `ATK ${card.atk}`, {
          fontSize: '12px', color: '#ffdd88',
        });
        this.atkText.setOrigin(0.5);
        this.add(this.atkText);
      }
    } else {
      this.nameText = new Phaser.GameObjects.Text(scene, 0, 0, '?', { fontSize: '28px', color: '#888888' });
      this.nameText.setOrigin(0.5);
      this.add(this.nameText);
    }

  }

  highlight(on: boolean): void {
    this.bg.setStrokeStyle(on ? 3 : 2, on ? 0xffff00 : 0xffffff);
  }
}
