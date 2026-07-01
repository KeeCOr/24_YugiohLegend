import Phaser from 'phaser';
import { ART_KEYS, addSceneBackdrop, cardArtKey } from '../art/ProceduralArt';
import { Field } from '../components/Field';
import { HandArea } from '../components/HandArea';
import { LPDisplay } from '../components/LPDisplay';
import { getReadableEffectSummary, getSpellEffectSummary, getSpellTimingSummary } from '../data/CardText';
import { getStarterDeck, isValidDeck } from '../data/DeckStorage';
import { SocketManager } from '../network/SocketManager';
import { getLaneBattlePreview, type LaneBattlePreview } from 'shared/battlePreview';
import type {
  BattleEvent, Card, LaneIndex, LaneState, PlayerIndex, ServerMessage, SummonAction, TurnAction, TurnSummary,
} from '../data/CardTypes';
import { ALL_CARDS } from './BootScene';

const LANE_COUNT = 3;
const LANE_INDICES: LaneIndex[] = [0, 1, 2];

interface GameSceneData {
  mode: 'single' | 'multi';
  deck?: Card[];
}

type TurnStartMessage = Extract<ServerMessage, { type: 'turn_start' }>;
type BattleResultMessage = Extract<ServerMessage, { type: 'battle_result' }>;
type GameOverMessage = Extract<ServerMessage, { type: 'game_over' }>;

export class GameScene extends Phaser.Scene {
  private static readonly MAX_TURNS = 4;
  private static readonly BATTLE_REVEAL_PAUSE_MS = 850;
  private static readonly BATTLE_EVENT_STAGGER_MS = 780;
  private static readonly BATTLE_LP_APPLY_BUFFER_MS = 1250;
  private static getUnlockedLanes(turn: number): LaneIndex[] {
    if (turn <= 1) return [0];
    if (turn === 2) return [0, 1];
    return [0, 1, 2];
  }

  private socket!: SocketManager;
  private myIndex: PlayerIndex = 0;
  private turn = 1;

  private myHand: Card[] = [];
  private myLanes: LaneState[] | null = null;
  private opLanes: LaneState[] | null = null;
  private pendingAction: TurnAction = { spells: [] };
  private selectedCard: Card | null = null;
  private submitted = false;

  private myField!: Field;
  private opField!: Field;
  private myLP!: LPDisplay;
  private opLP!: LPDisplay;
  private handArea!: HandArea;
  private submitBtn!: Phaser.GameObjects.Image;
  private submitTxt!: Phaser.GameObjects.Text;
  private statusTxt!: Phaser.GameObjects.Text;
  private turnTxt!: Phaser.GameObjects.Text;
  private myDeckTxt!: Phaser.GameObjects.Text;
  private opDeckTxt!: Phaser.GameObjects.Text;
  private battlePreviewBadges: Phaser.GameObjects.Container[] = [];
  private startingDeckSize = 0;
  private myDeckCount = 0;
  private opDeckCount = 0;
  private duelDeck: Card[] = [];
  private summonLimitThisTurn = 1;
  private commitReady = false;
  private surrenderBtn!: Phaser.GameObjects.Text;
  private surrenderPending = false;
  private surrenderTimer?: Phaser.Time.TimerEvent;
  private lastBattleHadFinisher = false;
  private battleSequenceActive = false;
  private deferredTurnStart: TurnStartMessage | null = null;
  private deferredGameOver: GameOverMessage | null = null;
  private battleSequenceResultDelayMs = 0;

  constructor() { super('GameScene'); }

  init(_data: GameSceneData): void {
    this.pendingAction = { spells: [] };
    this.selectedCard = null;
    this.submitted = false;
    this.myHand = [];
    this.myLanes = null;
    this.opLanes = null;
    this.lastBattleHadFinisher = false;
    this.battleSequenceActive = false;
    this.deferredTurnStart = null;
    this.deferredGameOver = null;
    this.battleSequenceResultDelayMs = 0;
  }

  async create(data: GameSceneData): Promise<void> {
    const { width, height } = this.scale;
    addSceneBackdrop(this);

    const deck: Card[] = data.deck && isValidDeck(data.deck) ? data.deck : getStarterDeck();
    this.duelDeck = [...deck];
    this.startingDeckSize = deck.length;
    this.socket = new SocketManager();
    const boardX = width * 0.52;
    const sideCenter = width - 205;
    const lpX = sideCenter - 119;
    this.createTopHud(boardX, width, sideCenter);

    this.add.image(boardX, height * 0.435, ART_KEYS.hudFrame).setDisplaySize(700, 60).setAlpha(0.58);


    this.createBattlePreviewBadges(boardX, height * 0.435);

    this.opField = new Field(this, boardX, height * 0.245, 1);
    this.myField = new Field(this, boardX, height * 0.600, 0);
    this.updateLaneUnlocks();

    this.myLP = new LPDisplay(this, 20, height * 0.915, 'YOU');
    this.myLP.setScale(1.0);
    this.opLP = new LPDisplay(this, lpX, height * 0.145, 'RIVAL');
    this.opLP.setScale(1.0);
    this.opDeckTxt = this.createDeckCounter(sideCenter - 44, height * 0.335, 'RIVAL DECK');
    this.myDeckTxt = this.createDeckCounter(sideCenter - 44, height * 0.455, 'YOUR DECK');

    this.handArea = new HandArea(this, boardX, height * 0.870, (card, _sprite) => {
      this.selectedCard = card;
      if (card.type === 'spell' || card.type === 'trap') {
        const text = `${card.name}: ${getSpellTimingSummary(card)} - ${getReadableEffectSummary(card) || getSpellEffectSummary(card)}. Click or drag to your lane.`;
        this.statusTxt.setText(text);
      } else {
        const summonText = this.getSummonText(card);
        this.statusTxt.setText(`${card.name}: ${summonText}. Click or drag to your lane.`);
      }
      this.updateLaneGuidanceForSelectedCard(card);
    }, (card) => this.showCardHelp(card), () => {
      if (!this.selectedCard && this.statusTxt) {
        this.statusTxt.setText('Select a glowing card, then choose a glowing lane.');
      }
    }, (card, worldX, worldY) => this.onCardDroppedOnLane(card, worldX, worldY));

    this.add.image(sideCenter, height * 0.725, ART_KEYS.hudFrame).setDisplaySize(300, 112).setAlpha(0.78);
    this.statusTxt = this.add.text(sideCenter, height * 0.725, 'Preparing duel...', {
      fontSize: '15px',
      color: '#d8e7ff',
      stroke: '#080b12',
      strokeThickness: 3,
      wordWrap: { width: 252, useAdvancedWrap: true },
      align: 'center',
      lineSpacing: 3,
    }).setOrigin(0.5);

    this.submitBtn = this.add.image(sideCenter, height * 0.875, ART_KEYS.buttonPrimary).setDisplaySize(265, 76).setInteractive();
    this.submitTxt = this.add.text(sideCenter, height * 0.875, 'COMMIT', {
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#120912',
      strokeThickness: 4,
    }).setOrigin(0.5);
    this.submitBtn.on('pointerdown', () => this.submitAction());
    this.submitBtn.on('pointerover', () => this.submitBtn.setTint(0xffe29a));
    this.submitBtn.on('pointerout', () => {
      if (this.commitReady) this.submitBtn.setTint(0xffe29a);
      else this.submitBtn.clearTint();
    });

    this.surrenderBtn = this.add.text(sideCenter, height * 0.974, 'SURRENDER', {
      fontSize: '14px',
      color: '#6a7a8d',
      fontStyle: 'bold',
      stroke: '#080b12',
      strokeThickness: 2,
    }).setOrigin(0.5).setInteractive();
    this.surrenderBtn.on('pointerover', () => {
      if (!this.surrenderPending) this.surrenderBtn.setColor('#ff667c');
    });
    this.surrenderBtn.on('pointerout', () => {
      if (!this.surrenderPending) this.surrenderBtn.setColor('#6a7a8d');
    });
    this.surrenderBtn.on('pointerdown', () => this.onSurrenderClick());

    this.setCommitReady(false);

    this.turnTxt = this.add.text(boardX, 20, `TURN 1 / ${GameScene.MAX_TURNS}`, {
      fontSize: '18px',
      color: '#f2c86a',
      fontStyle: 'bold',
      stroke: '#120912',
      strokeThickness: 3,
    }).setOrigin(0.5);

    this.setupLaneInteraction();

    this.socket.on((msg) => this.handleServerMessage(msg));
    try {
      await this.socket.connect();
      this.socket.send({ type: 'join_room', mode: data.mode, deck });
    } catch {
      this.statusTxt.setText('Connection failed. Restart the game executable.');
    }
  }

  private createTopHud(boardX: number, _width: number, sideCenter: number): void {
    this.add.image(190, 46, ART_KEYS.hudFrame).setDisplaySize(340, 76).setAlpha(0.88);
    this.add.text(190, 36, 'YugiohLegend', {
      fontSize: '24px',
      color: '#fff0c8',
      fontStyle: 'bold',
      stroke: '#120912',
      strokeThickness: 3,
    }).setOrigin(0.5);
    this.add.text(190, 60, '3-LANE SUMMON DUEL', {
      fontSize: '10px',
      color: '#8fd8ff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const phases = [
      { label: 'DRAW', x: boardX - 150 },
      { label: 'MAIN', x: boardX },
      { label: 'BATTLE', x: boardX + 150 },
    ];
    for (const phase of phases) {
      const bg = this.add.image(phase.x, 50, ART_KEYS.buttonPrimary).setDisplaySize(138, 44).setAlpha(0.72);
      if (phase.label === 'MAIN') bg.setTint(0xffd36f);
      this.add.text(phase.x, 50, phase.label, {
        fontSize: '15px',
        color: phase.label === 'MAIN' ? '#101525' : '#d8e7ff',
        fontStyle: 'bold',
      }).setOrigin(0.5);
    }

    this.add.image(sideCenter, 50, ART_KEYS.hudFrame).setDisplaySize(300, 86).setAlpha(0.78);
    this.add.text(sideCenter, 30, 'CARD GUIDE', {
      fontSize: '14px',
      color: '#bfffe2',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.add.text(sideCenter, 58, 'Select a card,\nthen choose a lane', {
      fontSize: '12px',
      color: '#d8e7ff',
      align: 'center',
      wordWrap: { width: 244, useAdvancedWrap: true },
      lineSpacing: 2,
    }).setOrigin(0.5);
  }

  private createDuelistPanel(x: number, y: number, label: string, cardId: string, accent: number): void {
    this.add.image(x, y, ART_KEYS.hudFrame).setDisplaySize(172, 152).setAlpha(0.78);
    const glow = this.add.image(x, y - 6, ART_KEYS.glow).setDisplaySize(148, 118).setAlpha(0.2).setTint(accent);
    const portrait = this.add.image(x, y - 10, cardArtKey(cardId)).setDisplaySize(130, 110);
    portrait.setCrop(0, 0, portrait.width, portrait.height * 0.84);
    this.add.rectangle(x, y - 10, 140, 120, 0x000000, 0).setStrokeStyle(3, accent, 0.72);
    this.add.text(x, y + 62, label, {
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#090b12',
      strokeThickness: 3,
    }).setOrigin(0.5);
    this.tweens.add({
      targets: glow,
      alpha: { from: 0.14, to: 0.34 },
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private createDeckCounter(x: number, y: number, label: string): Phaser.GameObjects.Text {
    this.add.image(x - 58, y, ART_KEYS.cardBack).setDisplaySize(58, 82).setAngle(-4);
    this.add.image(x - 46, y + 4, ART_KEYS.cardBack).setDisplaySize(58, 82).setAngle(3);
    this.add.text(x + 14, y - 17, label, {
      fontSize: '12px',
      color: '#a6bed8',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    return this.add.text(x + 14, y + 10, '0', {
      fontSize: '28px',
      color: '#fff0c8',
      fontStyle: 'bold',
      stroke: '#090b12',
      strokeThickness: 4,
    }).setOrigin(0, 0.5);
  }

  private createBattlePreviewBadges(boardX: number, y: number): void {
    this.battlePreviewBadges = LANE_INDICES.map((laneIndex) => {
      const x = boardX + (laneIndex - (LANE_COUNT - 1) / 2) * 198;
      const c = this.add.container(x, y + 2).setDepth(62);
      const bg = this.add.rectangle(0, 0, 174, 46, 0x08101c, 0.88);
      bg.setName('preview-bg');
      bg.setStrokeStyle(2, 0x30425f, 0.9);
      const accent = this.add.rectangle(0, -21, 166, 3, 0x7fd8ff, 0.95);
      accent.setName('preview-accent');
      const title = this.add.text(0, -8, 'BATTLE T2', {
        fontSize: '10px',
        color: '#aebbd0',
        fontStyle: 'bold',
        stroke: '#030711',
        strokeThickness: 2,
      }).setOrigin(0.5);
      title.setName('preview-title');
      const detail = this.add.text(0, 10, 'attacks start later', {
        fontSize: '11px',
        color: '#d8e7ff',
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: 154, useAdvancedWrap: true },
        stroke: '#030711',
        strokeThickness: 2,
      }).setOrigin(0.5);
      detail.setName('preview-detail');
      c.add([bg, accent, title, detail]);
      return c;
    });
  }

  private onCardDroppedOnLane(card: Card, worldX: number, worldY: number): void {
    for (let i = 0; i < LANE_COUNT; i++) {
      const laneX = this.myField.getLaneWorldX(i as LaneIndex);
      const laneY = this.myField.y;
      if (Math.abs(worldX - laneX) < 111 && Math.abs(worldY - laneY) < 148) {
        this.onLaneClick(i as LaneIndex);
        return;
      }
    }
    this.selectedCard = null;
    this.handArea.deselectAll();
    this.myField.setGuidedLanes();
    this.myField.setTributeLanes();
  }

  private setupLaneInteraction(): void {
    for (let i = 0; i < LANE_COUNT; i++) {
      const laneIndex = i as LaneIndex;
      const hitArea = this.add.rectangle(
        this.myField.getLaneWorldX(laneIndex),
        this.myField.y,
        222,
        296,
        0x000000,
        0
      ).setInteractive();
      hitArea.setDepth(30);
      hitArea.on('pointerover', () => this.myField.highlightLane(laneIndex, true));
      hitArea.on('pointerout', () => this.myField.highlightLane(laneIndex, false));
      hitArea.on('pointerdown', () => this.onLaneClick(laneIndex));
    }
  }

  private onLaneClick(laneIndex: LaneIndex): void {
    if (this.submitted) return;
    if (!this.selectedCard) {
      this.statusTxt.setText('Select a glowing card in your hand first.');
      return;
    }
    if (!this.isLaneUnlocked(laneIndex)) {
      this.statusTxt.setText(`Lane ${laneIndex + 1} is locked this turn.`);
      return;
    }
    const card = this.selectedCard;

    if (card.type === 'monster') {
      if (this.getQueuedSummons().length >= this.getSummonLimit()) {
        this.statusTxt.setText(this.getSummonLimit() > 1
          ? 'You already queued all available summons this turn.'
          : 'Only one monster can be summoned this turn.');
        return;
      }
      const tributeCost = card.tributeCost ?? 0;
      const tributeCandidates = this.getTributeCandidateLaneIndices();
      if (tributeCandidates.length < tributeCost) {
        this.statusTxt.setText(`${card.name} needs ${tributeCost} tribute monster${tributeCost > 1 ? 's' : ''}.`);
        return;
      }
      const canReplaceTargetWithTribute = tributeCost > 0 && Boolean(this.myLanes?.[laneIndex].monster);
      if ((!canReplaceTargetWithTribute && this.myLanes?.[laneIndex].monster) || this.myField.hasPending(laneIndex)) {
        this.statusTxt.setText(tributeCost > 0
          ? 'Choose a tribute monster lane or an empty lane.'
          : 'That lane already has a monster. Choose an empty lane.');
        return;
      }
      const queuedSummons = this.getQueuedSummons();
      const tributeLaneIndices = tributeCost > 0
        ? this.getAutoTributeLaneIndices(tributeCost, laneIndex, canReplaceTargetWithTribute)
        : [];
      const summon: SummonAction = tributeCost > 0 ? { card, laneIndex, tributeLaneIndices } : { card, laneIndex };
      queuedSummons.push(summon);
      this.setQueuedSummons(queuedSummons);
      if (tributeCost > 0) this.applyLocalTributePayment(tributeLaneIndices);
      this.myField.setPendingCard(laneIndex, card);
      this.myHand = this.myHand.filter(c => c.id !== card.id);
      this.handArea.removeCard(card.id);
      this.updatePlayableHandCards();
      this.setCommitReady(true);
      this.statusTxt.setText(tributeCost > 0
        ? `${card.name} paid ${tributeCost} tribute${tributeCost > 1 ? 's' : ''} and queued in lane ${laneIndex + 1}. Press COMMIT.`
        : `${card.name} queued in lane ${laneIndex + 1}. ${this.getQueuedSummons().length}/${this.getSummonLimit()} summon used.`);
    } else if (card.type === 'spell' || card.type === 'trap') {
      if (card.spellMode === 'face_down' && this.myLanes?.[laneIndex].faceDownSpell) {
        this.statusTxt.setText('That lane already has a face-down spell.');
        return;
      }
      if (card.spellMode !== 'face_down' && this.myLanes?.[laneIndex].spell) {
        this.statusTxt.setText('That lane already has a queued card. Choose another lane.');
        return;
      }
      if (this.myField.hasPending(laneIndex)) {
        this.statusTxt.setText('That lane already has a queued card. Choose another lane.');
        return;
      }
      this.pendingAction.spells.push({ card, laneIndex });
      const faceDown = card.spellMode === 'face_down';
      this.myField.setPendingCard(laneIndex, card, faceDown);
      this.myHand = this.myHand.filter(c => c.id !== card.id);
      this.handArea.removeCard(card.id);
      this.updatePlayableHandCards();
      this.setCommitReady(true);
      this.statusTxt.setText(faceDown
        ? `${card.name} set face-down in lane ${laneIndex + 1}. Press COMMIT.`
        : `${card.name} set face-up in lane ${laneIndex + 1}. It will resolve later.`);
    }

    this.selectedCard = null;
    this.handArea.deselectAll();
    this.myField.setGuidedLanes();
    if (card.type !== 'monster' || (card.tributeCost ?? 0) <= 0) this.myField.setTributeLanes();
  }

  private onSurrenderClick(): void {
    if (this.surrenderPending) {
      this.surrenderTimer?.destroy();
      this.surrenderBtn.setText('SURRENDER');
      this.surrenderBtn.setColor('#ff667c');
      this.surrenderBtn.disableInteractive();
      this.socket.send({ type: 'forfeit' });
    } else {
      this.surrenderPending = true;
      this.surrenderBtn.setText('SURRENDER');
      this.surrenderBtn.setColor('#ff667c');
      this.surrenderTimer = this.time.delayedCall(3000, () => {
        this.surrenderPending = false;
        this.surrenderBtn.setText('SURRENDER');
        this.surrenderBtn.setColor('#6a7a8d');
      });
    }
  }

  private submitAction(): void {
    if (this.submitted) return;
    if (!this.commitReady) {
      this.statusTxt.setText('Play at least one card before pressing COMMIT.');
      return;
    }
    this.submitted = true;
    this.submitBtn.setAlpha(0.5);
    this.submitTxt.setText('WAIT');
    this.socket.send({ type: 'submit_action', action: this.pendingAction });
    this.statusTxt.setText('Waiting for the rival move...');
    this.updatePlayableHandCards();
  }

  private getSummonText(card: Card): string {
    if (card.type !== 'monster') return '';
    const tributeCost = card.tributeCost ?? 0;
    return tributeCost > 0 ? `TRIBUTE x${tributeCost} REQUIRED` : 'FREE SUMMON';
  }

  private handleServerMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case 'game_start':
        this.myIndex = msg.yourIndex;
        this.myHand = [...msg.yourHand];
        this.myDeckCount = Math.max(0, this.startingDeckSize - msg.yourHand.length);
        this.opDeckCount = Math.max(0, this.startingDeckSize - msg.opponentHandCount);
        this.updateDeckCounters();
        this.handArea.setHand(this.myHand);
        this.turn = msg.turn;
        this.turnTxt.setText(`TURN ${this.turn} / ${GameScene.MAX_TURNS}`);
        this.updateLaneUnlocks();
        this.updatePlayableHandCards();
        this.myField.setTributeLanes();
        this.summonLimitThisTurn = 1;
        this.setCommitReady(false);
        this.statusTxt.setText('Setup turn: place cards. Attacks start on turn 2.');
        break;

      case 'turn_start':
        if (this.battleSequenceActive) {
          this.deferredTurnStart = msg;
          break;
        }
        this.applyTurnStart(msg);
        break;

      case 'reveal':
        this.keepOpponentLastConfirmedField();
        this.statusTxt.setText('Actions revealed. Battle resolving...');
        break;

      case 'battle_result':
        this.beginBattleResolutionSequence(msg);
        break;

      case 'game_over':
        if (this.battleSequenceActive) {
          this.deferredGameOver = msg;
          break;
        }
        this.startResultScene(msg);
        break;

      case 'waiting':
        this.statusTxt.setText(msg.message);
        break;

      case 'error':
        this.statusTxt.setText(`Error: ${msg.message}`);
        break;
    }
  }

  private applyTurnStart(msg: TurnStartMessage): void {
    this.submitted = false;
    this.pendingAction = { spells: [] };
    this.keepOpponentLastConfirmedField();
    this.turn = msg.turn;
    this.summonLimitThisTurn = msg.summonLimit;
    this.myDeckCount = Math.max(0, this.myDeckCount - 1);
    this.opDeckCount = Math.max(0, this.opDeckCount - 1);
    this.updateDeckCounters();
    this.turnTxt.setText(`TURN ${this.turn} / ${GameScene.MAX_TURNS}`);
    this.applyLaneState(msg.lanes);
    this.updateLaneUnlocks();
    this.myField.setTributeLanes();
    this.myHand.push(msg.drawnCard);
    this.handArea.setHand(this.myHand);
    this.submitTxt.setText('COMMIT');
    this.setCommitReady(false);
    this.statusTxt.setText('New draw. Prepare your lane.');
    this.updatePlayableHandCards();
  }

  private beginBattleResolutionSequence(result: BattleResultMessage): void {
    this.lastBattleHadFinisher = result.events.some(ev => ev.finisher);
    this.battleSequenceActive = true;
    this.battleSequenceResultDelayMs = this.getBattleSequenceDuration(result.events);
    this.applyLaneState(result.preBattleLanes);
    this.statusTxt.setText(result.events.some(ev => ev.finisher)
      ? 'Summons revealed. Final blow incoming...'
      : 'Summons revealed. Battle starts...');
    this.showBattleEvents(result.events, GameScene.BATTLE_REVEAL_PAUSE_MS);
    this.time.delayedCall(this.battleSequenceResultDelayMs, () => this.finishBattleResolutionSequence(result));
  }

  private finishBattleResolutionSequence(result: BattleResultMessage): void {
    this.myLP.update(result.lps[this.myIndex]);
    this.opLP.update(result.lps[this.myIndex === 0 ? 1 : 0]);
    this.applyLaneState(result.lanes);
    this.battleSequenceActive = false;
    this.statusTxt.setText(this.formatTurnSummary(result.turnSummary));
    this.showDuelEndSummaryOverlay(result.turnSummary, result.lps);

    const deferredTurnStart = this.deferredTurnStart;
    this.deferredTurnStart = null;
    if (deferredTurnStart) {
      this.applyTurnStart(deferredTurnStart);
      return;
    }

    const deferredGameOver = this.deferredGameOver;
    this.deferredGameOver = null;
    if (deferredGameOver) this.startResultScene(deferredGameOver);
  }


  private showDuelEndSummaryOverlay(turnSummary: TurnSummary | undefined, lps: [number, number]): void {
    if (!turnSummary) return;
    const defeatedIndex = lps.findIndex(lp => lp <= 0);
    if (turnSummary.nextTurn !== null && defeatedIndex < 0) return;

    const { width, height } = this.scale;
    const defeatedLabel = defeatedIndex === 0 ? 'P1 LP 0' : defeatedIndex === 1 ? 'P2 LP 0' : 'FINAL TURN';
    const overlay = this.add.container(width / 2, height / 2).setDepth(96).setAlpha(0);
    const scrim = this.add.rectangle(0, 0, width, height, 0x050712, 0.72);
    const panel = this.add.image(0, 0, ART_KEYS.hudFrame).setDisplaySize(640, 250).setAlpha(0.96);
    const headline = this.add.text(0, -82, turnSummary.headline, {
      fontSize: '28px',
      color: '#fff4c6',
      fontStyle: 'bold',
      stroke: '#120912',
      strokeThickness: 5,
      align: 'center',
      wordWrap: { width: 560, useAdvancedWrap: true },
    }).setOrigin(0.5);
    const lpBadge = this.add.text(0, -28, defeatedLabel, {
      fontSize: '22px',
      color: '#ff9bb0',
      fontStyle: 'bold',
      stroke: '#090b12',
      strokeThickness: 4,
    }).setOrigin(0.5);
    const steps = this.add.text(0, 42, turnSummary.steps.slice(1).join('\n'), {
      fontSize: '16px',
      color: '#d8e7ff',
      stroke: '#080b12',
      strokeThickness: 3,
      align: 'center',
      lineSpacing: 5,
      wordWrap: { width: 560, useAdvancedWrap: true },
    }).setOrigin(0.5);

    overlay.add([scrim, panel, headline, lpBadge, steps]);
    overlay.setScale(0.92);
    this.tweens.add({
      targets: overlay,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 260,
      ease: 'Back.easeOut',
    });
    this.time.delayedCall(2300, () => {
      this.tweens.add({
        targets: overlay,
        alpha: 0,
        y: overlay.y - 18,
        duration: 420,
        ease: 'Sine.easeIn',
        onComplete: () => overlay.destroy(),
      });
    });
  }

  private formatTurnSummary(turnSummary?: TurnSummary): string {
    if (!turnSummary) return 'Battle resolved. LP updated.';
    const detail = turnSummary.steps.slice(1).join('\n');
    return `${turnSummary.headline}\n${detail}`;
  }
  private getBattleSequenceDuration(events: BattleEvent[]): number {
    const shownEvents = this.getShownBattleEventCount(events);
    if (shownEvents === 0) return GameScene.BATTLE_REVEAL_PAUSE_MS;
    return GameScene.BATTLE_REVEAL_PAUSE_MS
      + (shownEvents - 1) * GameScene.BATTLE_EVENT_STAGGER_MS
      + GameScene.BATTLE_LP_APPLY_BUFFER_MS;
  }

  private getShownBattleEventCount(events: BattleEvent[]): number {
    return events.filter(ev => ev.type !== 'no_action').length;
  }

  private startResultScene(msg: GameOverMessage): void {
    this.socket.disconnect();
    const resultDelay = this.lastBattleHadFinisher ? 2600 : 1500;
    this.time.delayedCall(resultDelay, () => {
      this.scene.start('ResultScene', {
        winner: msg.winner,
        myIndex: this.myIndex,
        finalLPs: msg.finalLPs,
        deck: this.duelDeck,
      });
    });
  }
  private keepOpponentLastConfirmedField(): void {
    this.opField.clearPending();
    if (this.opLanes) this.opField.updateLanes(this.opLanes);
  }

  private applyLaneState(lanes: [LaneState[], LaneState[]]): void {
    const my = lanes[this.myIndex];
    const op = lanes[this.myIndex === 0 ? 1 : 0];
    this.myLanes = my;
    this.opLanes = op;
    this.myField.updateLanes(my);
    this.opField.updateLanes(op);
    this.myField.setTributeLanes();
    this.updateLaneUnlocks();
    this.updatePlayableHandCards();
    this.updateBattlePreviews();
  }

  private isLaneUnlocked(laneIndex: LaneIndex): boolean {
    return GameScene.getUnlockedLanes(this.turn).includes(laneIndex);
  }

  private updateLaneUnlocks(): void {
    if (!this.myField || !this.opField) return;
    const unlocked = GameScene.getUnlockedLanes(this.turn);
    this.myField.setUnlockedLanes(unlocked);
    this.opField.setUnlockedLanes(unlocked);
    this.updateBattlePreviews();
  }

  private updateBattlePreviews(): void {
    if (this.battlePreviewBadges.length === 0) return;
    const unlocked = new Set(GameScene.getUnlockedLanes(this.turn));
    for (const laneIndex of LANE_INDICES) {
      const badge = this.battlePreviewBadges[laneIndex];
      const bg = badge.getByName('preview-bg') as Phaser.GameObjects.Rectangle | null;
      const accent = badge.getByName('preview-accent') as Phaser.GameObjects.Rectangle | null;
      const title = badge.getByName('preview-title') as Phaser.GameObjects.Text | null;
      const detail = badge.getByName('preview-detail') as Phaser.GameObjects.Text | null;
      const locked = !unlocked.has(laneIndex);
      const hasBattlePreview = this.turn >= 2 && this.myLanes && this.opLanes && !locked;

      if (!hasBattlePreview) {
        const text = locked ? `LANE ${laneIndex + 1} LOCKED` : 'BATTLE T2';
        title?.setText(text);
        detail?.setText(locked ? 'opens later' : 'attacks start later');
        title?.setColor('#aebbd0');
        detail?.setColor('#aebbd0');
        bg?.setFillStyle(0x08101c, locked ? 0.52 : 0.76);
        bg?.setStrokeStyle(2, 0x30425f, locked ? 0.45 : 0.78);
        accent?.setFillStyle(0x6a7a8d, 0.72);
        continue;
      }

      const preview = getLaneBattlePreview(this.myLanes[laneIndex], this.opLanes[laneIndex]);
      const palette = this.getPreviewPalette(preview);
      title?.setText(this.getPreviewTitle(preview));
      detail?.setText(preview.label);
      title?.setColor(palette.title);
      detail?.setColor(palette.detail);
      bg?.setFillStyle(palette.bg, 0.9);
      bg?.setStrokeStyle(2, palette.stroke, 0.92);
      accent?.setFillStyle(palette.stroke, 0.98);
    }
  }

  private getPreviewTitle(preview: LaneBattlePreview): string {
    if (preview.kind === 'empty') return 'QUIET';
    if (preview.kind === 'direct') return preview.attacker === 'player' ? 'YOU HIT LP' : 'LP DANGER';
    if (preview.damage === 0) return 'EVEN CLASH';
    return preview.target === 'opponent' ? 'YOU WIN TRADE' : 'RIVAL WINS';
  }

  private getPreviewPalette(preview: LaneBattlePreview): { bg: number; stroke: number; title: string; detail: string } {
    if (preview.tone === 'advantage') {
      return { bg: 0x092016, stroke: 0x8ef2ba, title: '#bfffe2', detail: '#ffffff' };
    }
    if (preview.tone === 'danger') {
      return { bg: 0x260c14, stroke: 0xff7487, title: '#ffb3be', detail: '#ffffff' };
    }
    return { bg: 0x0b1524, stroke: 0x7fd8ff, title: '#bde8ff', detail: '#d8e7ff' };
  }

  private getTributeCandidateLaneIndices(): LaneIndex[] {
    if (!this.myLanes) return [];
    return LANE_INDICES.filter(laneIndex => Boolean(this.myLanes?.[laneIndex].monster));
  }

  private getAutoTributeLaneIndices(
    tributeCost: number,
    summonLaneIndex: LaneIndex,
    includeSummonLane = false
  ): LaneIndex[] {
    if (!this.myLanes || tributeCost <= 0) return [];
    const selectedTributes = includeSummonLane && this.myLanes[summonLaneIndex].monster ? [summonLaneIndex] : [];
    const remainingCost = tributeCost - selectedTributes.length;
    if (remainingCost <= 0) return selectedTributes;
    return LANE_INDICES
      .filter(laneIndex => laneIndex !== summonLaneIndex && Boolean(this.myLanes?.[laneIndex].monster))
      .sort((a, b) => (this.myLanes?.[a].monster?.atk ?? 0) - (this.myLanes?.[b].monster?.atk ?? 0))
      .slice(0, remainingCost)
      .concat(selectedTributes)
      .sort((a, b) => a - b);
  }

  private applyLocalTributePayment(tributeLaneIndices: LaneIndex[]): void {
    if (!this.myLanes || tributeLaneIndices.length === 0) return;
    const tributeSet = new Set<LaneIndex>(tributeLaneIndices);
    this.myLanes = this.myLanes.map((lane, laneIndex) => (
      tributeSet.has(laneIndex as LaneIndex) ? { ...lane, monster: null } : lane
    ));
    this.myField.updateLanes(this.myLanes);
  }

  private updatePlayableHandCards(): void {
    if (!this.handArea) return;
    const playable = new Set<string>();
    for (const card of this.myHand) {
      if (this.canPlayCardNow(card)) playable.add(card.id);
    }
    this.handArea.setPlayableCards(playable);
  }

  private updateLaneGuidanceForSelectedCard(card: Card): void {
    const lanes = this.getPlayableLaneIndices(card);
    this.myField.setGuidedLanes(lanes);
    if (card.type === 'monster' && (card.tributeCost ?? 0) > 0) {
      this.myField.setTributeLanes(this.getTributeCandidateLaneIndices());
    } else {
      this.myField.setTributeLanes();
    }
    if (lanes.length === 0) {
      this.statusTxt.setText(`${card.name}: ${this.getPlayBlockReason(card)}`);
    }
  }

  private getPlayableLaneIndices(card: Card): LaneIndex[] {
    if (this.submitted) return [];
    if (card.type === 'monster') {
      const tributeCost = card.tributeCost ?? 0;
      if (this.getQueuedSummons().length >= this.getSummonLimit()) return [];
      if (this.getTributeCandidateLaneIndices().length < tributeCost) return [];
    }
    return GameScene.getUnlockedLanes(this.turn).filter(laneIndex => {
      const lane = this.myLanes?.[laneIndex];
      const pending = this.myField?.hasPending(laneIndex);
      if (pending) return false;
      if (card.type === 'monster') {
        const tributeCost = card.tributeCost ?? 0;
        return !lane?.monster || tributeCost > 0;
      }
      if (card.spellMode === 'face_down') return !lane?.faceDownSpell;
      return !lane?.spell;
    });
  }

  private getPlayBlockReason(card: Card): string {
    if (this.submitted) return 'Waiting for the rival move.';
    if (card.type === 'monster') {
      if (this.getQueuedSummons().length >= this.getSummonLimit()) {
        return this.getSummonLimit() > 1 ? 'All extra summon slots are already queued.' : 'Only one monster can be summoned each turn.';
      }
      const tributeCost = card.tributeCost ?? 0;
      if (this.getTributeCandidateLaneIndices().length < tributeCost) {
        return `Needs ${tributeCost} tribute monster${tributeCost > 1 ? 's' : ''}.`;
      }
      return tributeCost > 0 ? 'No open unlocked monster or tribute lane.' : 'No open unlocked monster lane.';
    }
    return 'No open unlocked spell slot for this card.';
  }

  private showCardHelp(card: Card): void {
    const reason = this.getPlayBlockReason(card);
    if (this.canPlayCardNow(card)) {
      const lanes = this.getPlayableLaneIndices(card).map(i => i + 1).join(', ');
      if (card.type === 'spell' || card.type === 'trap') {
        this.statusTxt.setText(`${card.name}: ${getReadableEffectSummary(card) || getSpellEffectSummary(card)}. Valid lane${lanes.includes(',') ? 's' : ''}: ${lanes}.`);
        return;
      }
      this.statusTxt.setText(`${card.name}: playable now. Valid lane${lanes.includes(',') ? 's' : ''}: ${lanes}.`);
      return;
    }
    this.statusTxt.setText((card.type === 'spell' || card.type === 'trap')
      ? `${card.name}: ${getReadableEffectSummary(card) || getSpellEffectSummary(card)}. Cannot play now. ${reason}`
      : `${card.name}: cannot play now. ${reason}`);
  }

  private setCommitReady(on: boolean): void {
    this.commitReady = on;
    if (!this.submitBtn || !this.submitTxt) return;
    this.submitBtn.setAlpha(on ? 1 : 0.46);
    this.submitTxt.setColor(on ? '#ffffff' : '#9aa8bd');
    if (on) this.submitBtn.setTint(0xffe29a);
    else this.submitBtn.clearTint();
  }

  private updateDeckCounters(): void {
    this.myDeckTxt?.setText(String(this.myDeckCount));
    this.opDeckTxt?.setText(String(this.opDeckCount));
  }

  private canPlayCardNow(card: Card): boolean {
    if (this.submitted) return false;
    const unlocked = GameScene.getUnlockedLanes(this.turn);
    const hasOpenLane = unlocked.some(laneIndex => {
      const lane = this.myLanes?.[laneIndex];
      const pending = this.myField?.hasPending(laneIndex);
      if (card.type === 'monster') {
        const tributeCost = card.tributeCost ?? 0;
        return (!lane?.monster || tributeCost > 0) && !pending;
      }
      if (card.type === 'spell' || card.type === 'trap') {
        if (pending) return false;
        if (card.spellMode === 'face_down') return !lane?.faceDownSpell;
        return !lane?.spell;
      }
      return false;
    });

    if (!hasOpenLane) return false;
    if (card.type !== 'monster') return true;
    if (this.getQueuedSummons().length >= this.getSummonLimit()) return false;
    const tributeCost = card.tributeCost ?? 0;
    return this.getTributeCandidateLaneIndices().length >= tributeCost;
  }

  private normalizeSummons(action: TurnAction): SummonAction[] {
    if (action.summons?.length) return action.summons;
    return action.summon ? [action.summon] : [];
  }

  private getQueuedSummons(): SummonAction[] {
    return this.normalizeSummons(this.pendingAction);
  }

  private setQueuedSummons(summons: SummonAction[]): void {
    if (summons.length > 0) {
      this.pendingAction.summons = summons;
      this.pendingAction.summon = summons[0];
      return;
    }
    delete this.pendingAction.summons;
    delete this.pendingAction.summon;
  }

  private getSummonLimit(): number {
    return this.summonLimitThisTurn;
  }

  private showBattleEvents(events: BattleEvent[], startDelay = 0): void {
    let shownEvents = 0;
    for (const ev of events) {
      if (ev.type === 'no_action') continue;
      this.time.delayedCall(startDelay + shownEvents * GameScene.BATTLE_EVENT_STAGGER_MS, () => this.playBattleImpactEvent(ev));
      shownEvents += 1;
    }
    if (shownEvents > 0) {
      this.time.delayedCall(startDelay, () => {
        this.statusTxt.setText(events.some(ev => ev.finisher) ? 'Final blow!' : 'Battle clash!');
      });
    }
  }

  private playBattleImpactEvent(ev: BattleEvent): void {
    const x = this.myField.getLaneWorldX(ev.laneIndex);
    const attackerIsMine = ev.attackerIndex === this.myIndex;
    const startY = attackerIsMine ? this.myField.y - 52 : this.opField.y + 52;
    const impactY = ev.type === 'direct_attack'
      ? attackerIsMine ? this.opLP.y + 18 : this.myLP.y - 18
      : this.scale.height / 2;
    const travelY = Phaser.Math.Linear(startY, impactY, 0.66);
    const overflowDamage = (ev.hpChanges ?? []).reduce((sum, change) => sum + Math.max(0, -change.hpAfter), 0);
    const labelText = ev.type === 'direct_attack'
      ? `LP -${ev.damage}`
      : ev.hpChanges?.length
        ? overflowDamage > 0 ? `HP -${ev.damage} / LP -${overflowDamage}` : `HP -${ev.damage}`
        : ev.negated ? 'NEGATED' : `-${ev.damage}`;
    const color = ev.negated ? '#88ffb0' : ev.type === 'direct_attack' ? '#ffdf7d' : '#ff667c';
    const angle = attackerIsMine ? -62 : 118;
    const windup = this.add.image(x, startY, ART_KEYS.glow)
      .setDisplaySize(86, 86)
      .setAlpha(0.0)
      .setTint(attackerIsMine ? 0xffd36f : 0xff6692)
      .setDepth(70);
    const slash = this.add.image(x, startY, ART_KEYS.slash)
      .setScale(0.46)
      .setAlpha(ev.negated ? 0.42 : 0.98)
      .setAngle(angle)
      .setDepth(72);
    const impactRing = this.add.circle(x, impactY, 26, ev.negated ? 0x88ffb0 : 0xffe29a, 0)
      .setStrokeStyle(6, ev.negated ? 0x88ffb0 : 0xffe29a, 0)
      .setDepth(73);
    const impactFlash = this.add.rectangle(x, impactY, 230, 150, ev.negated ? 0x65ffc6 : 0xfff1a6, 0)
      .setAngle(attackerIsMine ? -10 : 10)
      .setDepth(71);
    const label = this.add.text(x, impactY - 18, labelText, {
      fontSize: ev.type === 'direct_attack' ? '26px' : '28px',
      color,
      fontStyle: 'bold',
      stroke: '#11080c',
      strokeThickness: 6,
    }).setOrigin(0.5).setScale(0.65).setAlpha(0).setDepth(80);

    this.tweens.add({
      targets: windup,
      alpha: { from: 0, to: 0.42 },
      scaleX: { from: 0.5, to: 1.35 },
      scaleY: { from: 0.5, to: 1.35 },
      duration: 260,
      ease: 'Sine.easeOut',
    });
    this.tweens.add({
      targets: slash,
      y: travelY,
      scaleX: { from: 0.46, to: 1.08 },
      scaleY: { from: 0.46, to: 1.08 },
      duration: 360,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        this.cameras.main.shake(ev.finisher ? 420 : ev.type === 'direct_attack' ? 260 : 190, ev.finisher ? 0.012 : ev.negated ? 0.002 : 0.006);
        if (ev.finisher) this.playFinisherImpact(x, impactY, attackerIsMine);
        this.tweens.add({
          targets: slash,
          y: impactY,
          scaleX: 1.35,
          scaleY: 1.35,
          alpha: 0,
          duration: 190,
          ease: 'Cubic.easeOut',
        });
        this.tweens.add({
          targets: impactFlash,
          alpha: { from: ev.negated ? 0.22 : 0.42, to: 0 },
          scaleX: { from: 0.35, to: 1.25 },
          scaleY: { from: 0.25, to: 1.0 },
          duration: 340,
          ease: 'Quad.easeOut',
        });
        this.tweens.add({
          targets: impactRing,
          radius: { from: 26, to: ev.type === 'direct_attack' ? 92 : 72 },
          alpha: { from: 0.95, to: 0 },
          duration: 520,
          ease: 'Sine.easeOut',
        });
        this.tweens.add({
          targets: label,
          y: impactY - 72,
          scaleX: { from: 0.65, to: 1.08 },
          scaleY: { from: 0.65, to: 1.08 },
          alpha: { from: 0, to: 1 },
          duration: 300,
          ease: 'Back.easeOut',
          onComplete: () => {
            this.tweens.add({
              targets: label,
              y: impactY - 104,
              alpha: 0,
              duration: 1250,
              delay: 650,
              ease: 'Sine.easeIn',
              onComplete: () => label.destroy(),
            });
          },
        });
      },
    });
    this.tweens.add({
      targets: windup,
      alpha: 0,
      duration: 520,
      delay: 280,
      ease: 'Sine.easeOut',
    });
    this.time.delayedCall(1150, () => {
      windup.destroy();
      slash.destroy();
      impactRing.destroy();
      impactFlash.destroy();
    });
  }

  private playFinisherImpact(x: number, impactY: number, attackerIsMine: boolean): void {
    const { width, height } = this.scale;
    const tint = attackerIsMine ? 0xffd36f : 0xff5f86;
    const flash = this.add.rectangle(width / 2, height / 2, width, height, 0xfff1a6, 0)
      .setDepth(88);
    const beam = this.add.rectangle(x, impactY, 42, height * 0.72, tint, 0.0)
      .setAngle(attackerIsMine ? -18 : 18)
      .setDepth(89);
    const ring = this.add.circle(x, impactY, 36, tint, 0)
      .setStrokeStyle(9, tint, 0)
      .setDepth(90);
    const finishText = this.add.text(width / 2, height * 0.41, 'FINAL BLOW', {
      fontSize: '58px',
      color: '#fff4c6',
      fontStyle: 'bold',
      stroke: '#19070b',
      strokeThickness: 9,
    }).setOrigin(0.5).setAlpha(0).setScale(0.72).setDepth(91);
    const subText = this.add.text(width / 2, height * 0.50, 'LP 0', {
      fontSize: '25px',
      color: attackerIsMine ? '#8fffd2' : '#ff9bb0',
      fontStyle: 'bold',
      stroke: '#090b12',
      strokeThickness: 5,
    }).setOrigin(0.5).setAlpha(0).setDepth(91);

    this.tweens.add({
      targets: flash,
      alpha: { from: 0.0, to: 0.44 },
      duration: 140,
      yoyo: true,
      repeat: 1,
      ease: 'Sine.easeOut',
    });
    this.tweens.add({
      targets: beam,
      alpha: { from: 0, to: 0.76 },
      scaleX: { from: 0.45, to: 1.35 },
      scaleY: { from: 0.35, to: 1.06 },
      duration: 260,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        this.tweens.add({ targets: beam, alpha: 0, scaleX: 1.75, duration: 460, ease: 'Sine.easeIn' });
      },
    });
    this.tweens.add({
      targets: ring,
      radius: { from: 36, to: 210 },
      alpha: { from: 0.95, to: 0 },
      duration: 820,
      ease: 'Expo.easeOut',
    });
    this.tweens.add({
      targets: [finishText, subText],
      alpha: { from: 0, to: 1 },
      scaleX: { from: 0.72, to: 1.0 },
      scaleY: { from: 0.72, to: 1.0 },
      duration: 240,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: [finishText, subText],
          alpha: 0,
          y: '-=22',
          duration: 620,
          delay: 720,
          ease: 'Sine.easeIn',
        });
      },
    });

    this.time.delayedCall(1800, () => {
      flash.destroy();
      beam.destroy();
      ring.destroy();
      finishText.destroy();
      subText.destroy();
    });
  }
  }
