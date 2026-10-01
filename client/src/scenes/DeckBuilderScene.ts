import Phaser from 'phaser';
import { ART_KEYS, addSceneBackdrop } from '../art/ProceduralArt';
import { CardSprite } from '../components/CardSprite';
import type { Card } from '../data/CardTypes';
import {
  MAX_DECK_SIZE,
  getDeckSummary,
  getSavedDeck,
  getStarterDeck,
  isValidDeck,
  saveDeck,
} from '../data/DeckStorage';
import { ALL_CARDS } from './BootScene';

const ARCHIVE_CARD_SCALE = 0.94;
const SLOT_CARD_SCALE = 0.62;

export class DeckBuilderScene extends Phaser.Scene {
  private deckCards: (Card | null)[] = Array(MAX_DECK_SIZE).fill(null);
  private deckSlots: Phaser.GameObjects.Container[] = [];
  private deckSlotSprites: (CardSprite | null)[] = Array(MAX_DECK_SIZE).fill(null);
  private countText!: Phaser.GameObjects.Text;
  private deckStatsTxt!: Phaser.GameObjects.Text;
  private statusTxt!: Phaser.GameObjects.Text;
  private saveDeckBtn!: Phaser.GameObjects.Image;
  private duelBtn!: Phaser.GameObjects.Image;
  private dragCard: Card | null = null;
  private dragGhost: CardSprite | null = null;
  private dragStartX = 0;
  private dragStartY = 0;
  private isDragging = false;

  constructor() { super('DeckBuilderScene'); }

  create(): void {
    const { width, height } = this.scale;
    addSceneBackdrop(this);

    this.setDeckCards(getSavedDeck());

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
    this.add.text(48, 78, '1 Pick unique cards  >  2 Fill all 12 slots  >  3 Save deck  >  4 Duel', {
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
      sprite.setBaseScale(ARCHIVE_CARD_SCALE);
      this.add.existing(sprite);
      sprite.setInteractive();
      sprite.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.startArchiveDrag(card, pointer));
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
    this.createDeckSlots();

    this.createButton(width * 0.84, height - 138, 320, 58, 'AUTO FILL', () => this.autoFillDeck());
    this.saveDeckBtn = this.createButton(width * 0.77, height - 70, 190, 58, 'SAVE DECK', () => this.saveDeckOnly());
    this.duelBtn = this.createButton(width * 0.89, height - 70, 190, 58, 'SAVE AND DUEL', () => this.saveAndStart());

    this.refreshDeckList();
  }

  private addToDeck(card: Card): void {
    const emptySlot = this.deckCards.findIndex(slot => slot === null);
    if (emptySlot < 0) {
      this.statusTxt.setText(`Deck limit is ${MAX_DECK_SIZE} cards.`);
      return;
    }
    this.placeCardInSlot(card, emptySlot);
  }

  private placeCardInSlot(card: Card, slotIndex: number): void {
    if (slotIndex < 0 || slotIndex >= MAX_DECK_SIZE) return;
    if (this.deckCards.some(slot => slot?.id === card.id)) {
      this.statusTxt.setText('Each card can be added once in this prototype.');
      return;
    }
    if (this.deckCards[slotIndex]) {
      this.statusTxt.setText('That slot already has a card. Pick an empty slot.');
      return;
    }
    this.deckCards[slotIndex] = card;
    this.statusTxt.setText(`${card.name} added to slot ${slotIndex + 1}.`);
    this.refreshDeckList();
  }

  private removeFromDeck(index: number): void {
    const removed = this.deckCards[index];
    if (!removed) return;
    this.deckCards[index] = null;
    this.statusTxt.setText(`${removed.name} removed.`);
    this.refreshDeckList();
  }

  private autoFillDeck(): void {
    this.setDeckCards(getStarterDeck());
    this.statusTxt.setText('Starter deck loaded. You can swap cards before saving.');
    this.refreshDeckList();
  }

  private saveDeckOnly(): void {
    const deck = this.getDeck();
    if (!isValidDeck(deck)) {
      this.statusTxt.setText(`Build a ${MAX_DECK_SIZE} card deck before saving.`);
      return;
    }
    saveDeck(deck);
    this.statusTxt.setText('Deck saved. Solo Duel will use this deck.');
    this.refreshDeckList();
  }

  private createDeckSlots(): void {
    const { width } = this.scale;
    for (let i = 0; i < MAX_DECK_SIZE; i++) {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = width * 0.71 + col * 134;
      const y = 246 + row * 112;
      const slot = this.add.container(x, y);
      const bg = this.add.image(0, 0, ART_KEYS.hudFrame).setDisplaySize(94, 106).setAlpha(0.82);
      const outline = this.add.rectangle(0, 0, 86, 98, 0x000000, 0).setStrokeStyle(2, 0xd8b56a, 0.52);
      const label = this.add.text(0, 0, String(i + 1), {
        fontSize: '18px',
        color: '#6f8096',
        fontStyle: 'bold',
        stroke: '#080b12',
        strokeThickness: 3,
      }).setOrigin(0.5);
      slot.add([bg, outline, label]);
      slot.setInteractive(new Phaser.Geom.Rectangle(-47, -53, 94, 106), Phaser.Geom.Rectangle.Contains);
      slot.on('pointerdown', () => this.removeFromDeck(i));
      this.deckSlots.push(slot);
    }
  }

  private renderDeckSlots(): void {
    for (const sprite of this.deckSlotSprites) sprite?.destroy();
    this.deckSlotSprites = Array(MAX_DECK_SIZE).fill(null);

    this.deckCards.forEach((card, index) => {
      if (!card) return;
      const slot = this.deckSlots[index];
      const sprite = new CardSprite(this, slot.x, slot.y, card);
      sprite.setBaseScale(SLOT_CARD_SCALE);
      sprite.setInteractive();
      sprite.on('pointerdown', () => this.removeFromDeck(index));
      sprite.on('pointerover', () => sprite.highlight(true));
      sprite.on('pointerout', () => sprite.highlight(false));
      this.add.existing(sprite);
      this.deckSlotSprites[index] = sprite;
    });
  }

  private startArchiveDrag(card: Card, pointer: Phaser.Input.Pointer): void {
    this.dragCard = card;
    this.dragStartX = pointer.x;
    this.dragStartY = pointer.y;
    this.isDragging = false;
    this.input.on('pointermove', this.onArchiveDragMove, this);
    this.input.on('pointerup', this.finishArchiveDrag, this);
  }

  private onArchiveDragMove(pointer: Phaser.Input.Pointer): void {
    if (!this.dragCard) return;
    const dist = Phaser.Math.Distance.Between(pointer.x, pointer.y, this.dragStartX, this.dragStartY);
    if (!this.isDragging && dist > 8) {
      this.isDragging = true;
      this.dragGhost = new CardSprite(this, pointer.worldX, pointer.worldY, this.dragCard);
      this.dragGhost.setBaseScale(0.62);
      this.dragGhost.setAlpha(0.82);
      this.dragGhost.setDepth(2000);
      this.add.existing(this.dragGhost);
    }
    if (this.dragGhost) {
      this.dragGhost.x = pointer.worldX;
      this.dragGhost.y = pointer.worldY;
    }
  }

  private finishArchiveDrag(pointer: Phaser.Input.Pointer): void {
    this.input.off('pointermove', this.onArchiveDragMove, this);
    this.input.off('pointerup', this.finishArchiveDrag, this);
    const card = this.dragCard;
    const wasDragging = this.isDragging;
    this.dragCard = null;
    this.isDragging = false;
    this.dragGhost?.destroy();
    this.dragGhost = null;

    if (!card) return;
    if (!wasDragging) {
      this.addToDeck(card);
      return;
    }

    const slotIndex = this.getSlotIndexAt(pointer.worldX, pointer.worldY);
    if (slotIndex < 0) {
      this.statusTxt.setText('Drop cards onto an empty deck slot.');
      return;
    }
    this.placeCardInSlot(card, slotIndex);
  }

  private getSlotIndexAt(worldX: number, worldY: number): number {
    return this.deckSlots.findIndex(slot => Math.abs(worldX - slot.x) <= 48 && Math.abs(worldY - slot.y) <= 54);
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

  private refreshDeckList(): void {
    this.renderDeckSlots();
    const deck = this.getDeck();
    const summary = getDeckSummary(deck);
    this.countText.setText(`${summary.total} / ${MAX_DECK_SIZE} cards`);
    this.deckStatsTxt.setText([
      `Monsters ${summary.monsters}  Free ${summary.basicMonsters}  Tribute ${summary.tributeMonsters}`,
      `Spells ${summary.spells}  Face ${summary.faceUpSpells}  Set ${summary.faceDownSpells}`,
      summary.warning,
    ]);

    this.saveDeckBtn.setAlpha(summary.valid ? 1 : 0.45);
    this.duelBtn.setAlpha(summary.valid ? 1 : 0.45);
  }

  private saveAndStart(): void {
    const deck = this.getDeck();
    if (!isValidDeck(deck)) {
      this.statusTxt.setText(`Build a ${MAX_DECK_SIZE} card deck before dueling.`);
      return;
    }
    saveDeck(deck);
    this.scene.start('GameScene', { mode: 'single', deck });
  }

  private getDeck(): Card[] {
    return this.deckCards.filter((card): card is Card => card !== null);
  }

  private setDeckCards(cards: Card[]): void {
    this.deckCards = Array(MAX_DECK_SIZE).fill(null);
    cards.slice(0, MAX_DECK_SIZE).forEach((card, index) => {
      this.deckCards[index] = card;
    });
  }
}
