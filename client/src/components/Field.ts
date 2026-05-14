import Phaser from 'phaser';
import { CardSprite } from './CardSprite';
import type { LaneState, PlayerIndex } from '../data/CardTypes';

const LANE_W = 120;
const LANE_H = 160;
const LANE_GAP = 20;

export class Field extends Phaser.GameObjects.Container {
  private laneRects: Phaser.GameObjects.Rectangle[] = [];
  private monsterSprites: (CardSprite | null)[] = [null, null, null];
  private trapIndicators: Phaser.GameObjects.Rectangle[] = [];

  constructor(scene: Phaser.Scene, x: number, y: number, public playerIndex: PlayerIndex) {
    super(scene, x, y);
    scene.add.existing(this);
    this.buildLanes(scene);
  }

  private buildLanes(scene: Phaser.Scene): void {
    for (let i = 0; i < 3; i++) {
      const lx = (i - 1) * (LANE_W + LANE_GAP);
      const rect = scene.add.rectangle(lx, 0, LANE_W, LANE_H, 0x112233).setStrokeStyle(1, 0x445566);
      this.add(rect);
      this.laneRects.push(rect);

      // 함정 인디케이터 (작은 주황 사각형)
      const trap = scene.add.rectangle(lx, LANE_H / 2 - 12, 16, 16, 0xaa5522).setVisible(false);
      this.add(trap);
      this.trapIndicators.push(trap);

      const laneLabel = scene.add.text(lx, -LANE_H / 2 + 10, `L${i + 1}`, {
        fontSize: '12px', color: '#556677',
      }).setOrigin(0.5);
      this.add(laneLabel);
    }
  }

  updateLanes(lanes: [LaneState, LaneState, LaneState]): void {
    for (let i = 0; i < 3; i++) {
      const lane = lanes[i];

      // 기존 몬스터 스프라이트 제거
      if (this.monsterSprites[i]) {
        this.monsterSprites[i]!.destroy();
        this.monsterSprites[i] = null;
      }

      if (lane.monster) {
        const lx = (i - 1) * (LANE_W + LANE_GAP);
        const sprite = new CardSprite(this.scene, lx, 0, lane.monster);
        this.add(sprite);
        this.monsterSprites[i] = sprite;
      }

      this.trapIndicators[i].setVisible(lane.trap !== null);
    }
  }

  getLaneWorldX(laneIndex: 0 | 1 | 2): number {
    return this.x + (laneIndex - 1) * (LANE_W + LANE_GAP);
  }

  highlightLane(laneIndex: number, on: boolean): void {
    this.laneRects[laneIndex].setStrokeStyle(on ? 3 : 1, on ? 0xffff00 : 0x445566);
  }
}
