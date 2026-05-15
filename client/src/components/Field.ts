import Phaser from 'phaser';
import { ART_KEYS } from '../art/ProceduralArt';
import { CardSprite } from './CardSprite';
import type { Card, LaneIndex, LaneState, PlayerIndex } from '../data/CardTypes';

const LANE_COUNT = 4;
const LANE_W = 118;
const LANE_H = 176;
const LANE_GAP = 16;

export class Field extends Phaser.GameObjects.Container {
  private laneImages: Phaser.GameObjects.Image[] = [];
  private laneGlows: Phaser.GameObjects.Image[] = [];
  private monsterSprites: (CardSprite | null)[] = Array(LANE_COUNT).fill(null);
  private pendingSprites: (CardSprite | null)[] = Array(LANE_COUNT).fill(null);
  private lockedOverlays: Phaser.GameObjects.Container[] = [];
  private spellIndicators: Phaser.GameObjects.Container[] = [];
  private faceDownSpellIndicators: Phaser.GameObjects.Container[] = [];

  constructor(scene: Phaser.Scene, x: number, y: number, public playerIndex: PlayerIndex) {
    super(scene, x, y);
    scene.add.existing(this);
    this.buildLanes(scene);
  }

  private buildLanes(scene: Phaser.Scene): void {
    for (let i = 0; i < LANE_COUNT; i++) {
      const lx = this.getLaneLocalX(i);
      const glow = scene.add.image(lx, 0, ART_KEYS.glow).setDisplaySize(164, 204).setAlpha(0);
      const lane = scene.add.image(lx, 0, this.playerIndex === 0 ? ART_KEYS.lane : ART_KEYS.laneEnemy);
      lane.setDisplaySize(LANE_W, LANE_H);
      this.add([glow, lane]);
      this.laneGlows.push(glow);
      this.laneImages.push(lane);

      const faceDown = this.createFaceDownSpellIndicator(scene, lx, LANE_H / 2 - 22);
      faceDown.setVisible(false);
      this.add(faceDown);
      this.faceDownSpellIndicators.push(faceDown);

      const spell = this.createSpellIndicator(scene, lx, LANE_H / 2 - 48);
      spell.setVisible(false);
      this.add(spell);
      this.spellIndicators.push(spell);

      const label = scene.add.text(lx, -LANE_H / 2 + 14, `LANE ${i + 1}`, {
        fontSize: '10px',
        color: this.playerIndex === 0 ? '#7fc8ff' : '#ff9ab7',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      this.add(label);

      const locked = this.createLockedOverlay(scene, lx, i);
      this.add(locked);
      this.lockedOverlays.push(locked);
    }
  }

  updateLanes(lanes: LaneState[]): void {
    for (let i = 0; i < LANE_COUNT; i++) {
      const lane = lanes[i];

      if (this.monsterSprites[i]) {
        this.monsterSprites[i]!.destroy();
        this.monsterSprites[i] = null;
      }
      if (this.pendingSprites[i]) {
        this.pendingSprites[i]!.destroy();
        this.pendingSprites[i] = null;
      }

      if (lane.monster) {
        const lx = this.getLaneLocalX(i);
        const sprite = new CardSprite(this.scene, lx, -4, lane.monster);
        this.add(sprite);
        this.monsterSprites[i] = sprite;
      }

      this.faceDownSpellIndicators[i].setVisible(lane.faceDownSpell !== null);
      this.spellIndicators[i].setVisible(lane.spell !== null);
      const spellText = this.spellIndicators[i].getByName('spell-count') as Phaser.GameObjects.Text | null;
      spellText?.setText(lane.spell ? String(lane.spell.remainingTurns) : '');
    }
  }

  getLaneWorldX(laneIndex: LaneIndex): number {
    return this.x + this.getLaneLocalX(laneIndex);
  }

  hasPending(laneIndex: LaneIndex): boolean {
    return this.pendingSprites[laneIndex] !== null;
  }

  setUnlockedLanes(unlocked: LaneIndex[]): void {
    for (let i = 0; i < LANE_COUNT; i++) {
      this.lockedOverlays[i].setVisible(!unlocked.includes(i as LaneIndex));
      this.laneImages[i].setAlpha(unlocked.includes(i as LaneIndex) ? 1 : 0.45);
    }
  }

  setPendingCard(laneIndex: LaneIndex, card: Card, faceDown = false): void {
    this.clearPending(laneIndex);
    const lx = this.getLaneLocalX(laneIndex);
    const sprite = new CardSprite(this.scene, lx, -4, card, faceDown);
    sprite.setPreview(true);
    this.add(sprite);
    this.pendingSprites[laneIndex] = sprite;
  }

  clearPending(laneIndex?: LaneIndex): void {
    const indexes = laneIndex === undefined ? [0, 1, 2, 3] : [laneIndex];
    for (const i of indexes) {
      if (this.pendingSprites[i]) {
        this.pendingSprites[i]!.destroy();
        this.pendingSprites[i] = null;
      }
    }
  }

  highlightLane(laneIndex: number, on: boolean): void {
    if (this.lockedOverlays[laneIndex].visible) return;
    this.laneGlows[laneIndex].setAlpha(on ? 0.65 : 0);
    this.laneImages[laneIndex].setTint(on ? 0xfff1a6 : 0xffffff);
  }

  private createFaceDownSpellIndicator(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
    const c = scene.add.container(x, y);
    const diamond = scene.add.polygon(0, 0, [0, -10, 12, 0, 0, 10, -12, 0], 0xd281ee, 0.85);
    diamond.setStrokeStyle(2, 0xffe0ff, 0.85);
    const text = scene.add.text(0, 0, '?', {
      fontSize: '10px',
      color: '#170d1b',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    c.add([diamond, text]);
    return c;
  }

  private createSpellIndicator(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
    const c = scene.add.container(x, y);
    const circle = scene.add.circle(0, 0, 12, 0x61d79d, 0.88);
    circle.setStrokeStyle(2, 0xd6ffe8, 0.9);
    const text = scene.add.text(0, 0, '', {
      fontSize: '10px',
      color: '#082217',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    text.setName('spell-count');
    c.add([circle, text]);
    return c;
  }

  private createLockedOverlay(scene: Phaser.Scene, x: number, laneIndex: number): Phaser.GameObjects.Container {
    const c = scene.add.container(x, 0);
    const veil = scene.add.rectangle(0, 0, LANE_W, LANE_H, 0x05070c, 0.62);
    veil.setStrokeStyle(2, 0x5d667a, 0.65);
    const unlockTurn = laneIndex + 1;
    const label = scene.add.text(0, -6, `LOCKED\nT${unlockTurn}`, {
      fontSize: '13px',
      color: '#aab6ca',
      fontStyle: 'bold',
      align: 'center',
      stroke: '#080b10',
      strokeThickness: 3,
    }).setOrigin(0.5);
    c.add([veil, label]);
    return c;
  }

  private getLaneLocalX(laneIndex: number): number {
    return (laneIndex - (LANE_COUNT - 1) / 2) * (LANE_W + LANE_GAP);
  }
}
