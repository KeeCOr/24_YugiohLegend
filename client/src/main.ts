import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { DeckBuilderScene } from './scenes/DeckBuilderScene';
import { GameScene } from './scenes/GameScene';
import { ResultScene } from './scenes/ResultScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1600,
    height: 900,
  },
  backgroundColor: '#1a1a2e',
  scene: [BootScene, MenuScene, DeckBuilderScene, GameScene, ResultScene],
  parent: document.body,
};

new Phaser.Game(config);
