export type CardType = 'monster' | 'spell';
export type SpellMode = 'face_up' | 'face_down';
export type EffectId = 'power_boost' | 'monster_smash' | 'backrow_break' | 'negate_attack' | 'reduce_damage_500';
export type TriggerConditionId = 'on_attacked' | 'on_direct_attack';
export type MonsterRole = 'striker' | 'guardian' | 'utility';
export type TributeRole = 'bruiser' | 'ally_booster' | 'field_booster' | 'mobile' | 'tribute_scaler';
export type MonsterAbilityId =
  | 'zone_shift'
  | 'draw_on_summon'
  | 'guard_adjacent'
  | 'last_stand'
  | 'ally_warcry'
  | 'field_aura'
  | 'tribute_stride'
  | 'tribute_growth';
export type PlayerIndex = 0 | 1;
export type LaneIndex = 0 | 1 | 2;
export const LANE_COUNT = 3;
export const LANE_INDICES: LaneIndex[] = [0, 1, 2];

export interface Card {
  id: string;
  type: CardType;
  name: string;
  atk?: number;
  hp?: number;
  tributeCost?: number;
  monsterRole?: MonsterRole;
  tributeRole?: TributeRole;
  monsterAbility?: MonsterAbilityId;
  abilityText?: string;
  spellMode?: SpellMode;
  effect?: EffectId;
  triggerCondition?: TriggerConditionId;
  spellDelayTurns?: number;
}

export interface SpellSlot {
  card: Card;
  remainingTurns: number;
}

export interface LaneState {
  monster: Card | null;
  spell: SpellSlot | null;
  faceDownSpell: Card | null;
  tempAtkBoost: number;
}

export interface PlayerState {
  index: PlayerIndex;
  lp: number;
  hand: Card[];
  deck: Card[];
  lanes: LaneState[];
}

export interface TurnAction {
  summon?: { card: Card; laneIndex: LaneIndex; tributeLaneIndices?: LaneIndex[] };
  spells: { card: Card; laneIndex: LaneIndex }[];
}

export interface BattleEvent {
  laneIndex: LaneIndex;
  type: 'monster_vs_monster' | 'direct_attack' | 'no_action';
  attackerIndex: PlayerIndex;
  damage: number;
  destroyedCards: { playerIndex: PlayerIndex; card: Card }[];
  triggeredSpell?: { playerIndex: PlayerIndex; card: Card };
  negated: boolean;
}

export interface GameState {
  turn: number;
  phase: 'waiting' | 'action' | 'reveal' | 'battle' | 'final_battle' | 'game_over';
  players: [PlayerState, PlayerState];
  submitted: [boolean, boolean];
  pendingActions: [TurnAction | null, TurnAction | null];
  winner: PlayerIndex | 'draw' | null;
}

export type ClientMessage =
  | { type: 'join_room'; mode: 'single' | 'multi'; deck: Card[] }
  | { type: 'submit_action'; action: TurnAction };

export type ServerMessage =
  | { type: 'game_start'; yourIndex: PlayerIndex; yourHand: Card[]; opponentHandCount: number; turn: number }
  | { type: 'turn_start'; drawnCard: Card; turn: number }
  | { type: 'reveal'; yourAction: TurnAction; opponentAction: TurnAction }
  | { type: 'battle_result'; events: BattleEvent[]; lps: [number, number]; lanes: [PlayerState['lanes'], PlayerState['lanes']] }
  | { type: 'game_over'; winner: PlayerIndex | 'draw'; finalLPs: [number, number] }
  | { type: 'error'; message: string }
  | { type: 'waiting'; message: string };
