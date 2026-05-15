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
  g.fillGradientStyle(0x27496d, 0x356b9d, 0x17253e, 0x27496d, 1);
  g.fillRoundedRect(0, 0, 300, 58, 8);
  g.lineStyle(2, 0xd8b56a, 0.78);
  g.strokeRoundedRect(2, 2, 296, 54, 7);
  g.lineStyle(1, 0xffffff, 0.22);
  g.lineBetween(18, 11, 282, 11);
  g.generateTexture(ART_KEYS.button, 300, 58);
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
