import type { Card, PlayerState, TurnAction, LaneIndex } from '../../shared/types';

function getEmptyLaneIndices(player: PlayerState): LaneIndex[] {
  return ([0, 1, 2, 3] as LaneIndex[]).filter(i => !player.lanes[i].monster);
}

function canSetSpell(player: PlayerState, laneIndex: LaneIndex, card: Card): boolean {
  return card.spellMode === 'face_down'
    ? !player.lanes[laneIndex].faceDownSpell
    : !player.lanes[laneIndex].spell;
}

function getUnlockedLaneIndices(turn: number): LaneIndex[] {
  if (turn <= 1) return [0];
  if (turn === 2) return [0, 1];
  if (turn === 3) return [0, 1, 2];
  return [0, 1, 2, 3];
}

function filterUnlocked(lanes: LaneIndex[], turn: number): LaneIndex[] {
  const unlocked = getUnlockedLaneIndices(turn);
  return lanes.filter(lane => unlocked.includes(lane));
}

function getTributeLaneIndices(player: PlayerState, cost: number): LaneIndex[] {
  if (cost <= 0) return [];
  return ([0, 1, 2, 3] as LaneIndex[])
    .filter(i => player.lanes[i].monster)
    .sort((a, b) => (player.lanes[a].monster?.atk ?? 0) - (player.lanes[b].monster?.atk ?? 0))
    .slice(0, cost);
}

function buildSummon(card: Card, laneIndex: LaneIndex, player: PlayerState): TurnAction['summon'] | undefined {
  const tributeCost = card.tributeCost ?? 0;
  const tributeLaneIndices = getTributeLaneIndices(player, tributeCost);
  if (tributeLaneIndices.length < tributeCost) return undefined;
  return tributeCost > 0 ? { card, laneIndex, tributeLaneIndices } : { card, laneIndex };
}

function chooseSpellLanes(player: PlayerState, spellCards: Card[], turn: number): TurnAction['spells'] {
  const spells: TurnAction['spells'] = [];
  const unlocked = filterUnlocked([0, 1, 2, 3] as LaneIndex[], turn);
  for (const spell of spellCards) {
    const laneIndex = unlocked.find(lane => canSetSpell(player, lane, spell) && !spells.some(s => s.laneIndex === lane && s.card.spellMode === spell.spellMode));
    if (laneIndex === undefined) continue;
    spells.push({ card: spell, laneIndex });
  }
  return spells;
}

export function randomAction(player: PlayerState, turn = 3): TurnAction {
  const hand = [...player.hand];
  const emptyLanes = filterUnlocked(getEmptyLaneIndices(player), turn);
  const monsters = hand.filter(c => c.type === 'monster');
  const spellCards = hand.filter(c => c.type === 'spell');
  let summon: TurnAction['summon'];

  if (monsters.length > 0 && emptyLanes.length > 0) {
    const card = monsters[Math.floor(Math.random() * monsters.length)];
    const laneIndex = emptyLanes[Math.floor(Math.random() * emptyLanes.length)];
    summon = buildSummon(card, laneIndex, player);
  }

  const randomSpells = spellCards.filter(() => Math.random() < 0.5);
  return { summon, spells: chooseSpellLanes(player, randomSpells, turn) };
}

export function greedyAction(player: PlayerState, turn = 3): TurnAction {
  const hand = [...player.hand];
  const emptyLanes = filterUnlocked(getEmptyLaneIndices(player), turn);
  const monsters = hand.filter(c => c.type === 'monster').sort((a, b) => (b.atk ?? 0) - (a.atk ?? 0));
  const spellCards = hand.filter(c => c.type === 'spell');
  let summon: TurnAction['summon'];

  if (emptyLanes.length > 0) {
    for (const monster of monsters) {
      summon = buildSummon(monster, emptyLanes[0], player);
      if (summon) break;
    }
  }

  return { summon, spells: chooseSpellLanes(player, spellCards, turn) };
}
