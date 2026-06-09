import type { BattleEvent, Card, LaneState, PlayerState, PlayerIndex, LaneIndex } from '../../shared/types';

export interface BattleResult {
  events: BattleEvent[];
  p0LpDelta: number;
  p1LpDelta: number;
}

function triggeredSpell(lane: LaneState, condition: Card['triggerCondition']): Card | null {
  const spell = lane.faceDownSpell;
  return spell?.triggerCondition === condition ? spell : null;
}

function monsterHp(card: Card): number {
  return card.hp ?? 1;
}

function applyAtkDifferenceDamage(
  defenderIndex: PlayerIndex,
  defender: Card,
  damage: number,
  hpChanges: NonNullable<BattleEvent['hpChanges']>,
  destroyedCards: BattleEvent['destroyedCards']
): { overflowDamage: number; overflowPlayerIndex: PlayerIndex | null } {
  if (damage <= 0) return { overflowDamage: 0, overflowPlayerIndex: null };
  const hpBefore = monsterHp(defender);
  const hpAfter = hpBefore - damage;
  hpChanges.push({ playerIndex: defenderIndex, card: defender, hpBefore, hpAfter });
  if (hpAfter <= 0) destroyedCards.push({ playerIndex: defenderIndex, card: defender });
  return { overflowDamage: Math.max(0, -hpAfter), overflowPlayerIndex: hpAfter < 0 ? defenderIndex : null };
}

function resolveAtkDifferenceDamage(
  p0Mon: Card,
  p1Mon: Card,
  p0Atk: number,
  p1Atk: number,
  hpChanges: NonNullable<BattleEvent['hpChanges']>,
  destroyedCards: BattleEvent['destroyedCards']
): { damage: number; overflowDamage: number; overflowPlayerIndex: PlayerIndex | null } {
  if (p0Atk > p1Atk) {
    const damage = p0Atk - p1Atk;
    const overflow = applyAtkDifferenceDamage(1, p1Mon, damage, hpChanges, destroyedCards);
    return { damage, ...overflow };
  }

  if (p1Atk > p0Atk) {
    const damage = p1Atk - p0Atk;
    const overflow = applyAtkDifferenceDamage(0, p0Mon, damage, hpChanges, destroyedCards);
    return { damage, ...overflow };
  }

  return { damage: 0, overflowDamage: 0, overflowPlayerIndex: null };
}

export function resolveBattle(p0: PlayerState, p1: PlayerState): BattleResult {
  const events: BattleEvent[] = [];
  let p0LpDelta = 0;
  let p1LpDelta = 0;
  const laneCount = Math.max(p0.lanes.length, p1.lanes.length);

  for (let i = 0; i < laneCount; i++) {
    const laneIndex = i as LaneIndex;
    const result = resolveLane(laneIndex, p0.lanes[laneIndex], p1.lanes[laneIndex]);
    events.push(...result.events);
    p0LpDelta += result.p0LpDelta;
    p1LpDelta += result.p1LpDelta;
  }

  return { events, p0LpDelta, p1LpDelta };
}

function resolveLane(
  laneIndex: LaneIndex,
  p0Lane: LaneState,
  p1Lane: LaneState
): { events: BattleEvent[]; p0LpDelta: number; p1LpDelta: number } {
  const events: BattleEvent[] = [];
  let p0LpDelta = 0;
  let p1LpDelta = 0;

  const p0Mon = p0Lane.monster;
  const p1Mon = p1Lane.monster;
  const p0Atk = p0Mon ? (p0Mon.atk ?? 0) + p0Lane.tempAtkBoost : 0;
  const p1Atk = p1Mon ? (p1Mon.atk ?? 0) + p1Lane.tempAtkBoost : 0;

  if (!p0Mon && !p1Mon) {
    events.push({ laneIndex, type: 'no_action', attackerIndex: 0, damage: 0, destroyedCards: [], negated: false });
    return { events, p0LpDelta, p1LpDelta };
  }

  if (p0Mon && p1Mon) {
    const p0Counter = triggeredSpell(p1Lane, 'on_attacked');
    const p1Counter = triggeredSpell(p0Lane, 'on_attacked');
    const p0AttackNegated = p0Counter?.effect === 'negate_attack';
    const p1AttackNegated = p1Counter?.effect === 'negate_attack';
    const destroyedCards: BattleEvent['destroyedCards'] = [];
    const hpChanges: NonNullable<BattleEvent['hpChanges']> = [];
    let damage = 0;

    if (p0AttackNegated && p1AttackNegated) {
      events.push({
        laneIndex,
        type: 'monster_vs_monster',
        attackerIndex: 0,
        damage: 0,
        destroyedCards: [],
        triggeredSpell: { playerIndex: 1, card: p0Counter },
        negated: true,
      });
      return { events, p0LpDelta, p1LpDelta };
    }

    if (!p0AttackNegated && !p1AttackNegated) {
      const attackerIndex: PlayerIndex = p0Atk >= p1Atk ? 0 : 1;
      const atkResult = resolveAtkDifferenceDamage(p0Mon, p1Mon, p0Atk, p1Atk, hpChanges, destroyedCards);
      damage = atkResult.damage;
      if (atkResult.overflowPlayerIndex === 0) p0LpDelta -= atkResult.overflowDamage;
      if (atkResult.overflowPlayerIndex === 1) p1LpDelta -= atkResult.overflowDamage;
      events.push({ laneIndex, type: 'monster_vs_monster', attackerIndex, damage, hpChanges, destroyedCards, negated: false });
      return { events, p0LpDelta, p1LpDelta };
    }

    const spellOwner: PlayerIndex = p0AttackNegated ? 1 : 0;
    const spellCard = p0AttackNegated ? p0Counter! : p1Counter!;

    const atkResult = resolveAtkDifferenceDamage(p0Mon, p1Mon, p0Atk, p1Atk, hpChanges, destroyedCards);
    damage = atkResult.damage;
    if (atkResult.overflowPlayerIndex === 0) p0LpDelta -= atkResult.overflowDamage;
    if (atkResult.overflowPlayerIndex === 1) p1LpDelta -= atkResult.overflowDamage;
    events.push({
      laneIndex,
      type: 'monster_vs_monster',
      attackerIndex: p0AttackNegated ? 1 : 0,
      damage,
      hpChanges,
      destroyedCards,
      triggeredSpell: { playerIndex: spellOwner, card: spellCard },
      negated: true,
    });
    return { events, p0LpDelta, p1LpDelta };
  }

  if (p0Mon && !p1Mon) {
    let damage = p0Atk;
    let spell: Card | null = triggeredSpell(p1Lane, 'on_direct_attack');
    if (spell?.effect === 'reduce_damage_500') damage = Math.max(0, damage - 500);
    p1LpDelta -= damage;
    events.push({ laneIndex, type: 'direct_attack', attackerIndex: 0, damage, destroyedCards: [], triggeredSpell: spell ? { playerIndex: 1, card: spell } : undefined, negated: false });
  } else if (!p0Mon && p1Mon) {
    let damage = p1Atk;
    let spell: Card | null = triggeredSpell(p0Lane, 'on_direct_attack');
    if (spell?.effect === 'reduce_damage_500') damage = Math.max(0, damage - 500);
    p0LpDelta -= damage;
    events.push({ laneIndex, type: 'direct_attack', attackerIndex: 1, damage, destroyedCards: [], triggeredSpell: spell ? { playerIndex: 0, card: spell } : undefined, negated: false });
  }

  return { events, p0LpDelta, p1LpDelta };
}
