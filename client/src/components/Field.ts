import Phaser from 'phaser';
import { ART_KEYS } from '../art/ProceduralArt';
import { CardSprite } from './CardSprite';
import type { Card, LaneIndex, LaneState, PlayerIndex } from '../data/CardTypes';

const LANE_W = 136;
const LANE_H = 176;
const LANE_GAP = 24;

export class Field extends Phaser.GameObjects.Container {
  private laneImages: Phaser.GameObjects.Image[] = [];
  private laneGlows: Phaser.GameObjects.Image[] = [];
  private monsterSprites: (CardSprite | null)[] = [null, null, null];
  private pendingSprites: (CardSprite | null)[] = [null, null, null];
  private trapIndicators: Phaser.GameObjects.Container[] = [];

  constructor(scene: Phaser.Scene, x: number, y: number, public playerIndex: PlayerIndex) {
    super(scene, x, y);
    scene.add.existing(this);
    this.buildLanes(scene);
  }

  private buildLanes(scene: Phaser.Scene): void {
    for (let i = 0; i < 3; i++) {
      const lx = (i - 1) * (LANE_W + LANE_GAP);
      const glow = scene.add.image(lx, 0, ART_KEYS.glow).setDisplaySize(164, 204).setAlpha(0);
      const lane = scene.add.image(lx, 0, this.playerIndex === 0 ? ART_KEYS.lane : ART_KEYS.laneEnemy);
      lane.setDisplaySize(LANE_W, LANE_H);
      this.add([glow, lane]);
      this.laneGlows.push(glow);
      this.laneImages.push(lane);

      const trap = this.createTrapIndicator(scene, lx, LANE_H / 2 - 22);
      trap.setVisible(false);
      this.add(trap);
      this.trapIndicators.push(trap);

      const label = scene.add.text(lx, -LANE_H / 2 + 14, `LANE ${i + 1}`, {
        fontSize: '10px',
        color: this.playerIndex === 0 ? '#7fc8ff' : '#ff9ab7',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      this.add(label);
    }
  }

  updateLanes(lanes: [LaneState, LaneState, LaneState]): void {
    for (let i = 0; i < 3; i++) {
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
        const lx = (i - 1) * (LANE_W + LANE_GAP);
        const sprite = new CardSprite(this.scene, lx, -4, lane.monster);
        this.add(sprite);
        this.monsterSprites[i] = sprite;
      }

      this.trapIndicators[i].setVisible(lane.trap !== null);
    }
  }

  getLaneWorldX(laneIndex: 0 | 1 | 2): number {
    return this.x + (laneIndex - 1) * (LANE_W + LANE_GAP);
  }

  hasPending(laneIndex: LaneIndex): boolean {
    return this.pendingSprites[laneIndex] !== null;
  }

  setPendingCard(laneIndex: LaneIndex, card: Card, faceDown = false): void {
    this.clearPending(laneIndex);
    const lx = (laneIndex - 1) * (LANE_W + LANE_GAP);
    const sprite = new CardSprite(this.scene, lx, -4, card, faceDown);
    sprite.setPreview(true);
    this.add(sprite);
    this.pendingSprites[laneIndex] = sprite;
  }

  clearPending(laneIndex?: LaneIndex): void {
    const indexes = laneIndex === undefined ? [0, 1, 2] : [laneIndex];
    for (const i of indexes) {
      if (this.pendingSprites[i]) {
        this.pendingSprites[i]!.destroy();
        this.pendingSprites[i] = null;
      }
    }
  }

  highlightLane(laneIndex: number, on: boolean): void {
    this.laneGlows[laneIndex].setAlpha(on ? 0.65 : 0);
    this.laneImages[laneIndex].setTint(on ? 0xfff1a6 : 0xffffff);
  }

  private createTrapIndicator(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
    const c = scene.add.container(x, y);
    const diamond = scene.add.polygon(0, 0, [0, -10, 12, 0, 0, 10, -12, 0], 0xd281ee, 0.85);
    diamond.setStrokeStyle(2, 0xffe0ff, 0.85);
    const text = scene.add.text(0, 0, 'T', {
      fontSize: '10px',
      color: '#170d1b',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    c.add([diamond, text]);
    return c;
  }
}
