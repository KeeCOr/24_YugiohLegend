import Phaser from 'phaser';
import type { Card } from '../data/CardTypes';
import { ART_KEYS, cardTextureKey, typeTint } from '../art/ProceduralArt';

export class CardSprite extends Phaser.GameObjects.Container {
  card: Card;
  private glow: Phaser.GameObjects.Image;
  private faceDown: boolean;

  static readonly W = 90;
  static readonly H = 130;

  constructor(scene: Phaser.Scene, x: number, y: number, card: Card, faceDown = false) {
    super(scene, x, y);
    this.card = card;
    this.faceDown = faceDown;

    this.glow = new Phaser.GameObjects.Image(scene, 0, 0, ART_KEYS.glow);
    this.glow.setDisplaySize(CardSprite.W + 22, CardSprite.H + 22).setAlpha(0);
    this.add(this.glow);

    const frame = new Phaser.GameObjects.Image(
      scene,
      0,
      0,
      faceDown ? ART_KEYS.cardBack : cardTextureKey(card.type)
    );
    frame.setDisplaySize(CardSprite.W, CardSprite.H);
    this.add(frame);

    if (faceDown) {
      const mark = new Phaser.GameObjects.Text(scene, 0, 0, 'YL', {
        fontSize: '22px',
        color: '#e8bd63',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      this.add(mark);
      return;
    }

    this.add(this.createSymbol(scene, card.id, card.type));

    const tint = typeTint(card.type);
    const roleColor = this.getRoleColor(card);
    const badge = new Phaser.GameObjects.Text(scene, -34, -52, card.type.toUpperCase(), {
      fontSize: '6px',
      color: '#111111',
      backgroundColor: Phaser.Display.Color.IntegerToColor(tint).rgba,
      padding: { left: 3, right: 3, top: 1, bottom: 1 },
    }).setOrigin(0, 0.5);
    this.add(badge);

    const roleLabel = this.getRoleLabel(card);
    if (card.type === 'monster' && roleLabel) {
      const role = new Phaser.GameObjects.Text(scene, 34, -52, roleLabel, {
        fontSize: '5px',
        color: '#111111',
        backgroundColor: Phaser.Display.Color.IntegerToColor(roleColor).rgba,
        padding: { left: 3, right: 3, top: 1, bottom: 1 },
      }).setOrigin(1, 0.5);
      this.add(role);
    }

    const nameText = new Phaser.GameObjects.Text(scene, 0, 20, card.name, {
      fontSize: '9px',
      color: '#f8f0d8',
      wordWrap: { width: CardSprite.W - 12 },
      align: 'center',
    }).setOrigin(0.5);
    this.add(nameText);

    const actionLabel = this.getActionLabel(card);
    const actionText = new Phaser.GameObjects.Text(scene, 0, card.abilityText ? 34 : 38, actionLabel, {
      fontSize: '7px',
      color: card.type === 'monster' && (card.tributeCost ?? 0) > 0 ? '#ffb1c0' : '#a9f4d0',
      fontStyle: 'bold',
      stroke: '#10090d',
      strokeThickness: 2,
    }).setOrigin(0.5);
    this.add(actionText);

    if (card.abilityText) {
      const ability = new Phaser.GameObjects.Text(scene, 0, 44, card.abilityText.toUpperCase(), {
        fontSize: '6px',
        color: '#c8d9ff',
        fontStyle: 'bold',
        stroke: '#10090d',
        strokeThickness: 2,
      }).setOrigin(0.5);
      this.add(ability);
    }

    if (card.type === 'monster') {
      this.addStatGem(scene, -28, 53, String(card.atk ?? 0), 0xf2b94b, 'ATK');
      this.addStatGem(scene, 28, 53, String(card.hp ?? 1), 0xe94d64, 'HP');
    }
  }

  setPreview(on = true): void {
    this.setAlpha(on ? 0.58 : 1);
    if (on) this.setScale(0.92);
  }

  private getActionLabel(card: Card): string {
    if (card.type === 'monster') {
      const tributeCost = card.tributeCost ?? 0;
      return tributeCost > 0 ? `TRIBUTE x${tributeCost}` : 'FREE SUMMON';
    }
    return card.type === 'spell' ? 'CAST' : 'SET TRAP';
  }

  private getRoleColor(card: Card): number {
    switch (card.tributeRole) {
      case 'bruiser':
        return 0xffcf5a;
      case 'ally_booster':
        return 0x9cff8f;
      case 'field_booster':
        return 0x8fc9ff;
      case 'mobile':
        return 0xf3a6ff;
      case 'tribute_scaler':
        return 0xff8f8f;
    }
    switch (card.monsterRole) {
      case 'striker':
        return 0xff9a52;
      case 'guardian':
        return 0x89d4ff;
      case 'utility':
        return 0xd7a6ff;
      default:
        return typeTint(card.type);
    }
  }

  private getRoleLabel(card: Card): string | null {
    switch (card.tributeRole) {
      case 'bruiser':
        return 'BRUISER';
      case 'ally_booster':
        return 'ALLY+';
      case 'field_booster':
        return 'FIELD+';
      case 'mobile':
        return 'MOBILE';
      case 'tribute_scaler':
        return 'SCALER';
      default:
        return card.monsterRole ? card.monsterRole.toUpperCase() : null;
    }
  }

  private addStatGem(
    scene: Phaser.Scene,
    x: number,
    y: number,
    value: string,
    color: number,
    label: string
  ): void {
    const gem = new Phaser.GameObjects.Arc(scene, x, y, 13, 0, 360, false, color, 1);
    gem.setStrokeStyle(2, 0x1b1117, 0.9);
    this.add(gem);

    const valueText = new Phaser.GameObjects.Text(scene, x, y - 1, value, {
      fontSize: '10px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#160d12',
      strokeThickness: 2,
    }).setOrigin(0.5);
    this.add(valueText);

    const labelText = new Phaser.GameObjects.Text(scene, x, y + 14, label, {
      fontSize: '5px',
      color: '#d8e7ff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.add(labelText);
  }

  canBeSelected(): boolean {
    return !this.faceDown;
  }

  setQueued(on: boolean): void {
    this.setAlpha(on ? 0.45 : 1);
    if (on) {
      const queued = new Phaser.GameObjects.Text(this.scene, 0, -2, 'QUEUED', {
        fontSize: '11px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0.5);
      queued.setName('queued-label');
      this.add(queued);
    }
  }

  highlight(on: boolean): void {
    this.glow.setAlpha(on ? 0.9 : 0);
    this.setScale(on ? 1.07 : 1);
  }

  private createSymbol(scene: Phaser.Scene, id: string, type: Card['type']): Phaser.GameObjects.Container {
    const box = new Phaser.GameObjects.Container(scene, 0, -24);
    const tint = typeTint(type);
    const g = new Phaser.GameObjects.Graphics(scene);
    g.fillStyle(0x05070c, 0.25);
    g.fillRoundedRect(-31, -25, 62, 42, 4);
    g.lineStyle(2, tint, 0.65);

    if (type === 'monster') {
      g.strokeCircle(0, -3, 16);
      g.lineBetween(-14, 13, 0, -23);
      g.lineBetween(14, 13, 0, -23);
      g.fillStyle(tint, 0.9);
      g.fillCircle(-6, -5, 2);
      g.fillCircle(6, -5, 2);
    } else if (type === 'spell') {
      g.strokeCircle(0, -4, 17);
      g.lineBetween(-18, -4, 18, -4);
      g.lineBetween(0, -22, 0, 14);
      g.strokeCircle(0, -4, 7);
    } else {
      g.strokeTriangle(0, -24, -20, 14, 20, 14);
      g.lineBetween(-10, -4, 10, -4);
      g.lineBetween(0, -14, 0, 9);
    }

    const sig = new Phaser.GameObjects.Text(scene, 0, 20, id.slice(0, 3).toUpperCase(), {
      fontSize: '7px',
      color: '#d8e7ff',
    }).setOrigin(0.5);
    box.add([g, sig]);
    return box;
  }
}
