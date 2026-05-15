import type { Card, PlayerState, TurnAction, LaneIndex } from '../../shared/types';

function getEmptyLaneIndices(player: PlayerState): LaneIndex[] {
  return ([0, 1, 2] as LaneIndex[]).filter(i => !player.lanes[i].monster);
}

function getEmptySpellLaneIndices(player: PlayerState): LaneIndex[] {
  return ([0, 1, 2] as LaneIndex[]).filter(i => !player.lanes[i].spell);
}

function getUnlockedLaneIndices(turn: number): LaneIndex[] {
  if (turn <= 1) return [1];
  if (turn === 2) return [0, 1];
  return [0, 1, 2];
}

function filterUnlocked(lanes: LaneIndex[], turn: number): LaneIndex[] {
  const unlocked = getUnlockedLaneIndices(turn);
  return lanes.filter(lane => unlocked.includes(lane));
}

export function randomAction(player: PlayerState, turn = 3): TurnAction {
  const hand = [...player.hand];
  const spells: TurnAction['spells'] = [];
  const traps: TurnAction['traps'] = [];
  let summon: TurnAction['summon'];

  const emptyLanes = filterUnlocked(getEmptyLaneIndices(player), turn);
  const monsters = hand.filter(c => c.type === 'monster');
  const spellCards = hand.filter(c => c.type === 'spell');
  const trapCards = hand.filter(c => c.type === 'trap');

  // 소환 (랜덤 몬스터, 랜덤 빈 레인)
  let summonedLane: LaneIndex | null = null;
  if (monsters.length > 0 && emptyLanes.length > 0) {
    const card = monsters[Math.floor(Math.random() * monsters.length)];
    const laneIndex = emptyLanes[Math.floor(Math.random() * emptyLanes.length)];
    summon = { card, laneIndex };
    summonedLane = laneIndex;
  }

  // 마법 (50% 확률로 사용)
  const spellLanes = filterUnlocked(getEmptySpellLaneIndices(player), turn);
  for (const spell of spellCards) {
    if (spellLanes.length === 0) break;
    if (Math.random() < 0.5) {
      const idx = Math.floor(Math.random() * spellLanes.length);
      spells.push({ card: spell, laneIndex: spellLanes.splice(idx, 1)[0] });
    }
  }

  // 함정 (소환 레인 제외한 빈 레인에 랜덤 세트)
  const availableLanes = emptyLanes.filter(l => l !== summonedLane);
  for (const trap of trapCards) {
    if (availableLanes.length === 0) break;
    const idx = Math.floor(Math.random() * availableLanes.length);
    traps.push({ card: trap, laneIndex: availableLanes.splice(idx, 1)[0] });
  }

  return { summon, spells, traps };
}

export function greedyAction(player: PlayerState, turn = 3): TurnAction {
  const hand = [...player.hand];
  const spells: TurnAction['spells'] = [];
  const traps: TurnAction['traps'] = [];
  let summon: TurnAction['summon'];

  const emptyLanes = filterUnlocked(getEmptyLaneIndices(player), turn);
  const monsters = hand.filter(c => c.type === 'monster').sort((a, b) => (b.atk ?? 0) - (a.atk ?? 0));
  const spellCards = hand.filter(c => c.type === 'spell');
  const trapCards = hand.filter(c => c.type === 'trap');

  // ATK 가장 높은 몬스터를 첫 번째 빈 레인에 소환
  let summonedLane: LaneIndex | null = null;
  if (monsters.length > 0 && emptyLanes.length > 0) {
    summon = { card: monsters[0], laneIndex: emptyLanes[0] };
    summonedLane = emptyLanes[0];
  }

  // 마법 전부 사용
  const spellLanes = filterUnlocked(getEmptySpellLaneIndices(player), turn);
  let spellLanePtr = 0;
  for (const spell of spellCards) {
    if (spellLanePtr >= spellLanes.length) break;
    spells.push({ card: spell, laneIndex: spellLanes[spellLanePtr++] });
  }

  // 함정 세트 (소환 레인 제외한 빈 레인에 순서대로)
  const lanesForTraps = emptyLanes.filter(l => l !== summonedLane);
  let lanePtr = 0;
  for (const trap of trapCards) {
    if (lanePtr >= lanesForTraps.length) break;
    traps.push({ card: trap, laneIndex: lanesForTraps[lanePtr++] });
  }

  return { summon, spells, traps };
}
