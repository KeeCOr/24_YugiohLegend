import Phaser from 'phaser';
import { ART_KEYS } from '../art/ProceduralArt';

export class LPDisplay extends Phaser.GameObjects.Container {
  private label: Phaser.GameObjects.Text;
  private bar: Phaser.GameObjects.Rectangle;
  private lp = 4000;
  private maxLp = 4000;

  constructor(scene: Phaser.Scene, x: number, y: number, private playerName: string) {
    super(scene, x, y);
    scene.add.existing(this);

    const panel = scene.add.image(112, 0, ART_KEYS.hudFrame).setDisplaySize(238, 62);
    const barBg = scene.add.rectangle(16, 10, 188, 10, 0x090b12).setOrigin(0, 0.5);
    this.bar = scene.add.rectangle(16, 10, 188, 10, 0x28d76d).setOrigin(0, 0.5);
    this.label = scene.add.text(16, -8, `${playerName} LP ${this.lp}`, {
      fontSize: '15px',
      color: '#f8f0d8',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5);

    this.add([panel, barBg, this.bar, this.label]);
  }

  update(lp: number): void {
    this.lp = lp;
    const ratio = Phaser.Math.Clamp(lp / this.maxLp, 0, 1);
    this.bar.setSize(188 * ratio, 10);
    const color = ratio > 0.5 ? 0x28d76d : ratio > 0.25 ? 0xffb84a : 0xff4e5f;
    this.bar.setFillStyle(color);
    this.label.setText(`${this.playerName} LP ${Math.max(0, lp)}`);
  }
}
