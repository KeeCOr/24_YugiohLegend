import Phaser from 'phaser';
import { SocketManager } from '../network/SocketManager';
import { Field } from '../components/Field';
import { HandArea } from '../components/HandArea';
import { LPDisplay } from '../components/LPDisplay';
import type {
  Card, TurnAction, ServerMessage, BattleEvent, PlayerIndex, LaneIndex,
} from '../data/CardTypes';
import { ALL_CARDS } from './BootScene';

interface GameSceneData {
  mode: 'single' | 'multi';
  deck?: Card[];
}

export class GameScene extends Phaser.Scene {
  private socket!: SocketManager;
  private myIndex: PlayerIndex = 0;
  private turn = 1;

  // 상태
  private myHand: Card[] = [];
  private pendingAction: TurnAction = { spells: [], traps: [] };
  private selectedCard: Card | null = null;
  private submitted = false;

  // UI
  private myField!: Field;
  private opField!: Field;
  private myLP!: LPDisplay;
  private opLP!: LPDisplay;
  private handArea!: HandArea;
  private submitBtn!: Phaser.GameObjects.Rectangle;
  private submitTxt!: Phaser.GameObjects.Text;
  private statusTxt!: Phaser.GameObjects.Text;
  private turnTxt!: Phaser.GameObjects.Text;

  constructor() { super('GameScene'); }

  init(_data: GameSceneData): void {
    this.pendingAction = { spells: [], traps: [] };
    this.selectedCard = null;
    this.submitted = false;
    this.myHand = [];
  }

  async create(data: GameSceneData): Promise<void> {
    const { width, height } = this.scale;

    // 덱 (기본 덱: 처음 10장)
    const deck: Card[] = data.deck ?? ALL_CARDS.slice(0, 8).concat(ALL_CARDS.slice(0, 2));

    // 소켓 초기화 (init에서 하면 씬 재시작 시 이전 연결이 남음)
    this.socket = new SocketManager();

    // 필드
    this.opField = new Field(this, width / 2, height * 0.22, 1);
    this.myField = new Field(this, width / 2, height * 0.6, 0);

    // LP 표시
    this.myLP = new LPDisplay(this, 20, height - 40, '나');
    this.opLP = new LPDisplay(this, 20, 30, '상대');

    // 핸드
    this.handArea = new HandArea(this, width / 2, height - 80, (card, _sprite) => {
      this.selectedCard = card;
      if (card.type === 'spell') {
        this.useSpell(card);
      } else {
        this.statusTxt.setText(`선택: ${card.name} — 레인을 클릭하여 배치`);
      }
    });

    // 제출 버튼
    this.submitBtn = this.add.rectangle(width - 80, height - 50, 140, 45, 0x334477).setInteractive();
    this.submitTxt = this.add.text(width - 80, height - 50, '제출', { fontSize: '18px', color: '#ffffff' }).setOrigin(0.5);
    this.submitBtn.on('pointerdown', () => this.submitAction());
    this.submitBtn.on('pointerover', () => this.submitBtn.setFillStyle(0x4466aa));
    this.submitBtn.on('pointerout',  () => this.submitBtn.setFillStyle(0x334477));

    // 상태/턴 텍스트
    this.statusTxt = this.add.text(width / 2, height - 130, '', { fontSize: '14px', color: '#aaaaaa' }).setOrigin(0.5);
    this.turnTxt   = this.add.text(width / 2, 10, '턴 1 / 3', { fontSize: '16px', color: '#ffffff' }).setOrigin(0.5);

    // 레인 클릭 인터랙션
    this.setupLaneInteraction();

    // 서버 연결
    await this.socket.connect();
    this.socket.on((msg) => this.handleServerMessage(msg));
    this.socket.send({ type: 'join_room', mode: data.mode, deck });
  }

  private setupLaneInteraction(): void {
    const { height } = this.scale;
    for (let i = 0; i < 3; i++) {
      const laneIndex = i as LaneIndex;
      const hitArea = this.add.rectangle(
        this.myField.getLaneWorldX(laneIndex), height * 0.6,
        100, 150, 0x000000, 0
      ).setInteractive();
      hitArea.on('pointerdown', () => this.onLaneClick(laneIndex));
    }
  }

  private onLaneClick(laneIndex: LaneIndex): void {
    if (!this.selectedCard || this.submitted) return;
    const card = this.selectedCard;

    if (card.type === 'monster') {
      if (this.pendingAction.summon) {
        this.statusTxt.setText('이번 턴에 이미 소환했습니다.');
        return;
      }
      this.pendingAction.summon = { card, laneIndex };
      this.myHand = this.myHand.filter(c => c.id !== card.id);
      this.handArea.removeCard(card.id);
      this.statusTxt.setText(`${card.name} → 레인 ${laneIndex + 1} 소환 예정`);
    } else if (card.type === 'trap') {
      this.pendingAction.traps.push({ card, laneIndex });
      this.myHand = this.myHand.filter(c => c.id !== card.id);
      this.handArea.removeCard(card.id);
      this.statusTxt.setText(`${card.name} → 레인 ${laneIndex + 1} 세트 예정`);
    }

    this.selectedCard = null;
    this.handArea.deselectAll();
  }

  private useSpell(card: Card): void {
    this.pendingAction.spells.push(card);
    this.myHand = this.myHand.filter(c => c.id !== card.id);
    this.handArea.removeCard(card.id);
    this.statusTxt.setText(`${card.name} 사용 예정`);
    this.selectedCard = null;
    this.handArea.deselectAll();
  }

  private submitAction(): void {
    if (this.submitted) return;
    this.submitted = true;
    this.submitBtn.setFillStyle(0x222222);
    this.submitTxt.setText('대기 중...');
    this.socket.send({ type: 'submit_action', action: this.pendingAction });
    this.statusTxt.setText('상대방을 기다리는 중...');
  }

  private handleServerMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case 'game_start':
        this.myIndex = msg.yourIndex;
        this.myHand = [...msg.yourHand];
        this.handArea.setHand(this.myHand);
        this.turn = msg.turn;
        this.turnTxt.setText(`턴 ${this.turn} / 3`);
        this.statusTxt.setText('행동을 입력하세요');
        break;

      case 'turn_start':
        this.submitted = false;
        this.pendingAction = { spells: [], traps: [] };
        this.turn = msg.turn;
        this.turnTxt.setText(`턴 ${this.turn} / 3`);
        this.myHand.push(msg.drawnCard);
        this.handArea.setHand(this.myHand);
        this.submitBtn.setFillStyle(0x334477);
        this.submitTxt.setText('제출');
        this.statusTxt.setText('행동을 입력하세요');
        break;

      case 'reveal':
        this.statusTxt.setText('전투 해결 중...');
        break;

      case 'battle_result':
        this.myLP.update(msg.lps[this.myIndex]);
        this.opLP.update(msg.lps[this.myIndex === 0 ? 1 : 0]);
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
        this.statusTxt.setText(`오류: ${msg.message}`);
        break;
    }
  }

  private showBattleEvents(events: BattleEvent[]): void {
    for (const ev of events) {
      if (ev.type === 'no_action') continue;
      const x = this.myField.getLaneWorldX(ev.laneIndex);
      const y = this.scale.height / 2;
      const txt = ev.type === 'direct_attack'
        ? `다이렉트 -${ev.damage}`
        : ev.negated ? `무효!` : `-${ev.damage}`;
      const color = ev.negated ? '#88ff88' : '#ff4444';
      const label = this.add.text(x, y, txt, { fontSize: '20px', color, fontStyle: 'bold' }).setOrigin(0.5);
      this.tweens.add({
        targets: label,
        y: y - 50,
        alpha: 0,
        duration: 1200,
        onComplete: () => label.destroy(),
      });
    }
  }
}
