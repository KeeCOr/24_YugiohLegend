import type { Card } from './CardTypes';

export function getSpellEffectSummary(card: Card): string {
  switch (card.effect) {
    case 'power_boost':
      return 'ALL ALLIES +500 ATK';
    case 'monster_smash':
      return 'DESTROY HIGHEST ATK ENEMY';
    case 'backrow_break':
      return 'DESTROY ENEMY SPELL';
    case 'extra_summon_next_turn':
      return 'NEXT TURN +1 SUMMON';
    case 'negate_attack':
      return 'WHEN ATTACKED: NEGATE';
    case 'reduce_damage_500':
      return 'DIRECT HIT: -500 DAMAGE';
    case 'destroy_all_monsters':
      return 'IF RIVAL SUMMONS 2+: WIPE FIELD';
    default:
      return card.type === 'spell' ? 'SPECIAL SPELL EFFECT' : '';
  }
}

export function getSpellTimingSummary(card: Card): string {
  if (card.type !== 'spell') return '';
  if (card.spellMode === 'face_down') return 'SET TRIGGER';
  return `FACE-UP ${card.spellDelayTurns ?? 1}T`;
}
