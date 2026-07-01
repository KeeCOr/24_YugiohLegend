import type { LaneState } from './types';

export type PreviewSide = 'player' | 'opponent';
export type BattlePreviewTone = 'advantage' | 'danger' | 'neutral';

export type LaneBattlePreview =
  | {
      kind: 'empty';
      label: string;
      tone: BattlePreviewTone;
    }
  | {
      kind: 'direct';
      attacker: PreviewSide;
      damage: number;
      label: string;
      tone: BattlePreviewTone;
    }
  | {
      kind: 'clash';
      attacker: PreviewSide;
      damage: number;
      target: PreviewSide;
      hpAfter: number;
      lpDamage: number;
      survives: boolean;
      label: string;
      tone: BattlePreviewTone;
    };

function effectiveAtk(lane: LaneState): number {
  return (lane.monster?.atk ?? 0) + lane.tempAtkBoost;
}

function monsterHp(lane: LaneState): number {
  return lane.monster?.hp ?? 1;
}

export function getLaneBattlePreview(playerLane: LaneState, opponentLane: LaneState): LaneBattlePreview {
  const playerMonster = playerLane.monster;
  const opponentMonster = opponentLane.monster;

  if (!playerMonster && !opponentMonster) {
    return { kind: 'empty', label: 'NO BATTLE', tone: 'neutral' };
  }

  if (playerMonster && !opponentMonster) {
    const damage = effectiveAtk(playerLane);
    return { kind: 'direct', attacker: 'player', damage, label: `LP -${damage}`, tone: 'advantage' };
  }

  if (!playerMonster && opponentMonster) {
    const damage = effectiveAtk(opponentLane);
    return { kind: 'direct', attacker: 'opponent', damage, label: `LP -${damage}`, tone: 'danger' };
  }

  const playerAtk = effectiveAtk(playerLane);
  const opponentAtk = effectiveAtk(opponentLane);
  if (playerAtk === opponentAtk) {
    return {
      kind: 'clash',
      attacker: 'player',
      damage: 0,
      target: 'opponent',
      hpAfter: monsterHp(opponentLane),
      lpDamage: 0,
      survives: true,
      label: 'EVEN',
      tone: 'neutral',
    };
  }

  const playerWins = playerAtk > opponentAtk;
  const damage = Math.abs(playerAtk - opponentAtk);
  const targetLane = playerWins ? opponentLane : playerLane;
  const hpAfter = monsterHp(targetLane) - damage;
  const lpDamage = Math.max(0, -hpAfter);
  const survives = hpAfter > 0;
  const tone: BattlePreviewTone = playerWins ? 'advantage' : 'danger';
  const label = survives ? `HP -${damage} | survives ${hpAfter}` : lpDamage > 0 ? `KO | LP -${lpDamage}` : 'KO';

  return {
    kind: 'clash',
    attacker: playerWins ? 'player' : 'opponent',
    damage,
    target: playerWins ? 'opponent' : 'player',
    hpAfter,
    lpDamage,
    survives,
    label,
    tone,
  };
}
