import Phaser from 'phaser';
import { ART_KEYS, addSceneBackdrop } from '../art/ProceduralArt';
import { CardSprite } from '../components/CardSprite';
import type { Card } from '../data/CardTypes';
import { ALL_CARDS } from './BootScene';

const STORAGE_KEY = 'yugioh_deck';

export class DeckBuilderScene extends Phaser.Scene {
  private deck: Card[] = [];
  private deckTexts: Phaser.GameObjects.Text[] = [];
  private countText!: Phaser.GameObjects.Text;
  private saveBtn!: Phaser.GameObjects.Image;

  constructor() { super('DeckBuilderScene'); }

  create(): void {
    const { width, height } = this.scale;
    addSceneBackdrop(this);

    const saved = localStorage.getItem(STORAGE_KEY);
    this.deck = saved ? JSON.parse(saved) : [];

    this.add.text(26, 18, 'DECK BUILDER', {
      fontSize: '30px',
      color: '#f2c86a',
      fontStyle: 'bold',
      stroke: '#170b0f',
      strokeThickness: 4,
    });
    this.add.text(width - 28, 24, 'MAIN MENU', {
      fontSize: '15px',
      color: '#b8c7e8',
      fontStyle: 'bold',
    }).setOrigin(1, 0).setInteractive()
      .on('pointerdown', () => this.scene.start('MenuScene'));

    this.add.image(width - 175, height / 2, ART_KEYS.panel).setDisplaySize(300, 560);
    this.add.text(28, 68, 'Card Archive', { fontSize: '16px', color: '#b8c7e8', fontStyle: 'bold' });

    ALL_CARDS.forEach((card, i) => {
      const col = Math.floor(i / 4);
      const row = i % 4;
      const x = 78 + col * 108;
      const y = 150 + row * 142;
      const sprite = new CardSprite(this, x, y, card);
      this.add.existing(sprite);
      sprite.setInteractive();
      sprite.on('pointerdown', () => this.addToDeck(card));
      sprite.on('pointerover', () => sprite.highlight(true));
      sprite.on('pointerout', () => sprite.highlight(false));
    });

    this.add.text(width - 295, 78, 'Current Deck', { fontSize: '17px', color: '#f2c86a', fontStyle: 'bold' });
    this.countText = this.add.text(width - 295, 105, '', { fontSize: '14px', color: '#ffffff' });

    this.saveBtn = this.add.image(width - 175, height - 58, ART_KEYS.button).setDisplaySize(230, 48).setInteractive();
    this.add.text(width - 175, height - 58, 'SAVE AND DUEL', {
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.saveBtn.on('pointerdown', () => this.saveAndStart());

    this.refreshDeckList();
  }

  private addToDeck(card: Card): void {
    const count = this.deck.filter(c => c.id === card.id).length;
    if (count >= 2 || this.deck.length >= 12) return;
    this.deck.push(card);
    this.refreshDeckList();
  }

  private removeFromDeck(index: number): void {
    this.deck.splice(index, 1);
    this.refreshDeckList();
  }

  private refreshDeckList(): void {
    for (const t of this.deckTexts) t.destroy();
    this.deckTexts = [];

    const { width } = this.scale;
    this.countText.setText(`${this.deck.length} / 8-12 cards`);

    this.deck.forEach((card, i) => {
      const t = this.add.text(width - 292, 138 + i * 26, `${i + 1}. ${card.name}`, {
        fontSize: '13px',
        color: '#d8e7ff',
      }).setInteractive();
      t.on('pointerdown', () => this.removeFromDeck(i));
      t.on('pointerover', () => t.setColor('#ff9ab7'));
      t.on('pointerout', () => t.setColor('#d8e7ff'));
      this.deckTexts.push(t);
    });

    const valid = this.deck.length >= 8 && this.deck.length <= 12;
    this.saveBtn.setAlpha(valid ? 1 : 0.45);
  }

  private saveAndStart(): void {
    if (this.deck.length < 8 || this.deck.length > 12) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.deck));
    this.scene.start('GameScene', { mode: 'single', deck: this.deck });
  }
}
