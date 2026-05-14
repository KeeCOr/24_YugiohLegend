import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { DeckBuilderScene } from './scenes/DeckBuilderScene';
import { GameScene } from './scenes/GameScene';
import { ResultScene } from './scenes/ResultScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  backgroundColor: '#1a1a2e',
  scene: [BootScene, MenuScene, DeckBuilderScene, GameScene, ResultScene],
  parent: document.body,
};

new Phaser.Game(config);
