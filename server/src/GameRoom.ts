import { resolveBattle } from './BattleResolver';
import type {
  Card, GameState, LaneState, PlayerState, TurnAction,
  ServerMessage, PlayerIndex
} from '../../shared/types';
import cardsData from '../../shared/cards.json';

const ALL_CARDS = cardsData as Card[];
const INITIAL_LP = 4000;
const INITIAL_HAND_SIZE = 4;
const MAX_TURNS = 3;

export interface OutgoingMessage {
  playerIndex: PlayerIndex | 'both';
  message: ServerMessage;
}

function emptyLane(): LaneState {
  return { monster: null, trap: null, tempAtkBoost: 0 };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export class GameRoom {
  id: string;
  private state: GameState;
  private playerIds: [string | null, string | null] = [null, null];
  // Buffer for the first player's pending messages — pushed to when game starts
  private pendingMsgBuffer: OutgoingMessage[] | null = null;

  constructor(id: string) {
    this.id = id;
    this.state = {
      turn: 1,
      phase: 'waiting',
      players: [
        { index: 0, lp: INITIAL_LP, hand: [], deck: [], lanes: [emptyLane(), emptyLane(), emptyLane()] },
        { index: 1, lp: INITIAL_LP, hand: [], deck: [], lanes: [emptyLane(), emptyLane(), emptyLane()] },
      ],
      submitted: [false, false],
      pendingActions: [null, null],
      winner: null,
    };
  }

  getState(): GameState { return this.state; }

  addPlayer(playerId: string, deck: Card[]): OutgoingMessage[] {
    if (deck.length < 8 || deck.length > 12) {
      const idx = this.playerIds[0] === null ? 0 : 1;
      return [{ playerIndex: idx as PlayerIndex, message: { type: 'error', message: '덱은 8~12장이어야 합니다.' } }];
    }
    const index = this.playerIds[0] === null ? 0 : 1;
    this.playerIds[index] = playerId;
    const shuffled = shuffle(deck);
    const hand = shuffled.splice(0, INITIAL_HAND_SIZE);
    this.state.players[index].deck = shuffled;
    this.state.players[index].hand = hand;

    if (index === 0) {
      // First player: return a mutable buffer that will be populated when game starts
      const buf: OutgoingMessage[] = [];
      this.pendingMsgBuffer = buf;
      return buf;
    }

    // Second player: game starts now
    this.state.phase = 'action';

    const p0Start: OutgoingMessage = {
      playerIndex: 0,
      message: { type: 'game_start', yourIndex: 0, yourHand: this.state.players[0].hand, opponentHandCount: INITIAL_HAND_SIZE, turn: 1 },
    };
    const p1Start: OutgoingMessage = {
      playerIndex: 1,
      message: { type: 'game_start', yourIndex: 1, yourHand: this.state.players[1].hand, opponentHandCount: INITIAL_HAND_SIZE, turn: 1 },
    };

    // Push p0's game_start into the buffer that was returned to the first addPlayer caller
    if (this.pendingMsgBuffer) {
      this.pendingMsgBuffer.push(p0Start);
    }

    // Return p1's game_start (plus p0's for completeness, so both messages are accessible)
    return [p0Start, p1Start];
  }

  submitAction(playerIndex: PlayerIndex, action: TurnAction): OutgoingMessage[] {
    if (this.state.phase !== 'action') return [];
    this.state.pendingActions[playerIndex] = action;
    this.state.submitted[playerIndex] = true;

    if (!this.state.submitted[0] || !this.state.submitted[1]) return [];

    // 양쪽 제출 완료 → 처리
    return this.resolveActions();
  }

  private resolveActions(): OutgoingMessage[] {
    const msgs: OutgoingMessage[] = [];
    const [a0, a1] = this.state.pendingActions as [TurnAction, TurnAction];

    // reveal
    msgs.push({ playerIndex: 0, message: { type: 'reveal', yourAction: a0, opponentAction: a1 } });
    msgs.push({ playerIndex: 1, message: { type: 'reveal', yourAction: a1, opponentAction: a0 } });

    // 액션 적용
    this.applyAction(0, a0);
    this.applyAction(1, a1);

    // 전투 해결
    const { events, p0LpDelta, p1LpDelta } = resolveBattle(
      this.state.players[0],
      this.state.players[1]
    );

    // 파괴된 몬스터 제거
    for (const ev of events) {
      for (const { playerIndex, card } of ev.destroyedCards) {
        const lane = this.state.players[playerIndex].lanes[ev.laneIndex];
        if (lane.monster?.id === card.id) lane.monster = null;
      }
      // 발동된 트랩 제거
      if (ev.trapTriggered) {
        const { playerIndex } = ev.trapTriggered;
        this.state.players[playerIndex].lanes[ev.laneIndex].trap = null;
      }
    }

    // tempAtkBoost 초기화
    for (const p of this.state.players) {
      for (const l of p.lanes) l.tempAtkBoost = 0;
    }

    // LP 갱신
    this.state.players[0].lp += p0LpDelta;
    this.state.players[1].lp += p1LpDelta;

    const lps: [number, number] = [this.state.players[0].lp, this.state.players[1].lp];
    msgs.push({ playerIndex: 'both', message: { type: 'battle_result', events, lps } });

    // 즉시 패배 판정
    const p0Dead = this.state.players[0].lp <= 0;
    const p1Dead = this.state.players[1].lp <= 0;
    if (p0Dead || p1Dead) {
      const winner = p0Dead && p1Dead ? 'draw' : p0Dead ? 1 : 0;
      this.state.winner = winner;
      this.state.phase = 'game_over';
      msgs.push({ playerIndex: 'both', message: { type: 'game_over', winner, finalLPs: lps } });
      return msgs;
    }

    // 다음 턴 또는 파이널 배틀
    this.state.submitted = [false, false];
    this.state.pendingActions = [null, null];

    if (this.state.turn >= MAX_TURNS) {
      // 파이널 배틀 페이즈 — 바로 처리
      this.state.phase = 'final_battle';
      return msgs.concat(this.resolveFinalBattle());
    }

    this.state.turn += 1;
    this.state.phase = 'action';

    // 드로우
    for (const pi of [0, 1] as PlayerIndex[]) {
      const drawn = this.state.players[pi].deck.shift();
      if (drawn) {
        this.state.players[pi].hand.push(drawn);
        msgs.push({ playerIndex: pi, message: { type: 'turn_start', drawnCard: drawn, turn: this.state.turn } });
      }
    }

    return msgs;
  }

  private resolveFinalBattle(): OutgoingMessage[] {
    const msgs: OutgoingMessage[] = [];
    const { events, p0LpDelta, p1LpDelta } = resolveBattle(
      this.state.players[0],
      this.state.players[1]
    );

    this.state.players[0].lp += p0LpDelta;
    this.state.players[1].lp += p1LpDelta;

    const lps: [number, number] = [this.state.players[0].lp, this.state.players[1].lp];
    msgs.push({ playerIndex: 'both', message: { type: 'battle_result', events, lps } });

    const p0Lp = this.state.players[0].lp;
    const p1Lp = this.state.players[1].lp;
    const winner: PlayerIndex | 'draw' =
      p0Lp > p1Lp ? 0 : p1Lp > p0Lp ? 1 : 'draw';

    this.state.winner = winner;
    this.state.phase = 'game_over';
    msgs.push({ playerIndex: 'both', message: { type: 'game_over', winner, finalLPs: lps } });
    return msgs;
  }

  private applyAction(playerIndex: PlayerIndex, action: TurnAction): void {
    const player = this.state.players[playerIndex];

    // 소환
    if (action.summon) {
      const { card, laneIndex } = action.summon;
      if (!player.lanes[laneIndex].monster) {
        player.lanes[laneIndex].monster = card;
        player.hand = player.hand.filter(c => c.id !== card.id);
      }
    }

    // 마법
    for (const spell of action.spells) {
      this.applySpell(playerIndex, spell);
      player.hand = player.hand.filter(c => c.id !== spell.id);
    }

    // 함정 세트
    for (const { card, laneIndex } of action.traps) {
      player.lanes[laneIndex].trap = card;
      player.hand = player.hand.filter(c => c.id !== card.id);
    }
  }

  private applySpell(playerIndex: PlayerIndex, spell: Card): void {
    const player = this.state.players[playerIndex];
    const opponent = this.state.players[playerIndex === 0 ? 1 : 0];

    switch (spell.effect) {
      case 'heal_1000':
        player.lp += 1000;
        break;
      case 'power_boost':
        for (const l of player.lanes) {
          if (l.monster) l.tempAtkBoost += 500;
        }
        break;
      case 'monster_smash': {
        // 상대 필드에서 ATK 가장 높은 몬스터 파괴
        let maxAtk = -1;
        let maxLaneIdx = -1;
        for (let i = 0; i < 3; i++) {
          const m = opponent.lanes[i].monster;
          if (m && (m.atk ?? 0) > maxAtk) {
            maxAtk = m.atk ?? 0;
            maxLaneIdx = i;
          }
        }
        if (maxLaneIdx >= 0) opponent.lanes[maxLaneIdx as 0 | 1 | 2].monster = null;
        break;
      }
    }
  }
}
