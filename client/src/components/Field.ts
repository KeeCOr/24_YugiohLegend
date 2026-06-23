import Phaser from 'phaser';
import { ART_KEYS, cardArtKey } from '../art/ProceduralArt';
import { CardSprite } from './CardSprite';
import type { Card, LaneIndex, LaneState, PlayerIndex } from '../data/CardTypes';

const LANE_COUNT = 3;
const LANE_W = 160;
const LANE_H = 210;
const LANE_GAP = 38;
const FIELD_CARD_SCALE = 1.0;

export class Field extends Phaser.GameObjects.Container {
  private laneImages: Phaser.GameObjects.Image[] = [];
  private laneGlows: Phaser.GameObjects.Image[] = [];
  private monsterSprites: (CardSprite | null)[] = Array(LANE_COUNT).fill(null);
  private pendingSprites: (CardSprite | null)[] = Array(LANE_COUNT).fill(null);
  private lockedOverlays: Phaser.GameObjects.Container[] = [];
  private spellIndicators: Phaser.GameObjects.Container[] = [];
  private faceDownSpellIndicators: Phaser.GameObjects.Container[] = [];
  private tributeMarkers: Phaser.GameObjects.Container[] = [];
  private guidedLanes = new Set<number>();
  private tributeLanes = new Set<number>();

  constructor(scene: Phaser.Scene, x: number, y: number, public playerIndex: PlayerIndex) {
    super(scene, x, y);
    scene.add.existing(this);
    this.buildLanes(scene);
  }

  private buildLanes(scene: Phaser.Scene): void {
    for (let i = 0; i < LANE_COUNT; i++) {
      const lx = this.getLaneLocalX(i);
      const glow = scene.add.image(lx, 0, ART_KEYS.glow).setDisplaySize(210, 252).setAlpha(0);
      const laneFrame = scene.add.image(lx, 0, ART_KEYS.laneFrame).setDisplaySize(186, 238).setAlpha(0.9);
      const lane = scene.add.image(lx, 0, this.playerIndex === 0 ? ART_KEYS.lane : ART_KEYS.laneEnemy);
      lane.setDisplaySize(LANE_W, LANE_H);
      this.add([glow, laneFrame, lane]);
      this.laneGlows.push(glow);
      this.laneImages.push(lane);

      const faceDown = this.createFaceDownSpellIndicator(scene, lx, LANE_H / 2 - 24);
      faceDown.setVisible(false);
      this.add(faceDown);
      this.faceDownSpellIndicators.push(faceDown);

      const spell = this.createSpellIndicator(scene, lx, LANE_H / 2 - 54);
      spell.setVisible(false);
      this.add(spell);
      this.spellIndicators.push(spell);

      const label = scene.add.text(lx, -LANE_H / 2 + 16, `LANE ${i + 1}`, {
        fontSize: '11px',
        color: this.playerIndex === 0 ? '#7fc8ff' : '#ff9ab7',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      this.add(label);

      const locked = this.createLockedOverlay(scene, lx, i);
      this.add(locked);
      this.lockedOverlays.push(locked);

      const tributeMarker = this.createTributeMarker(scene, lx);
      tributeMarker.setVisible(false);
      this.add(tributeMarker);
      this.tributeMarkers.push(tributeMarker);
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
        sprite.setBaseScale(FIELD_CARD_SCALE);
        this.add(sprite);
        this.monsterSprites[i] = sprite;
      }

      this.faceDownSpellIndicators[i].setVisible(lane.faceDownSpell !== null);
      const faceDownArt = this.faceDownSpellIndicators[i].getByName('face-down-art') as Phaser.GameObjects.Image | null;
      if (lane.faceDownSpell) {
        faceDownArt?.setTexture(cardArtKey(lane.faceDownSpell.id));
      }
      this.spellIndicators[i].setVisible(lane.spell !== null);
      const spellArt = this.spellIndicators[i].getByName('spell-art') as Phaser.GameObjects.Image | null;
      if (lane.spell) {
        spellArt?.setTexture(cardArtKey(lane.spell.card.id));
      }
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
    sprite.setBaseScale(FIELD_CARD_SCALE);
    sprite.setPreview(true);
    this.add(sprite);
    this.pendingSprites[laneIndex] = sprite;
  }

  clearPending(laneIndex?: LaneIndex): void {
    const indexes = laneIndex === undefined ? Array.from({ length: LANE_COUNT }, (_, i) => i) : [laneIndex];
    for (const i of indexes) {
      if (this.pendingSprites[i]) {
        this.pendingSprites[i]!.destroy();
        this.pendingSprites[i] = null;
      }
    }
  }

  highlightLane(laneIndex: number, on: boolean): void {
    if (this.lockedOverlays[laneIndex].visible) return;
    const guided = this.guidedLanes.has(laneIndex);
    this.laneGlows[laneIndex].setAlpha(on ? 0.72 : guided ? 0.36 : 0);
    this.laneImages[laneIndex].setTint(on ? 0xfff1a6 : guided ? 0x9cffc8 : 0xffffff);
  }

  setGuidedLanes(lanes: LaneIndex[] = []): void {
    this.guidedLanes = new Set(lanes);
    for (let i = 0; i < LANE_COUNT; i++) {
      if (this.lockedOverlays[i].visible) {
        this.laneGlows[i].setAlpha(0);
        continue;
      }
      const guided = this.guidedLanes.has(i);
      this.laneGlows[i].setAlpha(guided ? 0.36 : 0);
      this.laneImages[i].setTint(guided ? 0x9cffc8 : 0xffffff);
    }
  }

  setTributeLanes(lanes: LaneIndex[] = []): void {
    this.tributeLanes = new Set(lanes);
    for (let i = 0; i < LANE_COUNT; i++) {
      const shouldShow = this.tributeLanes.has(i) && this.monsterSprites[i] !== null;
      this.tributeMarkers[i].setVisible(shouldShow);
      if (shouldShow) this.laneImages[i].setTint(0xffd36f);
      else this.laneImages[i].setTint(this.guidedLanes.has(i) ? 0x9cffc8 : 0xffffff);
    }
  }

  private createFaceDownSpellIndicator(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
    const c = scene.add.container(x, y);
    const back = scene.add.image(0, 0, ART_KEYS.cardBack).setDisplaySize(36, 50).setAlpha(0.96);
    const diamond = scene.add.polygon(0, 0, [0, -18, 20, 0, 0, 18, -20, 0], 0xd281ee, 0.28);
    diamond.setStrokeStyle(2, 0xffe0ff, 0.95);
    const art = scene.add.image(0, 0, ART_KEYS.cardBack).setDisplaySize(30, 40).setAlpha(0.45);
    art.setName('face-down-art');
    const text = scene.add.text(0, 0, '?', {
      fontSize: '11px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#14071b',
      strokeThickness: 3,
    }).setOrigin(0.5);
    c.add([back, art, diamond, text]);
    return c;
  }

  private createSpellIndicator(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
    const c = scene.add.container(x, y);
    const art = scene.add.image(0, 0, ART_KEYS.glow).setDisplaySize(40, 40);
    art.setName('spell-art');
    const circle = scene.add.circle(0, 0, 19, 0x61d79d, 0.24);
    circle.setStrokeStyle(2, 0xd6ffe8, 0.95);
    const text = scene.add.text(0, 0, '', {
      fontSize: '12px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#062013',
      strokeThickness: 3,
    }).setOrigin(0.5);
    text.setName('spell-count');
    c.add([art, circle, text]);
    return c;
  }

  private createLockedOverlay(scene: Phaser.Scene, x: number, laneIndex: number): Phaser.GameObjects.Container {
    const c = scene.add.container(x, 0);
    const veil = scene.add.rectangle(0, 0, LANE_W, LANE_H, 0x05070c, 0.62);
    veil.setStrokeStyle(2, 0x5d667a, 0.65);
    const unlockTurn = laneIndex + 1;
    const label = scene.add.text(0, -6, `LOCKED\nT${unlockTurn}`, {
      fontSize: '16px',
      color: '#aab6ca',
      fontStyle: 'bold',
      align: 'center',
      stroke: '#080b10',
      strokeThickness: 3,
    }).setOrigin(0.5);
    c.add([veil, label]);
    return c;
  }

  private createTributeMarker(scene: Phaser.Scene, x: number): Phaser.GameObjects.Container {
    const c = scene.add.container(x, 0);
    const veil = scene.add.rectangle(0, 0, LANE_W, LANE_H, 0x2c0d11, 0.34);
    veil.setStrokeStyle(4, 0xffd36f, 0.92);
    const tag = scene.add.image(0, -LANE_H / 2 + 52, ART_KEYS.buttonPrimary).setDisplaySize(142, 38).setAlpha(0.94);
    const label = scene.add.text(0, -LANE_H / 2 + 52, 'TRIBUTE', {
      fontSize: '14px',
      color: '#fff6d8',
      fontStyle: 'bold',
      stroke: '#17080a',
      strokeThickness: 3,
    }).setOrigin(0.5);
    c.add([veil, tag, label]);
    c.setDepth(50);
    return c;
  }

  private getLaneLocalX(laneIndex: number): number {
    return (laneIndex - (LANE_COUNT - 1) / 2) * (LANE_W + LANE_GAP);
  }
}
