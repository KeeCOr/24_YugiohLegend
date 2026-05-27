import Phaser from 'phaser';
import { ART_KEYS, addSceneBackdrop } from '../art/ProceduralArt';
import { Field } from '../components/Field';
import { HandArea } from '../components/HandArea';
import { LPDisplay } from '../components/LPDisplay';
import { SocketManager } from '../network/SocketManager';
import type {
  BattleEvent, Card, LaneIndex, LaneState, PlayerIndex, ServerMessage, TurnAction,
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
    this.socket = new SocketManager();
    const boardX = width * 0.56;
    const sideX = width * 0.83;

    this.add.image(boardX, height * 0.47, ART_KEYS.panel).setDisplaySize(850, 90).setAlpha(0.58);
    this.add.text(boardX, height * 0.47, 'BATTLE LINE', {
      fontSize: '13px',
      color: '#d8b56a',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.opField = new Field(this, boardX, height * 0.245, 1);
    this.myField = new Field(this, boardX, height * 0.685, 0);
    this.updateLaneUnlocks();

    this.myLP = new LPDisplay(this, sideX, height * 0.54, 'YOU');
    this.myLP.setScale(1.32);
    this.opLP = new LPDisplay(this, sideX, height * 0.21, 'RIVAL');
    this.opLP.setScale(1.32);

    this.handArea = new HandArea(this, 285, height * 0.53, (card, _sprite) => {
      this.selectedCard = card;
      if (card.type === 'spell') {
        const text = card.spellMode === 'face_down'
          ? `${card.name}: set face-down. It triggers on condition. Click one of your lanes.`
          : `${card.name}: resolves after ${card.spellDelayTurns ?? 1} turn. Click one of your lanes.`;
        this.statusTxt.setText(text);
      } else {
        const summonText = this.getSummonText(card);
        this.statusTxt.setText(`${card.name}: ${summonText}. Click one of your lanes.`);
      }
    });

    this.submitBtn = this.add.image(width - 178, height * 0.82, ART_KEYS.button).setDisplaySize(250, 86).setInteractive();
    this.submitTxt = this.add.text(width - 178, height * 0.82, 'COMMIT', {
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.submitBtn.on('pointerdown', () => this.submitAction());
    this.submitBtn.on('pointerover', () => this.submitBtn.setTint(0xffe29a));
    this.submitBtn.on('pointerout', () => this.submitBtn.clearTint());

    this.statusTxt = this.add.text(boardX, height * 0.93, 'Preparing duel...', {
      fontSize: '18px',
      color: '#d8e7ff',
      stroke: '#080b12',
      strokeThickness: 3,
      wordWrap: { width: 820 },
      align: 'center',
    }).setOrigin(0.5);
    this.turnTxt = this.add.text(boardX, height * 0.055, `TURN 1 / ${GameScene.MAX_TURNS}`, {
      fontSize: '24px',
      color: '#f2c86a',
      fontStyle: 'bold',
      stroke: '#120912',
      strokeThickness: 3,
    }).setOrigin(0.5);

    this.setupLaneInteraction();

    await this.socket.connect();
    this.socket.on((msg) => this.handleServerMessage(msg));
    this.socket.send({ type: 'join_room', mode: data.mode, deck });
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
    if (!this.selectedCard || this.submitted) return;
    if (!this.isLaneUnlocked(laneIndex)) {
      this.statusTxt.setText(`Lane ${laneIndex + 1} is locked this turn.`);
      return;
    }
    const card = this.selectedCard;

    if (card.type === 'monster') {
      if (this.pendingAction.summon) {
        this.statusTxt.setText('Only one monster can be summoned this turn.');
        return;
      }
      const tributeCost = card.tributeCost ?? 0;
      const tributeLaneIndices = this.getAutoTributeLaneIndices(tributeCost);
      if (tributeLaneIndices.length < tributeCost) {
        this.statusTxt.setText(`${card.name} needs ${tributeCost} tribute monster${tributeCost > 1 ? 's' : ''}.`);
        return;
      }
      if (this.myLanes?.[laneIndex].monster || this.myField.hasPending(laneIndex)) {
        this.statusTxt.setText('That lane already has a monster. Choose an empty lane.');
        return;
      }
      this.pendingAction.summon = tributeCost > 0 ? { card, laneIndex, tributeLaneIndices } : { card, laneIndex };
      this.myField.setPendingCard(laneIndex, card);
      this.myHand = this.myHand.filter(c => c.id !== card.id);
      this.handArea.removeCard(card.id);
      this.updatePlayableHandCards();
      const tributeText = tributeCost > 0 ? ` Tribute lanes: ${tributeLaneIndices.map(i => i + 1).join(', ')}.` : '';
      this.statusTxt.setText(`${card.name} queued in lane ${laneIndex + 1}.${tributeText} Press COMMIT.`);
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
      this.statusTxt.setText(faceDown
        ? `${card.name} set face-down in lane ${laneIndex + 1}. Press COMMIT.`
        : `${card.name} set face-up in lane ${laneIndex + 1}. It will resolve later.`);
    }

    this.selectedCard = null;
    this.handArea.deselectAll();
  }

  private submitAction(): void {
    if (this.submitted) return;
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
        this.handArea.setHand(this.myHand);
        this.turn = msg.turn;
        this.turnTxt.setText(`TURN ${this.turn} / ${GameScene.MAX_TURNS}`);
        this.updateLaneUnlocks();
        this.updatePlayableHandCards();
        this.statusTxt.setText('Setup turn: place cards. Attacks start on turn 2.');
        break;

      case 'turn_start':
        this.submitted = false;
        this.pendingAction = { spells: [] };
        this.turn = msg.turn;
        this.turnTxt.setText(`TURN ${this.turn} / ${GameScene.MAX_TURNS}`);
        this.updateLaneUnlocks();
        this.myHand.push(msg.drawnCard);
        this.handArea.setHand(this.myHand);
        this.submitBtn.setAlpha(1);
        this.submitTxt.setText('COMMIT');
        this.statusTxt.setText('New draw. Prepare your lane.');
        this.updatePlayableHandCards();
        break;

      case 'reveal':
        this.showOpponentPending(msg.opponentAction);
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

  private showOpponentPending(action: TurnAction): void {
    this.opField.clearPending();
    if (action.summon) {
      this.opField.setPendingCard(action.summon.laneIndex, action.summon.card);
    }
    for (const spell of action.spells) {
      this.opField.setPendingCard(spell.laneIndex, spell.card, spell.card.spellMode === 'face_down');
    }
  }

  private applyLaneState(lanes: [LaneState[], LaneState[]]): void {
    const my = lanes[this.myIndex];
    const op = lanes[this.myIndex === 0 ? 1 : 0];
    this.myLanes = my;
    this.opLanes = op;
    this.myField.updateLanes(my);
    this.opField.updateLanes(op);
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

  private getAutoTributeLaneIndices(cost: number): LaneIndex[] {
    if (cost <= 0 || !this.myLanes) return [];
    return LANE_INDICES
      .filter(laneIndex => this.myLanes?.[laneIndex].monster)
      .sort((a, b) => (this.myLanes?.[a].monster?.atk ?? 0) - (this.myLanes?.[b].monster?.atk ?? 0))
      .slice(0, cost);
  }

  private updatePlayableHandCards(): void {
    if (!this.handArea) return;
    const playable = new Set<string>();
    for (const card of this.myHand) {
      if (this.canPlayCardNow(card)) playable.add(card.id);
    }
    this.handArea.setPlayableCards(playable);
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
    if (this.pendingAction.summon) return false;
    const tributeCost = card.tributeCost ?? 0;
    return this.getAutoTributeLaneIndices(tributeCost).length >= tributeCost;
  }

  private showBattleEvents(events: BattleEvent[]): void {
    for (const ev of events) {
      if (ev.type === 'no_action') continue;
      const x = this.myField.getLaneWorldX(ev.laneIndex);
      const y = this.scale.height / 2;
      const labelText = ev.type === 'direct_attack'
        ? `DIRECT -${ev.damage}`
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
