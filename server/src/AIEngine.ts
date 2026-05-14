import type { Card, PlayerState, TurnAction, LaneIndex } from '../../shared/types';

function getEmptyLaneIndices(player: PlayerState): LaneIndex[] {
  return ([0, 1, 2] as LaneIndex[]).filter(i => !player.lanes[i].monster);
}

export function randomAction(player: PlayerState): TurnAction {
  const hand = [...player.hand];
  const spells: Card[] = [];
  const traps: TurnAction['traps'] = [];
  let summon: TurnAction['summon'];

  const emptyLanes = getEmptyLaneIndices(player);
  const monsters = hand.filter(c => c.type === 'monster');
  const spellCards = hand.filter(c => c.type === 'spell');
  const trapCards = hand.filter(c => c.type === 'trap');

  // 소환 (랜덤 몬스터, 랜덤 빈 레인)
  if (monsters.length > 0 && emptyLanes.length > 0) {
    const card = monsters[Math.floor(Math.random() * monsters.length)];
    const laneIndex = emptyLanes[Math.floor(Math.random() * emptyLanes.length)];
    summon = { card, laneIndex };
  }

  // 마법 (50% 확률로 사용)
  for (const spell of spellCards) {
    if (Math.random() < 0.5) spells.push(spell);
  }

  // 함정 (빈 레인에 랜덤 세트)
  const availableLanes = [...emptyLanes];
  for (const trap of trapCards) {
    if (availableLanes.length === 0) break;
    const idx = Math.floor(Math.random() * availableLanes.length);
    traps.push({ card: trap, laneIndex: availableLanes.splice(idx, 1)[0] });
  }

  return { summon, spells, traps };
}

export function greedyAction(player: PlayerState): TurnAction {
  const hand = [...player.hand];
  const spells: Card[] = [];
  const traps: TurnAction['traps'] = [];
  let summon: TurnAction['summon'];

  const emptyLanes = getEmptyLaneIndices(player);
  const monsters = hand.filter(c => c.type === 'monster').sort((a, b) => (b.atk ?? 0) - (a.atk ?? 0));
  const spellCards = hand.filter(c => c.type === 'spell');
  const trapCards = hand.filter(c => c.type === 'trap');

  // ATK 가장 높은 몬스터를 첫 번째 빈 레인에 소환
  if (monsters.length > 0 && emptyLanes.length > 0) {
    summon = { card: monsters[0], laneIndex: emptyLanes[0] };
  }

  // 마법 전부 사용
  spells.push(...spellCards);

  // 함정 세트 (빈 레인에 순서대로)
  let lanePtr = 0;
  for (const trap of trapCards) {
    if (lanePtr >= emptyLanes.length) break;
    traps.push({ card: trap, laneIndex: emptyLanes[lanePtr++] });
  }

  return { summon, spells, traps };
}
