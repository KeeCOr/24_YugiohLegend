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
export interface BoardBattlePressure {
  playerLpRisk: number;
  opponentLpRisk: number;
  playerWinningTrades: number;
  rivalWinningTrades: number;
  quietLanes: number;
  tone: BattlePreviewTone;
  headline: string;
  detail: string;
}

function applyPreviewPressure(preview: LaneBattlePreview, pressure: BoardBattlePressure): void {
  if (preview.kind === 'empty') {
    pressure.quietLanes += 1;
    return;
  }

  if (preview.kind === 'direct') {
    if (preview.attacker === 'player') pressure.opponentLpRisk += preview.damage;
    else pressure.playerLpRisk += preview.damage;
    return;
  }

  if (preview.target === 'opponent' && preview.damage > 0) pressure.playerWinningTrades += 1;
  if (preview.target === 'player' && preview.damage > 0) pressure.rivalWinningTrades += 1;
  if (preview.target === 'opponent') pressure.opponentLpRisk += preview.lpDamage;
  if (preview.target === 'player') pressure.playerLpRisk += preview.lpDamage;
}

function finalizePressure(pressure: BoardBattlePressure): BoardBattlePressure {
  const netPlayerPressure = pressure.opponentLpRisk - pressure.playerLpRisk;
  if (netPlayerPressure > 0) {
    pressure.tone = 'advantage';
    pressure.headline = `YOU PRESSURE +${netPlayerPressure}`;
    pressure.detail = `Rival LP risk ${pressure.opponentLpRisk} / your LP risk ${pressure.playerLpRisk}`;
    return pressure;
  }

  if (netPlayerPressure < 0) {
    pressure.tone = 'danger';
    pressure.headline = `RIVAL PRESSURE +${Math.abs(netPlayerPressure)}`;
    pressure.detail = `Your LP risk ${pressure.playerLpRisk} / rival LP risk ${pressure.opponentLpRisk}`;
    return pressure;
  }

  if (pressure.playerWinningTrades > pressure.rivalWinningTrades) {
    pressure.tone = 'advantage';
    pressure.headline = `YOU WIN ${pressure.playerWinningTrades} TRADE${pressure.playerWinningTrades > 1 ? 'S' : ''}`;
    pressure.detail = `Winning trades ${pressure.playerWinningTrades} / losing trades ${pressure.rivalWinningTrades}`;
    return pressure;
  }

  if (pressure.rivalWinningTrades > pressure.playerWinningTrades) {
    pressure.tone = 'danger';
    pressure.headline = `RIVAL WINS ${pressure.rivalWinningTrades} TRADE${pressure.rivalWinningTrades > 1 ? 'S' : ''}`;
    pressure.detail = `Losing trades ${pressure.rivalWinningTrades} / winning trades ${pressure.playerWinningTrades}`;
    return pressure;
  }

  pressure.tone = 'neutral';
  pressure.headline = pressure.quietLanes > 0 ? 'BOARD QUIET' : 'EVEN PRESSURE';
  pressure.detail = pressure.quietLanes > 0 ? 'No LP pressure yet' : 'LP pressure is even';
  return pressure;
}

export function getBoardBattlePressure(playerLanes: LaneState[], opponentLanes: LaneState[]): BoardBattlePressure {
  const laneCount = Math.max(playerLanes.length, opponentLanes.length);
  const pressure: BoardBattlePressure = {
    playerLpRisk: 0,
    opponentLpRisk: 0,
    playerWinningTrades: 0,
    rivalWinningTrades: 0,
    quietLanes: 0,
    tone: 'neutral',
    headline: 'BOARD QUIET',
    detail: 'No LP pressure yet',
  };

  for (let i = 0; i < laneCount; i++) {
    const playerLane = playerLanes[i] ?? { monster: null, spell: null, faceDownSpell: null, tempAtkBoost: 0 };
    const opponentLane = opponentLanes[i] ?? { monster: null, spell: null, faceDownSpell: null, tempAtkBoost: 0 };
    applyPreviewPressure(getLaneBattlePreview(playerLane, opponentLane), pressure);
  }

  return finalizePressure(pressure);
}
