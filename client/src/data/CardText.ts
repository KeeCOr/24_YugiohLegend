import type { Card } from './CardTypes';

export function getEffectConditionSummary(card: Card): string {
  switch (card.triggerCondition) {
    case 'on_attacked':
      return 'WHEN ATTACKED';
    case 'on_direct_attack':
      return 'ON DIRECT HIT';
    case 'on_opponent_summon_two_plus':
      return 'IF RIVAL SUMMONS 2+';
  }
  if (card.type === 'spell') return `AFTER ${card.spellDelayTurns ?? 1} TURN`;
  if (card.type === 'trap') return 'WHEN TRIGGERED';
  return '';
}

export function getEffectOutcomeSummary(card: Card): string {
  switch (card.effect) {
    case 'power_boost':
      return 'ALL ALLIES +500 ATK';
    case 'monster_smash':
      return 'DESTROY HIGHEST ATK ENEMY';
    case 'backrow_break':
      return 'DESTROY ENEMY SPELL/TRAP';
    case 'extra_summon_next_turn':
      return 'NEXT TURN +1 SUMMON';
    case 'negate_attack':
      return 'NEGATE ATTACK';
    case 'reduce_damage_500':
      return 'DAMAGE -500';
    case 'destroy_all_monsters':
      return 'WIPE FIELD';
    default:
      return card.type === 'spell' || card.type === 'trap' ? 'SPECIAL CARD EFFECT' : '';
  }
}

export function getReadableEffectSummary(card: Card): string {
  const condition = getEffectConditionSummary(card);
  const outcome = getEffectOutcomeSummary(card);
  if (condition && outcome) return `${condition}: ${outcome}`;
  return outcome || condition;
}

export function getSpellEffectSummary(card: Card): string {
  return getReadableEffectSummary(card);
}

export function getSpellTimingSummary(card: Card): string {
  if (card.type === 'trap') return 'TRAP';
  if (card.type !== 'spell') return '';
  return `FACE-UP ${card.spellDelayTurns ?? 1}T`;
}
