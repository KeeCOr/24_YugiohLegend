import Phaser from 'phaser';

export class LPDisplay extends Phaser.GameObjects.Container {
  private label: Phaser.GameObjects.Text;
  private bar: Phaser.GameObjects.Rectangle;
  private barBg: Phaser.GameObjects.Rectangle;
  private lp = 4000;
  private maxLp = 4000;

  constructor(scene: Phaser.Scene, x: number, y: number, private playerName: string) {
    super(scene, x, y);
    scene.add.existing(this);

    this.barBg = scene.add.rectangle(0, 0, 200, 20, 0x333333).setOrigin(0, 0.5);
    this.bar   = scene.add.rectangle(0, 0, 200, 20, 0x22cc44).setOrigin(0, 0.5);
    this.label = scene.add.text(205, 0, `${playerName}: ${this.lp}`, {
      fontSize: '16px', color: '#ffffff',
    }).setOrigin(0, 0.5);

    this.add([this.barBg, this.bar, this.label]);
  }

  update(lp: number): void {
    this.lp = lp;
    const ratio = Math.max(0, lp / this.maxLp);
    this.bar.setSize(200 * ratio, 20);
    const color = ratio > 0.5 ? 0x22cc44 : ratio > 0.25 ? 0xffaa00 : 0xcc2222;
    this.bar.setFillStyle(color);
    this.label.setText(`${this.playerName}: ${Math.max(0, lp)}`);
  }
}
