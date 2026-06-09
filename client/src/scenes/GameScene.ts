import Phaser from 'phaser';
import { ART_KEYS, addSceneBackdrop, cardArtKey } from '../art/ProceduralArt';
import { Field } from '../components/Field';
import { HandArea } from '../components/HandArea';
import { LPDisplay } from '../components/LPDisplay';
import { getSpellEffectSummary, getSpellTimingSummary } from '../data/CardText';
import { SocketManager } from '../network/SocketManager';
import type {
  BattleEvent, Card, LaneIndex, LaneState, PlayerIndex, ServerMessage, SummonAction, TurnAction,
} from '../data/CardTypes';
import { ALL_CARDS } from './BootScene';

const LANE_COUNT = 3;
const LANE_INDICES: LaneIndex[] = [0, 1, 2];

interface GameSceneData {
  mode: 'single' | 'multi';
  deck?: Card[];
}

export class GameScene extends Phaser.Scene {
  private static readonly MAX_TURNS = 4;
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
  private startingDeckSize = 0;
  private myDeckCount = 0;
  private opDeckCount = 0;
  private summonLimitThisTurn = 1;
  private commitReady = false;
  private surrenderBtn!: Phaser.GameObjects.Text;
  private surrenderPending = false;
  private surrenderTimer?: Phaser.Time.TimerEvent;

  constructor() { super('GameScene'); }

  init(_data: GameSceneData): void {
    this.pendingAction = { spells: [] };
    this.selectedCard = null;
    this.submitted = false;
    this.myHand = [];
    this.myLanes = null;
    this.opLanes = null;
  }

  async create(data: GameSceneData): Promise<void> {
    const { width, height } = this.scale;
    addSceneBackdrop(this);

    const deck: Card[] = data.deck ?? ALL_CARDS.slice(0, 8).concat(ALL_CARDS.slice(0, 2));
    this.startingDeckSize = deck.length;
    this.socket = new SocketManager();
    const boardX = width * 0.52;
    const sideCenter = width - 205;
    const lpX = sideCenter - 119;
    this.createTopHud(boardX, width, sideCenter);

    this.add.image(boardX, height * 0.435, ART_KEYS.hudFrame).setDisplaySize(850, 60).setAlpha(0.58);
    this.add.text(boardX, height * 0.435, 'BATTLE LINE', {
      fontSize: '13px',
      color: '#d8b56a',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.opField = new Field(this, boardX, height * 0.270, 1);
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
      if (card.type === 'spell') {
        const text = `${card.name}: ${getSpellTimingSummary(card)} - ${getSpellEffectSummary(card)}. Click or drag to your lane.`;
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

    this.surrenderBtn = this.add.text(sideCenter, height * 0.974, '??났', {
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
      if (this.myLanes?.[laneIndex].monster || this.myField.hasPending(laneIndex)) {
        this.statusTxt.setText('That lane already has a monster. Choose an empty lane.');
        return;
      }
      const queuedSummons = this.getQueuedSummons();
      const tributeLaneIndices = tributeCost > 0 ? this.getAutoTributeLaneIndices(tributeCost, laneIndex) : [];
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
        ? `${card.name} auto-paid ${tributeCost} tribute${tributeCost > 1 ? 's' : ''} and queued in lane ${laneIndex + 1}. Press COMMIT.`
        : `${card.name} queued in lane ${laneIndex + 1}. ${this.getQueuedSummons().length}/${this.getSummonLimit()} summon used.`);
    } else if (card.type === 'spell') {
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
      this.surrenderBtn.setText('??났 以?..');
      this.surrenderBtn.setColor('#ff667c');
      this.surrenderBtn.disableInteractive();
      this.socket.send({ type: 'forfeit' });
    } else {
      this.surrenderPending = true;
      this.surrenderBtn.setText('?뺤씤?');
      this.surrenderBtn.setColor('#ff667c');
      this.surrenderTimer = this.time.delayedCall(3000, () => {
        this.surrenderPending = false;
        this.surrenderBtn.setText('??났');
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
        break;

      case 'reveal':
        this.keepOpponentLastConfirmedField();
        this.statusTxt.setText('Actions revealed. Battle resolving...');
        break;

      case 'battle_result':
        this.myLP.update(msg.lps[this.myIndex]);
        this.opLP.update(msg.lps[this.myIndex === 0 ? 1 : 0]);
        this.applyLaneState(msg.lanes);
        this.showBattleEvents(msg.events);
        break;

      case 'game_over':
        this.socket.disconnect();
        this.time.delayedCall(1500, () => {
          this.scene.start('ResultScene', {
            winner: msg.winner,
            myIndex: this.myIndex,
            finalLPs: msg.finalLPs,
          });
        });
        break;

      case 'waiting':
        this.statusTxt.setText(msg.message);
        break;

      case 'error':
        this.statusTxt.setText(`Error: ${msg.message}`);
        break;
    }
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
  }

  private isLaneUnlocked(laneIndex: LaneIndex): boolean {
    return GameScene.getUnlockedLanes(this.turn).includes(laneIndex);
  }

  private updateLaneUnlocks(): void {
    if (!this.myField || !this.opField) return;
    const unlocked = GameScene.getUnlockedLanes(this.turn);
    this.myField.setUnlockedLanes(unlocked);
    this.opField.setUnlockedLanes(unlocked);
  }

  private getTributeCandidateLaneIndices(): LaneIndex[] {
    if (!this.myLanes) return [];
    return LANE_INDICES.filter(laneIndex => Boolean(this.myLanes?.[laneIndex].monster));
  }

  private getAutoTributeLaneIndices(tributeCost: number, summonLaneIndex: LaneIndex): LaneIndex[] {
    if (!this.myLanes || tributeCost <= 0) return [];
    return LANE_INDICES
      .filter(laneIndex => laneIndex !== summonLaneIndex && Boolean(this.myLanes?.[laneIndex].monster))
      .sort((a, b) => (this.myLanes?.[a].monster?.atk ?? 0) - (this.myLanes?.[b].monster?.atk ?? 0))
      .slice(0, tributeCost);
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
      if (card.type === 'monster') return !lane?.monster;
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
      return 'No open unlocked monster lane.';
    }
    return 'No open unlocked spell slot for this card.';
  }

  private showCardHelp(card: Card): void {
    const reason = this.getPlayBlockReason(card);
    if (this.canPlayCardNow(card)) {
      const lanes = this.getPlayableLaneIndices(card).map(i => i + 1).join(', ');
      if (card.type === 'spell') {
        this.statusTxt.setText(`${card.name}: ${getSpellEffectSummary(card)}. Valid lane${lanes.includes(',') ? 's' : ''}: ${lanes}.`);
        return;
      }
      this.statusTxt.setText(`${card.name}: playable now. Valid lane${lanes.includes(',') ? 's' : ''}: ${lanes}.`);
      return;
    }
    this.statusTxt.setText(card.type === 'spell'
      ? `${card.name}: ${getSpellEffectSummary(card)}. Cannot play now. ${reason}`
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
      if (card.type === 'monster') return !lane?.monster && !pending;
      if (card.type === 'spell') {
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

  private showBattleEvents(events: BattleEvent[]): void {
    for (const ev of events) {
      if (ev.type === 'no_action') continue;
      const x = this.myField.getLaneWorldX(ev.laneIndex);
      const y = this.scale.height / 2;
      const overflowDamage = (ev.hpChanges ?? []).reduce((sum, change) => sum + Math.max(0, -change.hpAfter), 0);
      const labelText = ev.type === 'direct_attack'
        ? `DIRECT -${ev.damage}`
        : ev.hpChanges?.length
          ? overflowDamage > 0 ? `HP -${ev.damage} / LP -${overflowDamage}` : `HP -${ev.damage}`
          : ev.negated ? 'NEGATED' : `-${ev.damage}`;
      const color = ev.negated ? '#88ffb0' : '#ff667c';

      const slash = this.add.image(x, y, ART_KEYS.slash).setScale(0.6).setAlpha(ev.negated ? 0.35 : 0.95);
      const label = this.add.text(x, y - 8, labelText, {
        fontSize: '22px',
        color,
        fontStyle: 'bold',
        stroke: '#11080c',
        strokeThickness: 4,
      }).setOrigin(0.5);

      this.tweens.add({
        targets: [label, slash],
        y: y - 58,
        alpha: 0,
        duration: 1200,
        ease: 'Sine.easeOut',
        onComplete: () => {
          label.destroy();
          slash.destroy();
        },
      });
    }
  }
}

