import type { BattleEvent, LaneState, PlayerState, PlayerIndex, LaneIndex } from '../../shared/types';

export interface BattleResult {
  events: BattleEvent[];
  p0LpDelta: number;
  p1LpDelta: number;
}

export function resolveBattle(p0: PlayerState, p1: PlayerState): BattleResult {
  const events: BattleEvent[] = [];
  let p0LpDelta = 0;
  let p1LpDelta = 0;

  for (let i = 0; i < 3; i++) {
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
    // p0 attacks p1Lane → check p1Lane trap (on_attacked)
    // p1 attacks p0Lane → check p0Lane trap (on_attacked)
    const p0AttackNegated =
      p1Lane.trap?.trapCondition === 'on_attacked' && p1Lane.trap.trapEffect === 'negate_attack';
    const p1AttackNegated =
      p0Lane.trap?.trapCondition === 'on_attacked' && p0Lane.trap.trapEffect === 'negate_attack';

    const destroyedCards: BattleEvent['destroyedCards'] = [];
    let damage = 0;

    if (!p0AttackNegated && !p1AttackNegated) {
      if (p0Atk > p1Atk) {
        destroyedCards.push({ playerIndex: 1 as PlayerIndex, card: p1Mon });
        damage = p0Atk - p1Atk;
        p1LpDelta -= damage;
      } else if (p1Atk > p0Atk) {
        destroyedCards.push({ playerIndex: 0 as PlayerIndex, card: p0Mon });
        damage = p1Atk - p0Atk;
        p0LpDelta -= damage;
      } else {
        destroyedCards.push({ playerIndex: 0 as PlayerIndex, card: p0Mon });
        destroyedCards.push({ playerIndex: 1 as PlayerIndex, card: p1Mon });
      }
      events.push({ laneIndex, type: 'monster_vs_monster', attackerIndex: 0, damage, destroyedCards, negated: false });
    } else {
      // At least one attack is negated — only process the non-negated side's attack
      const trapOwner: PlayerIndex = p0AttackNegated ? 1 : 0;
      const trapCard = p0AttackNegated ? p1Lane.trap! : p0Lane.trap!;

      if (p0AttackNegated && !p1AttackNegated) {
        // p0 attack negated; only p1's counter-attack on p0 resolves
        // p1 attacks p0: if p1Atk > p0Atk → p0 destroyed + LP damage
        //                if p1Atk <= p0Atk → p1 destroyed (blocked), no LP damage
        if (p1Atk > p0Atk) {
          destroyedCards.push({ playerIndex: 0 as PlayerIndex, card: p0Mon });
          damage = p1Atk - p0Atk;
          p0LpDelta -= damage;
        } else if (p1Atk < p0Atk) {
          destroyedCards.push({ playerIndex: 1 as PlayerIndex, card: p1Mon });
          // no LP damage — p0's attack was negated, p1 just loses its monster
        } else {
          // equal ATK: both destroyed, no LP damage
          destroyedCards.push({ playerIndex: 0 as PlayerIndex, card: p0Mon });
          destroyedCards.push({ playerIndex: 1 as PlayerIndex, card: p1Mon });
        }
      } else if (!p0AttackNegated && p1AttackNegated) {
        // p1 attack negated; only p0's attack on p1 resolves
        // p0 attacks p1: if p0Atk > p1Atk → p1 destroyed + LP damage
        //                if p0Atk <= p1Atk → p0 destroyed (blocked), no LP damage
        if (p0Atk > p1Atk) {
          destroyedCards.push({ playerIndex: 1 as PlayerIndex, card: p1Mon });
          damage = p0Atk - p1Atk;
          p1LpDelta -= damage;
        } else if (p0Atk < p1Atk) {
          destroyedCards.push({ playerIndex: 0 as PlayerIndex, card: p0Mon });
          // no LP damage — p1's attack was negated, p0 just loses its monster
        } else {
          // equal ATK: both destroyed, no LP damage
          destroyedCards.push({ playerIndex: 0 as PlayerIndex, card: p0Mon });
          destroyedCards.push({ playerIndex: 1 as PlayerIndex, card: p1Mon });
        }
      }
      // Both negated: no damage, no destruction

      events.push({
        laneIndex,
        type: 'monster_vs_monster',
        attackerIndex: 0,
        damage,
        destroyedCards,
        trapTriggered: { playerIndex: trapOwner, card: trapCard },
        negated: true,
      });
    }
    return { events, p0LpDelta, p1LpDelta };
  }

  // One side only → direct attack
  if (p0Mon && !p1Mon) {
    let damage = p0Atk;
    let trapTriggered: BattleEvent['trapTriggered'];
    if (p1Lane.trap?.trapCondition === 'on_direct_attack' && p1Lane.trap.trapEffect === 'reduce_damage_500') {
      damage = Math.max(0, damage - 500);
      trapTriggered = { playerIndex: 1 as PlayerIndex, card: p1Lane.trap };
    }
    p1LpDelta -= damage;
    events.push({ laneIndex, type: 'direct_attack', attackerIndex: 0, damage, destroyedCards: [], trapTriggered, negated: false });
  } else if (!p0Mon && p1Mon) {
    let damage = p1Atk;
    let trapTriggered: BattleEvent['trapTriggered'];
    if (p0Lane.trap?.trapCondition === 'on_direct_attack' && p0Lane.trap.trapEffect === 'reduce_damage_500') {
      damage = Math.max(0, damage - 500);
      trapTriggered = { playerIndex: 0 as PlayerIndex, card: p0Lane.trap };
    }
    p0LpDelta -= damage;
    events.push({ laneIndex, type: 'direct_attack', attackerIndex: 1, damage, destroyedCards: [], trapTriggered, negated: false });
  }

  return { events, p0LpDelta, p1LpDelta };
}
