import { resolveBattle } from './BattleResolver';
import type {
  Card, GameState, LaneState, PlayerState, SummonAction, TurnAction,
  ServerMessage, PlayerIndex, LaneIndex, TurnSummary
} from '../../shared/types';
import { LANE_INDICES } from '../../shared/types';
import cardsData from '../../shared/cards.json';

const ALL_CARDS = cardsData as Card[];
const INITIAL_LP = 4000;
const INITIAL_HAND_SIZE = 4;
const SETUP_TURN = 1;
const MAX_TURNS = 4;
const UNLOCKED_LANES_BY_TURN: Record<number, LaneIndex[]> = {
  1: [0],
  2: [0, 1],
  3: [0, 1, 2],
  4: [0, 1, 2],
};
const HIDDEN_FACE_DOWN_SPELL_CARD: Card = {
  id: 'hidden_face_down_spell',
  type: 'trap',
  spellMode: 'face_down',
  name: 'Hidden Trap',
};

export interface OutgoingMessage {
  playerIndex: PlayerIndex | 'both';
  message: ServerMessage;
}

function emptyLane(): LaneState {
  return { monster: null, spell: null, faceDownSpell: null, tempAtkBoost: 0 };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function cloneLanes(state: GameState): [PlayerState['lanes'], PlayerState['lanes']] {
  return state.players.map(player =>
    player.lanes.map(lane => ({
      monster: lane.monster ? { ...lane.monster } : null,
      spell: lane.spell ? { card: { ...lane.spell.card }, remainingTurns: lane.spell.remainingTurns } : null,
      faceDownSpell: lane.faceDownSpell ? { ...lane.faceDownSpell } : null,
      tempAtkBoost: lane.tempAtkBoost,
    })) as PlayerState['lanes']
  ) as [PlayerState['lanes'], PlayerState['lanes']];
}

function isLaneUnlocked(turn: number, laneIndex: LaneIndex): boolean {
  return (UNLOCKED_LANES_BY_TURN[turn] ?? UNLOCKED_LANES_BY_TURN[4]).includes(laneIndex);
}

function maskActionForOpponent(action: TurnAction): TurnAction {
  return {
    summon: action.summon,
    summons: action.summons,
    spells: (action.spells ?? []).map(spell => ({
      ...spell,
      card: spell.card.spellMode === 'face_down' ? HIDDEN_FACE_DOWN_SPELL_CARD : spell.card,
    })),
  };
}

function normalizeSummons(action: TurnAction): SummonAction[] {
  if (action.summons?.length) return action.summons;
  return action.summon ? [action.summon] : [];
}

export class GameRoom {
  id: string;
  private state: GameState;
  private playerIds: [string | null, string | null] = [null, null];
  private extraSummonsThisTurn: [number, number] = [0, 0];

  constructor(id: string) {
    this.id = id;
    this.state = {
      turn: 1,
      phase: 'waiting',
      players: [
        { index: 0, lp: INITIAL_LP, hand: [], deck: [], lanes: LANE_INDICES.map(() => emptyLane()) },
        { index: 1, lp: INITIAL_LP, hand: [], deck: [], lanes: LANE_INDICES.map(() => emptyLane()) },
      ],
      submitted: [false, false],
      pendingActions: [null, null],
      winner: null,
    };
  }

  getState(): Readonly<GameState> { return this.state; }

  addPlayer(playerId: string, deck: Card[]): OutgoingMessage[] {
    if (deck.length !== 12) {
      const idx = this.playerIds[0] === null ? 0 : 1;
      return [{ playerIndex: idx as PlayerIndex, message: { type: 'error', message: 'Deck must contain exactly 12 cards.' } }];
    }
    const index = this.playerIds[0] === null ? 0 : 1;
    this.playerIds[index] = playerId;
    const shuffled = shuffle(deck);
    const hand = shuffled.splice(0, INITIAL_HAND_SIZE);
    this.state.players[index].deck = shuffled;
    this.state.players[index].hand = hand;

    if (this.playerIds[0] && this.playerIds[1]) {
      this.state.phase = 'action';
      return [
        { playerIndex: 0, message: { type: 'game_start', yourIndex: 0, yourHand: this.state.players[0].hand, opponentHandCount: INITIAL_HAND_SIZE, turn: 1 } },
        { playerIndex: 1, message: { type: 'game_start', yourIndex: 1, yourHand: this.state.players[1].hand, opponentHandCount: INITIAL_HAND_SIZE, turn: 1 } },
      ];
    }
    return [];
  }

  forfeit(playerIndex: PlayerIndex): OutgoingMessage[] {
    if (this.state.phase === 'game_over') return [];
    const winner = playerIndex === 0 ? 1 : 0;
    this.state.winner = winner;
    this.state.phase = 'game_over';
    const lps: [number, number] = [this.state.players[0].lp, this.state.players[1].lp];
    return [{ playerIndex: 'both', message: { type: 'game_over', winner, finalLPs: lps } }];
  }

  submitAction(playerIndex: PlayerIndex, action: TurnAction): OutgoingMessage[] {
    if (this.state.phase !== 'action') return [];
    this.state.pendingActions[playerIndex] = action;
    this.state.submitted[playerIndex] = true;

    if (!this.state.submitted[0] || !this.state.submitted[1]) return [];

    return this.resolveActions();
  }

  private resolveActions(): OutgoingMessage[] {
    const msgs: OutgoingMessage[] = [];
    const [a0, a1] = this.state.pendingActions as [TurnAction, TurnAction];

    msgs.push({ playerIndex: 0, message: { type: 'reveal', yourAction: a0, opponentAction: maskActionForOpponent(a1) } });
    msgs.push({ playerIndex: 1, message: { type: 'reveal', yourAction: a1, opponentAction: maskActionForOpponent(a0) } });

    const summonCounts: [number, number] = [
      this.applyAction(0, a0),
      this.applyAction(1, a1),
    ];
    this.resolveOverextendSpells(summonCounts);

    const { events, p0LpDelta, p1LpDelta } = this.state.turn === SETUP_TURN
      ? { events: [], p0LpDelta: 0, p1LpDelta: 0 }
      : resolveBattle(this.state.players[0], this.state.players[1]);

    this.markFinisherEvents(events);
    const preBattleLanes = cloneLanes(this.state);
    this.applyBattleResult(events);
    this.state.players[0].lp += p0LpDelta;
    this.state.players[1].lp += p1LpDelta;

    const lps: [number, number] = [this.state.players[0].lp, this.state.players[1].lp];
    const turnSummary = this.buildTurnSummary(this.state.turn, [a0, a1], summonCounts, [p0LpDelta, p1LpDelta], events.filter(event => event.type !== 'no_action').length, this.state.turn >= MAX_TURNS ? null : this.state.turn + 1);
    msgs.push({ playerIndex: 'both', message: { type: 'battle_result', events, lps, preBattleLanes, lanes: cloneLanes(this.state), turnSummary } });

    const p0Dead = this.state.players[0].lp <= 0;
    const p1Dead = this.state.players[1].lp <= 0;
    if (p0Dead || p1Dead) {
      const winner = p0Dead && p1Dead ? 'draw' : p0Dead ? 1 : 0;
      this.state.winner = winner;
      this.state.phase = 'game_over';
      msgs.push({ playerIndex: 'both', message: { type: 'game_over', winner, finalLPs: lps } });
      return msgs;
    }

    this.state.submitted = [false, false];
    this.state.pendingActions = [null, null];

    if (this.state.turn >= MAX_TURNS) {
      this.state.phase = 'final_battle';
      return msgs.concat(this.resolveFinalBattle());
    }

    this.state.turn += 1;
    this.state.phase = 'action';
    this.extraSummonsThisTurn = [0, 0];
    this.resolveDelayedSpells();
    const lanes = cloneLanes(this.state);

    for (const pi of [0, 1] as PlayerIndex[]) {
      const drawn = this.state.players[pi].deck.shift();
      if (drawn) {
        this.state.players[pi].hand.push(drawn);
        msgs.push({
          playerIndex: pi,
          message: {
            type: 'turn_start',
            drawnCard: drawn,
            turn: this.state.turn,
            lanes,
            summonLimit: 1 + this.extraSummonsThisTurn[pi],
          },
        });
      }
    }

    return msgs;
  }


  private buildTurnSummary(
    turn: number,
    actions: [TurnAction, TurnAction],
    summonCounts: [number, number],
    lpDelta: [number, number],
    battleEventCount: number,
    nextTurn: number | null,
  ): TurnSummary {
    const playerActions: [number, number] = [this.countActionSteps(actions[0]), this.countActionSteps(actions[1])];
    const summaryBase = {
      turn,
      isSetupTurn: turn === SETUP_TURN,
      playerSummons: summonCounts,
      playerActions,
      lpDelta,
      battleEventCount,
      nextTurn,
    };
    return {
      ...summaryBase,
      headline: this.buildTurnSummaryHeadline(turn, summaryBase),
      steps: this.buildTurnSummarySteps(summaryBase),
    };
  }

  private buildTurnSummaryHeadline(
    turn: number,
    summary: Omit<TurnSummary, 'headline' | 'steps'>,
  ): string {
    const defeated = this.getDefeatedPlayerLabel();
    if (defeated) return `T${turn} finish: ${defeated} LP reached 0. Duel ends now.`;

    if (summary.isSetupTurn) {
      return `T${turn} setup: P1 played ${summary.playerActions[0]} ${this.cardWord(summary.playerActions[0])}, P2 played ${summary.playerActions[1]} ${this.cardWord(summary.playerActions[1])}. ${this.nextTurnSentence(summary.nextTurn)}`;
    }

    return `T${turn} battle: ${this.formatLpDeltaHeadline(summary.lpDelta)} across ${summary.battleEventCount} ${summary.battleEventCount === 1 ? 'clash' : 'clashes'}. ${this.nextTurnSentence(summary.nextTurn)}`;
  }

  private buildTurnSummarySteps(summary: Omit<TurnSummary, 'headline' | 'steps'>): string[] {
    const defeated = this.getDefeatedPlayerLabel();
    return [
      summary.nextTurn === null ? 'Draw: no next draw after this result.' : 'Draw: next turn both duelists draw 1 card.',
      `Action: ${this.formatActionStep('P1', summary.playerSummons[0], summary.playerActions[0])}; ${this.formatActionStep('P2', summary.playerSummons[1], summary.playerActions[1])}.`,
      this.formatLpStep(summary.lpDelta),
      defeated ? `End: ${defeated} LP 0, game over before the next draw.` : summary.nextTurn === null ? 'End: final battle resolved.' : `End: proceed to T${summary.nextTurn} draw.`,
    ];
  }

  private countActionSteps(action: TurnAction): number {
    return normalizeSummons(action).length + (action.spells?.length ?? 0);
  }

  private getDefeatedPlayerLabel(): string | null {
    if (this.state.players[0].lp <= 0 && this.state.players[1].lp <= 0) return 'Both players';
    if (this.state.players[0].lp <= 0) return 'P1';
    if (this.state.players[1].lp <= 0) return 'P2';
    return null;
  }

  private nextTurnSentence(nextTurn: number | null): string {
    return nextTurn === null ? 'No next draw.' : `Next: draw for T${nextTurn}.`;
  }

  private formatLpDeltaHeadline(lpDelta: [number, number]): string {
    const parts = lpDelta
      .map((delta, index) => ({ delta, label: index === 0 ? 'P1' : 'P2' }))
      .filter(item => item.delta !== 0)
      .map(item => `${item.label} LP ${item.delta}`);
    return parts.length > 0 ? parts.join(', ') : 'no LP change';
  }

  private formatLpStep(lpDelta: [number, number]): string {
    if (lpDelta[0] === 0 && lpDelta[1] === 0) return 'LP: no LP change this turn.';
    return `LP: P1 ${lpDelta[0]}, P2 ${lpDelta[1]}.`;
  }

  private formatActionStep(label: string, summonCount: number, actionCount: number): string {
    if (summonCount > 0) {
      const monsterWord = summonCount === 1 ? 'monster' : 'monsters';
      return `${label} summoned ${summonCount} ${monsterWord} and played ${actionCount} total ${this.cardWord(actionCount)}`;
    }

    return `${label} played ${actionCount} ${this.cardWord(actionCount)}`;
  }

  private cardWord(count: number): string {
    return count === 1 ? 'card' : 'cards';
  }
  private markFinisherEvents(events: ReturnType<typeof resolveBattle>['events']): void {
    const runningLPs: [number, number] = [this.state.players[0].lp, this.state.players[1].lp];
    let finisherMarked = false;

    for (const ev of events) {
      const lpDamageByPlayer = this.getLpDamageByPlayer(ev);
      for (const playerIndex of [0, 1] as PlayerIndex[]) {
        const damage = lpDamageByPlayer[playerIndex];
        if (damage <= 0) continue;

        const lpBefore = runningLPs[playerIndex];
        runningLPs[playerIndex] -= damage;
        if (!finisherMarked && lpBefore > 0 && runningLPs[playerIndex] <= 0) {
          ev.finisher = true;
          finisherMarked = true;
        }
      }
    }
  }

  private getLpDamageByPlayer(ev: ReturnType<typeof resolveBattle>['events'][number]): [number, number] {
    const damageByPlayer: [number, number] = [0, 0];

    if (ev.type === 'direct_attack') {
      const defenderIndex: PlayerIndex = ev.attackerIndex === 0 ? 1 : 0;
      damageByPlayer[defenderIndex] += ev.damage;
      return damageByPlayer;
    }

    for (const hpChange of ev.hpChanges ?? []) {
      damageByPlayer[hpChange.playerIndex] += Math.max(0, -hpChange.hpAfter);
    }
    return damageByPlayer;
  }
  private applyBattleResult(events: ReturnType<typeof resolveBattle>['events']): void {
    for (const ev of events) {
      for (const hpChange of ev.hpChanges ?? []) {
        const lane = this.state.players[hpChange.playerIndex].lanes[ev.laneIndex];
        if (lane.monster?.id === hpChange.card.id) {
          lane.monster = { ...lane.monster, hp: Math.max(0, hpChange.hpAfter) };
        }
      }
      for (const { playerIndex, card } of ev.destroyedCards) {
        const lane = this.state.players[playerIndex].lanes[ev.laneIndex];
        if (lane.monster?.id === card.id) lane.monster = null;
        if (lane.spell?.card.id === card.id) lane.spell = null;
      }
      if (ev.type === 'direct_attack') {
        const defenderIndex = ev.attackerIndex === 0 ? 1 : 0;
        this.state.players[defenderIndex].lanes[ev.laneIndex].spell = null;
      }
      if (ev.triggeredSpell) {
        const { playerIndex } = ev.triggeredSpell;
        this.state.players[playerIndex].lanes[ev.laneIndex].faceDownSpell = null;
      }
    }

    for (const p of this.state.players) {
      for (const l of p.lanes) l.tempAtkBoost = 0;
    }
  }

  private resolveFinalBattle(): OutgoingMessage[] {
    const msgs: OutgoingMessage[] = [];
    const { events, p0LpDelta, p1LpDelta } = resolveBattle(this.state.players[0], this.state.players[1]);
    this.markFinisherEvents(events);
    const preBattleLanes = cloneLanes(this.state);
    this.applyBattleResult(events);

    this.state.players[0].lp += p0LpDelta;
    this.state.players[1].lp += p1LpDelta;

    const lps: [number, number] = [this.state.players[0].lp, this.state.players[1].lp];
    const turnSummary = this.buildTurnSummary(this.state.turn, [{ spells: [] }, { spells: [] }], [0, 0], [p0LpDelta, p1LpDelta], events.filter(event => event.type !== 'no_action').length, null);
    msgs.push({ playerIndex: 'both', message: { type: 'battle_result', events, lps, preBattleLanes, lanes: cloneLanes(this.state), turnSummary } });

    const p0Lp = this.state.players[0].lp;
    const p1Lp = this.state.players[1].lp;
    const winner: PlayerIndex | 'draw' = p0Lp > p1Lp ? 0 : p1Lp > p0Lp ? 1 : 'draw';

    this.state.winner = winner;
    this.state.phase = 'game_over';
    msgs.push({ playerIndex: 'both', message: { type: 'game_over', winner, finalLPs: lps } });
    return msgs;
  }

  private applyAction(playerIndex: PlayerIndex, action: TurnAction): number {
    const player = this.state.players[playerIndex];
    let successfulSummons = 0;
    const summonLimit = 1 + this.extraSummonsThisTurn[playerIndex];

    for (const summon of normalizeSummons(action).slice(0, summonLimit)) {
      const { card, laneIndex, tributeLaneIndices = [] } = summon;
      const tributeCost = card.tributeCost ?? 0;
      const uniqueTributes = [...new Set(tributeLaneIndices)];
      const requestedTributes = uniqueTributes.filter(tributeLane =>
        player.lanes[tributeLane]?.monster
      );
      const autoTributes = LANE_INDICES
        .filter(tributeLane =>
          tributeLane !== laneIndex
          && player.lanes[tributeLane]?.monster
          && !requestedTributes.includes(tributeLane)
        )
        .sort((a, b) => (player.lanes[a].monster?.atk ?? 0) - (player.lanes[b].monster?.atk ?? 0));
      const validTributes = [...requestedTributes, ...autoTributes].slice(0, tributeCost);
      const canPayTribute = tributeCost === 0 || validTributes.length >= tributeCost;
      const targetLaneIsOpen = !player.lanes[laneIndex].monster || validTributes.includes(laneIndex);

      if (isLaneUnlocked(this.state.turn, laneIndex) && targetLaneIsOpen && canPayTribute) {
        for (const tributeLane of validTributes.slice(0, tributeCost)) {
          player.lanes[tributeLane].monster = null;
        }
        player.lanes[laneIndex].monster = { ...card };
        player.hand = player.hand.filter(c => c.id !== card.id);
        successfulSummons += 1;
      }
    }

    for (const { card, laneIndex } of action.spells ?? []) {
      if (!isLaneUnlocked(this.state.turn, laneIndex)) continue;

      if (card.spellMode === 'face_down') {
        if (player.lanes[laneIndex].faceDownSpell) continue;
        player.lanes[laneIndex].faceDownSpell = card;
        player.hand = player.hand.filter(c => c.id !== card.id);
        continue;
      }

      if (!player.lanes[laneIndex].spell) {
        player.lanes[laneIndex].spell = {
          card,
          remainingTurns: card.spellDelayTurns ?? 1,
        };
        player.hand = player.hand.filter(c => c.id !== card.id);
      }
    }

    return successfulSummons;
  }

  private applySpell(playerIndex: PlayerIndex, spell: Card, laneIndex: LaneIndex): void {
    const player = this.state.players[playerIndex];
    const opponent = this.state.players[playerIndex === 0 ? 1 : 0];

    switch (spell.effect) {
      case 'power_boost':
        for (const l of player.lanes) {
          if (l.monster) l.tempAtkBoost += 500;
        }
        break;
      case 'monster_smash': {
        let maxAtk = -1;
        let maxLaneIdx = -1;
        for (let i = 0; i < opponent.lanes.length; i++) {
          const m = opponent.lanes[i].monster;
          if (m && (m.atk ?? 0) > maxAtk) {
            maxAtk = m.atk ?? 0;
            maxLaneIdx = i;
          }
        }
        if (maxLaneIdx >= 0) opponent.lanes[maxLaneIdx].monster = null;
        break;
      }
      case 'backrow_break': {
        const oppositeLane = opponent.lanes[laneIndex];
        if (oppositeLane.spell) {
          oppositeLane.spell = null;
          break;
        }
        if (oppositeLane.faceDownSpell) {
          oppositeLane.faceDownSpell = null;
          break;
        }

        const spellLane = opponent.lanes.find(l => l.spell);
        if (spellLane?.spell) {
          spellLane.spell = null;
          break;
        }

        const faceDownLane = opponent.lanes.find(l => l.faceDownSpell);
        if (faceDownLane?.faceDownSpell) faceDownLane.faceDownSpell = null;
        break;
      }
      case 'extra_summon_next_turn':
        this.extraSummonsThisTurn[playerIndex] += 1;
        break;
    }
  }

  private resolveOverextendSpells(summonCounts: [number, number]): void {
    let shouldDestroyAllMonsters = false;

    for (const playerIndex of [0, 1] as PlayerIndex[]) {
      const opponentIndex: PlayerIndex = playerIndex === 0 ? 1 : 0;
      if (summonCounts[opponentIndex] < 2) continue;

      for (const lane of this.state.players[playerIndex].lanes) {
        const spell = lane.faceDownSpell;
        if (spell?.triggerCondition === 'on_opponent_summon_two_plus' && spell.effect === 'destroy_all_monsters') {
          lane.faceDownSpell = null;
          shouldDestroyAllMonsters = true;
        }
      }
    }

    if (!shouldDestroyAllMonsters) return;
    for (const player of this.state.players) {
      for (const lane of player.lanes) lane.monster = null;
    }
  }

  private resolveDelayedSpells(): void {
    for (const player of this.state.players) {
      for (let i = 0; i < player.lanes.length; i++) {
        const lane = player.lanes[i];
        if (!lane.spell) continue;
        lane.spell.remainingTurns -= 1;
        if (lane.spell.remainingTurns <= 0) {
          const spell = lane.spell.card;
          lane.spell = null;
          this.applySpell(player.index, spell, i as LaneIndex);
        }
      }
    }
  }
}
