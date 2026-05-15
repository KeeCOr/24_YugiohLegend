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

interface GameSceneData {
  mode: 'single' | 'multi';
  deck?: Card[];
}

export class GameScene extends Phaser.Scene {
  private static readonly MAX_TURNS = 4;
  private socket!: SocketManager;
  private myIndex: PlayerIndex = 0;
  private turn = 1;

  private myHand: Card[] = [];
  private myLanes: [LaneState, LaneState, LaneState] | null = null;
  private opLanes: [LaneState, LaneState, LaneState] | null = null;
  private pendingAction: TurnAction = { spells: [], traps: [] };
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
    this.pendingAction = { spells: [], traps: [] };
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

    this.add.image(width / 2, height / 2, ART_KEYS.panel).setDisplaySize(760, 76).setAlpha(0.58);
    this.add.text(width / 2, height / 2, 'BATTLE LINE', {
      fontSize: '13px',
      color: '#d8b56a',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.opField = new Field(this, width / 2, height * 0.23, 1);
    this.myField = new Field(this, width / 2, height * 0.59, 0);

    this.myLP = new LPDisplay(this, 20, height - 42, 'YOU');
    this.opLP = new LPDisplay(this, 20, 38, 'RIVAL');

    this.handArea = new HandArea(this, width / 2, height - 86, (card, _sprite) => {
      this.selectedCard = card;
      if (card.type === 'spell') {
        this.useSpell(card);
      } else {
        const summonText = this.getSummonText(card);
        this.statusTxt.setText(`${card.name}: ${summonText}. Click one of your lanes.`);
      }
    });

    this.submitBtn = this.add.image(width - 90, height - 50, ART_KEYS.button).setDisplaySize(150, 44).setInteractive();
    this.submitTxt = this.add.text(width - 90, height - 50, 'COMMIT', {
      fontSize: '16px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.submitBtn.on('pointerdown', () => this.submitAction());
    this.submitBtn.on('pointerover', () => this.submitBtn.setTint(0xffe29a));
    this.submitBtn.on('pointerout', () => this.submitBtn.clearTint());

    this.statusTxt = this.add.text(width / 2, height - 153, 'Preparing duel...', {
      fontSize: '15px',
      color: '#d8e7ff',
    }).setOrigin(0.5);
    this.turnTxt = this.add.text(width / 2, 18, `TURN 1 / ${GameScene.MAX_TURNS}`, {
      fontSize: '18px',
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
    for (let i = 0; i < 3; i++) {
      const laneIndex = i as LaneIndex;
      const hitArea = this.add.rectangle(
        this.myField.getLaneWorldX(laneIndex),
        this.myField.y,
        136,
        176,
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
    const card = this.selectedCard;

    if (card.type === 'monster') {
      if (this.pendingAction.summon) {
        this.statusTxt.setText('Only one monster can be summoned this turn.');
        return;
      }
      if (this.myLanes?.[laneIndex].monster || this.myField.hasPending(laneIndex)) {
        this.statusTxt.setText('That lane already has a monster. Choose an empty lane.');
        return;
      }
      this.pendingAction.summon = { card, laneIndex };
      this.myField.setPendingCard(laneIndex, card);
      this.myHand = this.myHand.filter(c => c.id !== card.id);
      this.handArea.removeCard(card.id);
      this.statusTxt.setText(`${card.name} queued in lane ${laneIndex + 1}. Press COMMIT.`);
    } else if (card.type === 'trap') {
      if (this.myLanes?.[laneIndex].trap) {
        this.statusTxt.setText('That lane already has a trap.');
        return;
      }
      this.pendingAction.traps.push({ card, laneIndex });
      this.myField.setPendingCard(laneIndex, card, true);
      this.myHand = this.myHand.filter(c => c.id !== card.id);
      this.handArea.removeCard(card.id);
      this.statusTxt.setText(`${card.name} set in lane ${laneIndex + 1}. Press COMMIT.`);
    }

    this.selectedCard = null;
    this.handArea.deselectAll();
  }

  private useSpell(card: Card): void {
    this.pendingAction.spells.push(card);
    this.myHand = this.myHand.filter(c => c.id !== card.id);
    this.handArea.removeCard(card.id);
    this.statusTxt.setText(`${card.name} is queued.`);
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
        this.statusTxt.setText('Setup turn: place cards. Attacks start on turn 2.');
        break;

      case 'turn_start':
        this.submitted = false;
        this.pendingAction = { spells: [], traps: [] };
        this.turn = msg.turn;
        this.turnTxt.setText(`TURN ${this.turn} / ${GameScene.MAX_TURNS}`);
        this.myHand.push(msg.drawnCard);
        this.handArea.setHand(this.myHand);
        this.submitBtn.setAlpha(1);
        this.submitTxt.setText('COMMIT');
        this.statusTxt.setText('New draw. Prepare your lane.');
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
    for (const trap of action.traps) {
      this.opField.setPendingCard(trap.laneIndex, trap.card, true);
    }
  }

  private applyLaneState(lanes: [LaneState[], LaneState[]]): void {
    const my = lanes[this.myIndex] as [LaneState, LaneState, LaneState];
    const op = lanes[this.myIndex === 0 ? 1 : 0] as [LaneState, LaneState, LaneState];
    this.myLanes = my;
    this.opLanes = op;
    this.myField.updateLanes(my);
    this.opField.updateLanes(op);
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
