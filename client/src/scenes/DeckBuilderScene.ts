import Phaser from 'phaser';
import { CardSprite } from '../components/CardSprite';
import type { Card } from '../data/CardTypes';
import { ALL_CARDS } from './BootScene';

const STORAGE_KEY = 'yugioh_deck';

export class DeckBuilderScene extends Phaser.Scene {
  private deck: Card[] = [];
  private deckTexts: Phaser.GameObjects.Text[] = [];
  private countText!: Phaser.GameObjects.Text;
  private saveBtn!: Phaser.GameObjects.Rectangle;

  constructor() { super('DeckBuilderScene'); }

  create(): void {
    const { width, height } = this.scale;

    // 저장된 덱 불러오기
    const saved = localStorage.getItem(STORAGE_KEY);
    this.deck = saved ? JSON.parse(saved) : [];

    this.add.text(20, 15, '덱 빌더', { fontSize: '28px', color: '#e2b96e' });
    this.add.text(width - 20, 15, '← 메뉴로', { fontSize: '16px', color: '#aaaaaa' })
      .setOrigin(1, 0).setInteractive()
      .on('pointerdown', () => this.scene.start('MenuScene'));

    // 전체 카드 목록 (왼쪽)
    this.add.text(20, 60, '전체 카드', { fontSize: '16px', color: '#aaaaaa' });
    ALL_CARDS.forEach((card, i) => {
      const col = Math.floor(i / 6);
      const row = i % 6;
      const x = 65 + col * 110;
      const y = 90 + row * 150;
      const sprite = new CardSprite(this, x, y, card);
      this.add.existing(sprite);
      sprite.setInteractive();
      sprite.on('pointerdown', () => this.addToDeck(card));
      sprite.on('pointerover', () => sprite.highlight(true));
      sprite.on('pointerout',  () => sprite.highlight(false));
    });

    // 덱 목록 (오른쪽)
    this.add.text(width - 220, 60, '내 덱 (8~12장)', { fontSize: '16px', color: '#aaaaaa' });
    this.countText = this.add.text(width - 220, 85, `${this.deck.length}장`, { fontSize: '14px', color: '#ffffff' });

    // 저장 버튼
    this.saveBtn = this.add.rectangle(width - 100, height - 40, 160, 40, 0x225544).setInteractive();
    this.add.text(width - 100, height - 40, '저장 & 게임 시작', { fontSize: '14px', color: '#ffffff' }).setOrigin(0.5);
    this.saveBtn.on('pointerdown', () => this.saveAndStart());

    this.refreshDeckList();
  }

  private addToDeck(card: Card): void {
    const count = this.deck.filter(c => c.id === card.id).length;
    if (count >= 2) { return; } // 같은 카드 최대 2장
    if (this.deck.length >= 12) { return; }
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
    this.countText.setText(`${this.deck.length}장`);

    this.deck.forEach((card, i) => {
      const t = this.add.text(width - 210, 110 + i * 24, `${i + 1}. ${card.name}`, {
        fontSize: '13px', color: '#cccccc',
      }).setInteractive();
      t.on('pointerdown', () => this.removeFromDeck(i));
      t.on('pointerover', () => t.setColor('#ff8888'));
      t.on('pointerout',  () => t.setColor('#cccccc'));
      this.deckTexts.push(t);
    });

    const valid = this.deck.length >= 8 && this.deck.length <= 12;
    this.saveBtn.setFillStyle(valid ? 0x225544 : 0x443322);
  }

  private saveAndStart(): void {
    if (this.deck.length < 8 || this.deck.length > 12) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.deck));
    this.scene.start('GameScene', { mode: 'single', deck: this.deck });
  }
}
