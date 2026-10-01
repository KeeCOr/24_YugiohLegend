export const ORIGINAL_RULESET = {
  title: 'Arcane Relay',
  victory: '상대의 코어 2개를 먼저 붕괴시키면 승리',
  lanes: 2,
  resource: '에테르',
  unit: '사도',
  summon: '전송',
  reversal: '코어 리버스',
} as const;

export function canClaimVictory(destroyedEnemyCores: number) { return destroyedEnemyCores >= 2; }

export function previewCardPlay({ etherCost, availableEther, comboPower, responseWindows }: { etherCost: number; availableEther: number; comboPower: number; responseWindows: string[] }) {
  return { playable: availableEther >= etherCost, etherAfter: availableEther - etherCost, comboPower, responseWindows, counterable: responseWindows.length > 0 };
}

export function firstDuelProgress(step: 'relay' | 'attack' | 'reversal') {
  const order = ['relay', 'attack', 'reversal'];
  const index = order.indexOf(step);
  return { current: index + 1, total: order.length, next: order[index + 1] || '완료' };
}
