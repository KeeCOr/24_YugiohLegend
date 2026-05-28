import Phaser from 'phaser';
import type { CardType } from '../data/CardTypes';

export const ART_KEYS = {
  backdrop: 'art_backdrop',
  cardBack: 'art_card_back',
  cardMonster: 'art_card_monster',
  cardSpell: 'art_card_spell',
  lane: 'art_lane',
  laneEnemy: 'art_lane_enemy',
  panel: 'art_panel',
  button: 'art_button',
  buttonPrimary: 'art_button_primary',
  hudFrame: 'art_hud_frame',
  handRail: 'art_hand_rail',
  laneFrame: 'art_lane_frame',
  glow: 'art_glow',
  slash: 'art_slash',
} as const;

export function registerProceduralArt(scene: Phaser.Scene): void {
  if (scene.textures.exists(ART_KEYS.backdrop)) return;

  createBackdrop(scene);
  createCardFrame(scene, ART_KEYS.cardMonster, 0x7b2f18, 0xe2a34d, 0x2f1d17);
  createCardFrame(scene, ART_KEYS.cardSpell, 0x145e46, 0x66d39f, 0x132820);
  createCardBack(scene);
  createLane(scene, ART_KEYS.lane, 0x132b3f, 0x4cb2ff);
  createLane(scene, ART_KEYS.laneEnemy, 0x351d2c, 0xff6692);
  createPanel(scene);
  createButton(scene);
  createButtonPrimary(scene);
  createHudFrame(scene);
  createHandRail(scene);
  createLaneFrame(scene);
  createGlow(scene);
  createSlash(scene);
}

export function addSceneBackdrop(scene: Phaser.Scene): Phaser.GameObjects.Image {
  registerProceduralArt(scene);
  const { width, height } = scene.scale;
  const bg = scene.add.image(width / 2, height / 2, ART_KEYS.backdrop);
  bg.setDisplaySize(width, height);
  bg.setDepth(-100);
  return bg;
}

export function cardTextureKey(type: CardType): string {
  if (type === 'monster') return ART_KEYS.cardMonster;
  return ART_KEYS.cardSpell;
}

export function cardArtKey(cardId: string): string {
  return `card_art_${cardId}`;
}

export function typeTint(type: CardType): number {
  if (type === 'monster') return 0xe6a24a;
  return 0x61d79d;
}

function createBackdrop(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillGradientStyle(0x050814, 0x101b33, 0x271025, 0x050814, 1);
  g.fillRect(0, 0, 1280, 720);

  for (let i = 0; i < 26; i++) {
    const x = 80 + ((i * 173) % 1120);
    const y = 40 + ((i * 97) % 640);
    const alpha = i % 3 === 0 ? 0.18 : 0.09;
    g.lineStyle(1, 0xd8b56a, alpha);
    g.strokeCircle(x, y, 24 + (i % 5) * 7);
    g.lineStyle(1, 0x6ec6ff, alpha * 0.6);
    g.strokeCircle(x, y, 8 + (i % 4) * 5);
  }

  g.lineStyle(2, 0xd8b56a, 0.16);
  g.strokeRoundedRect(120, 72, 1040, 576, 24);
  g.lineStyle(1, 0x6ec6ff, 0.12);
  g.strokeRoundedRect(154, 106, 972, 508, 18);
  g.generateTexture(ART_KEYS.backdrop, 1280, 720);
  g.destroy();
}

function createCardFrame(scene: Phaser.Scene, key: string, base: number, accent: number, inset: number): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0x0b0a12, 1);
  g.fillRoundedRect(0, 0, 180, 260, 12);
  g.fillGradientStyle(base, lighten(base, 34), darken(base, 42), base, 1);
  g.fillRoundedRect(6, 6, 168, 248, 10);
  g.lineStyle(3, accent, 0.9);
  g.strokeRoundedRect(8, 8, 164, 244, 9);
  g.lineStyle(1, 0xffffff, 0.22);
  g.strokeRoundedRect(14, 14, 152, 232, 6);
  g.fillGradientStyle(lighten(inset, 26), inset, darken(inset, 18), inset, 1);
  g.fillRoundedRect(20, 48, 140, 96, 5);
  g.lineStyle(2, accent, 0.55);
  g.strokeRoundedRect(20, 48, 140, 96, 5);
  g.fillStyle(0x06070c, 0.5);
  g.fillRoundedRect(20, 154, 140, 56, 5);
  g.lineStyle(1, 0xffffff, 0.12);
  for (let i = 0; i < 5; i++) g.lineBetween(30, 166 + i * 9, 150, 166 + i * 9);
  g.fillStyle(accent, 0.95);
  g.fillCircle(142, 226, 15);
  g.fillStyle(0x09090e, 0.9);
  g.fillCircle(142, 226, 9);
  g.generateTexture(key, 180, 260);
  g.destroy();
}

function createCardBack(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0x07070d, 1);
  g.fillRoundedRect(0, 0, 180, 260, 12);
  g.fillGradientStyle(0x281118, 0x5a2716, 0x15104a, 0x090916, 1);
  g.fillRoundedRect(7, 7, 166, 246, 10);
  g.lineStyle(3, 0xe4b15c, 0.9);
  g.strokeRoundedRect(10, 10, 160, 240, 8);
  g.lineStyle(2, 0x6ec6ff, 0.45);
  g.strokeCircle(90, 130, 60);
  g.strokeCircle(90, 130, 36);
  g.lineStyle(1, 0xe4b15c, 0.55);
  for (let i = 0; i < 12; i++) {
    const a = Phaser.Math.DegToRad(i * 30);
    g.lineBetween(90, 130, 90 + Math.cos(a) * 67, 130 + Math.sin(a) * 67);
  }
  g.fillStyle(0xe4b15c, 0.9);
  g.fillCircle(90, 130, 10);
  g.generateTexture(ART_KEYS.cardBack, 180, 260);
  g.destroy();
}

function createLane(scene: Phaser.Scene, key: string, base: number, accent: number): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillGradientStyle(darken(base, 18), base, 0x070b13, darken(base, 28), 0.94);
  g.fillRoundedRect(0, 0, 136, 176, 8);
  g.lineStyle(2, accent, 0.62);
  g.strokeRoundedRect(4, 4, 128, 168, 6);
  g.lineStyle(1, 0xffffff, 0.12);
  g.strokeRoundedRect(14, 18, 108, 118, 4);
  g.lineStyle(1, accent, 0.26);
  g.lineBetween(28, 40, 108, 40);
  g.lineBetween(28, 112, 108, 112);
  g.strokeCircle(68, 76, 28);
  g.fillStyle(accent, 0.35);
  g.fillCircle(68, 146, 7);
  g.generateTexture(key, 136, 176);
  g.destroy();
}

function createPanel(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillGradientStyle(0x101625, 0x18263c, 0x080a12, 0x101625, 0.94);
  g.fillRoundedRect(0, 0, 280, 56, 8);
  g.lineStyle(2, 0xd8b56a, 0.5);
  g.strokeRoundedRect(2, 2, 276, 52, 7);
  g.generateTexture(ART_KEYS.panel, 280, 56);
  g.destroy();
}

function createButton(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillGradientStyle(0x1d3656, 0x2d5b86, 0x101d31, 0x203957, 1);
  g.fillRoundedRect(0, 0, 300, 58, 8);
  g.lineStyle(2, 0x8fd8ff, 0.62);
  g.strokeRoundedRect(2, 2, 296, 54, 7);
  g.lineStyle(1, 0xffffff, 0.22);
  g.lineBetween(18, 11, 282, 11);
  g.lineStyle(1, 0x000000, 0.38);
  g.lineBetween(18, 49, 282, 49);
  g.generateTexture(ART_KEYS.button, 300, 58);
  g.destroy();
}

function createButtonPrimary(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0x070912, 1);
  g.fillRoundedRect(0, 0, 330, 86, 10);
  g.fillGradientStyle(0x5c3217, 0xb26d29, 0x1c2745, 0x3d1c2c, 1);
  g.fillRoundedRect(5, 5, 320, 76, 9);
  g.lineStyle(3, 0xf2c86a, 0.94);
  g.strokeRoundedRect(8, 8, 314, 70, 7);
  g.lineStyle(1, 0xffffff, 0.32);
  g.lineBetween(28, 17, 302, 17);
  g.lineStyle(1, 0x11070a, 0.5);
  g.lineBetween(28, 69, 302, 69);
  g.fillStyle(0xffe29a, 0.95);
  g.fillCircle(26, 43, 7);
  g.fillCircle(304, 43, 7);
  g.lineStyle(2, 0x101525, 0.74);
  g.strokeCircle(26, 43, 11);
  g.strokeCircle(304, 43, 11);
  g.generateTexture(ART_KEYS.buttonPrimary, 330, 86);
  g.destroy();
}

function createHudFrame(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0x05070c, 0.92);
  g.fillRoundedRect(0, 0, 320, 240, 10);
  g.fillGradientStyle(0x121a2c, 0x243756, 0x090c15, 0x111827, 0.96);
  g.fillRoundedRect(6, 6, 308, 228, 8);
  g.lineStyle(3, 0xd8b56a, 0.74);
  g.strokeRoundedRect(8, 8, 304, 224, 7);
  g.lineStyle(1, 0x8fd8ff, 0.28);
  g.strokeRoundedRect(18, 18, 284, 204, 4);
  g.fillGradientStyle(0xffffff, 0xffffff, 0xffffff, 0xffffff, 0.08);
  g.fillRoundedRect(18, 18, 284, 42, 4);
  g.generateTexture(ART_KEYS.hudFrame, 320, 240);
  g.destroy();
}

function createHandRail(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0x060814, 0.96);
  g.fillRoundedRect(0, 0, 430, 760, 12);
  g.fillGradientStyle(0x171425, 0x213655, 0x080b14, 0x110c1b, 0.96);
  g.fillRoundedRect(8, 8, 414, 744, 10);
  g.lineStyle(4, 0xd8b56a, 0.68);
  g.strokeRoundedRect(10, 10, 410, 740, 8);
  g.lineStyle(1, 0x8fd8ff, 0.22);
  g.strokeRoundedRect(25, 82, 380, 652, 6);
  g.fillGradientStyle(0x0b1020, 0x1f304d, 0x0a0c14, 0x0b1020, 0.9);
  g.fillRoundedRect(24, 18, 382, 74, 8);
  g.lineStyle(1, 0xffffff, 0.16);
  for (let y = 118; y < 714; y += 74) {
    g.lineBetween(42, y, 388, y);
  }
  g.fillStyle(0xf2c86a, 0.9);
  g.fillCircle(36, 52, 6);
  g.fillCircle(394, 52, 6);
  g.generateTexture(ART_KEYS.handRail, 430, 760);
  g.destroy();
}

function createLaneFrame(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0x03050a, 0.82);
  g.fillRoundedRect(0, 0, 224, 316, 12);
  g.lineStyle(4, 0xd8b56a, 0.52);
  g.strokeRoundedRect(4, 4, 216, 308, 10);
  g.lineStyle(2, 0x8fd8ff, 0.24);
  g.strokeRoundedRect(15, 15, 194, 286, 6);
  g.fillStyle(0xf2c86a, 0.78);
  g.fillCircle(23, 23, 4);
  g.fillCircle(201, 23, 4);
  g.fillCircle(23, 293, 4);
  g.fillCircle(201, 293, 4);
  g.generateTexture(ART_KEYS.laneFrame, 224, 316);
  g.destroy();
}

function createGlow(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  for (let r = 64; r > 0; r -= 8) {
    g.fillStyle(0xf5d27a, (65 - r) / 420);
    g.fillCircle(64, 64, r);
  }
  g.generateTexture(ART_KEYS.glow, 128, 128);
  g.destroy();
}

function createSlash(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.lineStyle(10, 0xfff1a6, 0.95);
  g.lineBetween(10, 80, 118, 20);
  g.lineStyle(4, 0xff4668, 0.85);
  g.lineBetween(16, 91, 124, 31);
  g.generateTexture(ART_KEYS.slash, 128, 112);
  g.destroy();
}

function lighten(color: number, amount: number): number {
  const c = Phaser.Display.Color.IntegerToColor(color);
  return Phaser.Display.Color.GetColor(
    Math.min(255, c.red + amount),
    Math.min(255, c.green + amount),
    Math.min(255, c.blue + amount)
  );
}

function darken(color: number, amount: number): number {
  const c = Phaser.Display.Color.IntegerToColor(color);
  return Phaser.Display.Color.GetColor(
    Math.max(0, c.red - amount),
    Math.max(0, c.green - amount),
    Math.max(0, c.blue - amount)
  );
}
