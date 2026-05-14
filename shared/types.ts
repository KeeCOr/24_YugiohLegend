export type CardType = 'monster' | 'spell' | 'trap';
export type EffectId = 'heal_1000' | 'power_boost' | 'monster_smash';
export type TrapConditionId = 'on_attacked' | 'on_direct_attack';
export type TrapEffectId = 'negate_attack' | 'reduce_damage_500';
export type PlayerIndex = 0 | 1;
export type LaneIndex = 0 | 1 | 2;

export interface Card {
  id: string;
  type: CardType;
  name: string;
  atk?: number;
  effect?: EffectId;
  trapCondition?: TrapConditionId;
  trapEffect?: TrapEffectId;
}

export interface LaneState {
  monster: Card | null;
  trap: Card | null;
  tempAtkBoost: number; // power_boost 적용 시 이번 전투에서만 유효
}

export interface PlayerState {
  index: PlayerIndex;
  lp: number;
  hand: Card[];
  deck: Card[];
  lanes: [LaneState, LaneState, LaneState];
}

export interface TurnAction {
  summon?: { card: Card; laneIndex: LaneIndex };
  spells: Card[];
  traps: { card: Card; laneIndex: LaneIndex }[];
}

export interface BattleEvent {
  laneIndex: LaneIndex;
  type: 'monster_vs_monster' | 'direct_attack' | 'no_action';
  attackerIndex: PlayerIndex;
  damage: number;
  destroyedCards: { playerIndex: PlayerIndex; card: Card }[];
  trapTriggered?: { playerIndex: PlayerIndex; card: Card };
  negated: boolean;
}

export interface GameState {
  turn: number; // 1~3
  phase: 'waiting' | 'action' | 'reveal' | 'battle' | 'final_battle' | 'game_over';
  players: [PlayerState, PlayerState];
  submitted: [boolean, boolean];
  pendingActions: [TurnAction | null, TurnAction | null];
  winner: PlayerIndex | 'draw' | null;
}

// ── WebSocket 메시지 ──────────────────────────────────────────
export type ClientMessage =
  | { type: 'join_room'; mode: 'single' | 'multi'; deck: Card[] }
  | { type: 'submit_action'; action: TurnAction };

export type ServerMessage =
  | { type: 'game_start'; yourIndex: PlayerIndex; yourHand: Card[]; opponentHandCount: number; turn: number }
  | { type: 'turn_start'; drawnCard: Card; turn: number }
  | { type: 'reveal'; yourAction: TurnAction; opponentAction: TurnAction }
  | { type: 'battle_result'; events: BattleEvent[]; lps: [number, number] }
  | { type: 'game_over'; winner: PlayerIndex | 'draw'; finalLPs: [number, number] }
  | { type: 'error'; message: string }
  | { type: 'waiting'; message: string };
