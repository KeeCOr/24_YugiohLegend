import Phaser from 'phaser';
import { ART_KEYS, addSceneBackdrop } from '../art/ProceduralArt';
import { CardSprite } from '../components/CardSprite';
import type { Card } from '../data/CardTypes';
import {
  MAX_DECK_SIZE,
  MIN_DECK_SIZE,
  getDeckSummary,
  getSavedDeck,
  getStarterDeck,
  isValidDeck,
  saveDeck,
} from '../data/DeckStorage';
import { ALL_CARDS } from './BootScene';

export class DeckBuilderScene extends Phaser.Scene {
  private deck: Card[] = [];
  private deckTexts: Phaser.GameObjects.Text[] = [];
  private countText!: Phaser.GameObjects.Text;
  private deckStatsTxt!: Phaser.GameObjects.Text;
  private statusTxt!: Phaser.GameObjects.Text;
  private saveDeckBtn!: Phaser.GameObjects.Image;
  private duelBtn!: Phaser.GameObjects.Image;

  constructor() { super('DeckBuilderScene'); }

  create(): void {
    const { width, height } = this.scale;
    addSceneBackdrop(this);

    this.deck = getSavedDeck();

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

    this.add.text(48, 56, 'Deck Process', { fontSize: '15px', color: '#f2c86a', fontStyle: 'bold' });
    this.add.text(48, 78, '1 Pick unique cards  >  2 Build 8-12  >  3 Save deck  >  4 Duel', {
      fontSize: '14px',
      color: '#b8c7e8',
    });

    this.add.image(width * 0.36, height * 0.52, ART_KEYS.panel).setDisplaySize(1030, 720).setAlpha(0.78);
    this.add.image(width * 0.82, height * 0.52, ART_KEYS.panel).setDisplaySize(450, 720).setAlpha(0.78);
    this.add.text(48, 112, 'Card Archive', { fontSize: '18px', color: '#b8c7e8', fontStyle: 'bold' });

    ALL_CARDS.forEach((card, i) => {
      const col = i % 5;
      const row = Math.floor(i / 5);
      const x = 135 + col * 185;
      const y = 214 + row * 170;
      const sprite = new CardSprite(this, x, y, card);
      sprite.setBaseScale(0.86);
      this.add.existing(sprite);
      sprite.setInteractive();
      sprite.on('pointerdown', () => this.addToDeck(card));
      sprite.on('pointerover', () => sprite.highlight(true));
      sprite.on('pointerout', () => sprite.highlight(false));
    });

    this.add.text(width * 0.71, 96, 'Current Deck', { fontSize: '24px', color: '#f2c86a', fontStyle: 'bold' });
    this.countText = this.add.text(width * 0.71, 132, '', { fontSize: '18px', color: '#ffffff' });
    this.deckStatsTxt = this.add.text(width * 0.71, 158, '', {
      fontSize: '14px',
      color: '#b8c7e8',
      lineSpacing: 4,
    });
    this.statusTxt = this.add.text(width * 0.71, height - 184, '', {
      fontSize: '14px',
      color: '#fff3bf',
      wordWrap: { width: 390 },
    });

    this.createButton(width * 0.84, height - 138, 320, 58, 'AUTO FILL', () => this.autoFillDeck());
    this.saveDeckBtn = this.createButton(width * 0.77, height - 70, 190, 58, 'SAVE DECK', () => this.saveDeckOnly());
    this.duelBtn = this.createButton(width * 0.89, height - 70, 190, 58, 'SAVE AND DUEL', () => this.saveAndStart());

    this.refreshDeckList();
  }

  private addToDeck(card: Card): void {
    const count = this.deck.filter(c => c.id === card.id).length;
    if (count >= 1) {
      this.statusTxt.setText('Each card can be added once in this prototype.');
      return;
    }
    if (this.deck.length >= MAX_DECK_SIZE) {
      this.statusTxt.setText(`Deck limit is ${MAX_DECK_SIZE} cards.`);
      return;
    }
    this.deck.push(card);
    this.statusTxt.setText(`${card.name} added.`);
    this.refreshDeckList();
  }

  private removeFromDeck(index: number): void {
    const [removed] = this.deck.splice(index, 1);
    this.statusTxt.setText(`${removed.name} removed.`);
    this.refreshDeckList();
  }

  private autoFillDeck(): void {
    this.deck = getStarterDeck();
    this.statusTxt.setText('Starter deck loaded. You can swap cards before saving.');
    this.refreshDeckList();
  }

  private saveDeckOnly(): void {
    if (!isValidDeck(this.deck)) {
      this.statusTxt.setText(`Build a ${MIN_DECK_SIZE}-${MAX_DECK_SIZE} card deck before saving.`);
      return;
    }
    saveDeck(this.deck);
    this.statusTxt.setText('Deck saved. Solo Duel will use this deck.');
    this.refreshDeckList();
  }

  private createButton(x: number, y: number, width: number, height: number, label: string, onClick: () => void): Phaser.GameObjects.Image {
    const btn = this.add.image(x, y, ART_KEYS.buttonPrimary).setDisplaySize(width, height).setInteractive();
    const txt = this.add.text(x, y, label, {
      fontSize: label.length > 10 ? '13px' : '15px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    btn.on('pointerover', () => {
      btn.setTint(0xffe29a);
      txt.setColor('#fff3bf');
    });
    btn.on('pointerout', () => {
      btn.clearTint();
      txt.setColor('#ffffff');
    });
    btn.on('pointerdown', onClick);
    return btn;
  }

  private clearDeckTexts(): void {
    for (const t of this.deckTexts) t.destroy();
    this.deckTexts = [];
  }

  private describeCard(card: Card): string {
    if (card.type === 'monster') {
      const grade = (card.tributeCost ?? 0) > 0 ? `TRIBUTE ${card.tributeCost}` : 'FREE';
      return `${card.name}  ${grade}  ${card.atk}/${card.hp}`;
    }
    const mode = card.spellMode === 'face_down' ? 'SET' : 'FACE';
    return `${card.name}  SPELL-${mode}`;
  }

  private refreshDeckList(): void {
    this.clearDeckTexts();

    const { width } = this.scale;
    const summary = getDeckSummary(this.deck);
    this.countText.setText(`${summary.total} / ${MIN_DECK_SIZE}-${MAX_DECK_SIZE} cards`);
    this.deckStatsTxt.setText([
      `Monsters ${summary.monsters}  Free ${summary.basicMonsters}  Tribute ${summary.tributeMonsters}`,
      `Spells ${summary.spells}  Face ${summary.faceUpSpells}  Set ${summary.faceDownSpells}`,
      summary.warning,
    ]);

    this.deck.forEach((card, i) => {
      const col = Math.floor(i / 6);
      const row = i % 6;
      const t = this.add.text(width * 0.71 + col * 205, 236 + row * 42, `${i + 1}. ${this.describeCard(card)}`, {
        fontSize: '13px',
        color: card.type === 'monster' ? '#d8e7ff' : '#c9ffe1',
      }).setInteractive();
      t.on('pointerdown', () => this.removeFromDeck(i));
      t.on('pointerover', () => t.setColor('#ff9ab7'));
      t.on('pointerout', () => t.setColor(card.type === 'monster' ? '#d8e7ff' : '#c9ffe1'));
      this.deckTexts.push(t);
    });

    this.saveDeckBtn.setAlpha(summary.valid ? 1 : 0.45);
    this.duelBtn.setAlpha(summary.valid ? 1 : 0.45);
  }

  private saveAndStart(): void {
    if (!isValidDeck(this.deck)) {
      this.statusTxt.setText(`Build a ${MIN_DECK_SIZE}-${MAX_DECK_SIZE} card deck before dueling.`);
      return;
    }
    saveDeck(this.deck);
    this.scene.start('GameScene', { mode: 'single', deck: this.deck });
  }
}
