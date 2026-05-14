# YugiohLegend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 유희왕 단순화 카드 대전 게임 — 3레인, 3턴, 동시 행동 공개, Phaser 3 + Node.js WebSocket

**Architecture:** Monorepo (server / client / shared). 서버가 게임 로직·AI·턴 흐름을 담당하는 단일 권위자(source of truth). 클라이언트는 렌더링과 입력만 담당하며, 항상 서버 메시지를 기반으로 상태를 갱신한다.

**Tech Stack:** Phaser 3, TypeScript, Vite (client) / Node.js, `ws`, TypeScript, Vitest (server)

---

## File Map

```
yugioh-legend/
  package.json                    ← npm workspaces 루트
  shared/
    types.ts                      ← 서버+클라이언트 공유 타입
    cards.json                    ← 초기 카드 데이터 (13장)
  server/
    package.json
    tsconfig.json
    src/
      index.ts                    ← WebSocket 서버 진입점
      RoomManager.ts              ← 방 생성/참가/소멸
      GameRoom.ts                 ← 게임 상태 머신, 턴 흐름, 제출 처리
      BattleResolver.ts           ← 전투 해결 순수 함수
      AIEngine.ts                 ← AI 행동 결정 (랜덤/그리디)
    tests/
      BattleResolver.test.ts
      GameRoom.test.ts
      AIEngine.test.ts
  client/
    package.json
    tsconfig.json
    vite.config.ts
    index.html
    src/
      main.ts                     ← Phaser 앱 진입점
      scenes/
        BootScene.ts              ← 에셋 프리로드
        MenuScene.ts              ← 메인 메뉴 (싱글/온라인/덱빌더)
        DeckBuilderScene.ts       ← 덱 빌더
        GameScene.ts              ← 메인 게임 필드
        ResultScene.ts            ← 승패 결과 화면
      components/
        Field.ts                  ← 3레인 필드 렌더링
        CardSprite.ts             ← 카드 Phaser GameObject
        HandArea.ts               ← 핸드 레이아웃
        LPDisplay.ts              ← LP 수치 표시
      network/
        SocketManager.ts          ← WebSocket 통신 이벤트 에미터
      data/
        CardTypes.ts              ← shared/types.ts 재익스포트
```

---

### Task 1: 프로젝트 초기화

**Files:**
- Create: `package.json`
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `client/package.json`
- Create: `client/tsconfig.json`
- Create: `client/vite.config.ts`
- Create: `client/index.html`
- Create: `.gitignore`

- [ ] **Step 1: 루트 package.json 생성**

```json
{
  "name": "yugioh-legend",
  "private": true,
  "workspaces": ["server", "client"],
  "scripts": {
    "dev:server": "npm run dev --workspace=server",
    "dev:client": "npm run dev --workspace=client",
    "test": "npm run test --workspace=server"
  }
}
```

- [ ] **Step 2: server/package.json 생성**

```json
{
  "name": "yugioh-legend-server",
  "version": "0.1.0",
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/index.ts",
    "build": "tsc",
    "test": "vitest run"
  },
  "dependencies": {
    "ws": "^8.16.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/ws": "^8.5.10",
    "ts-node-dev": "^2.0.0",
    "typescript": "^5.4.0",
    "vitest": "^1.5.0"
  }
}
```

- [ ] **Step 3: server/tsconfig.json 생성**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "dist",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "baseUrl": ".",
    "paths": {
      "shared/*": ["../shared/*"]
    }
  },
  "include": ["src/**/*", "tests/**/*", "../shared/**/*"]
}
```

- [ ] **Step 4: client/package.json 생성**

```json
{
  "name": "yugioh-legend-client",
  "version": "0.1.0",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "phaser": "^3.80.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vite": "^5.2.0"
  }
}
```

- [ ] **Step 5: client/tsconfig.json 생성**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM"],
    "moduleResolution": "bundler",
    "strict": true,
    "resolveJsonModule": true,
    "baseUrl": ".",
    "paths": {
      "shared/*": ["../shared/*"]
    }
  },
  "include": ["src/**/*", "../shared/**/*"]
}
```

- [ ] **Step 6: client/vite.config.ts 생성**

```typescript
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      shared: path.resolve(__dirname, '../shared'),
    },
  },
  server: { port: 3000 },
});
```

- [ ] **Step 7: client/index.html 생성**

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>YugiohLegend</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #000; overflow: hidden; }
  </style>
</head>
<body>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

- [ ] **Step 8: .gitignore 생성**

```
node_modules/
dist/
.env
```

- [ ] **Step 9: 의존성 설치 및 커밋**

```bash
cd server && npm install && cd ../client && npm install && cd ..
git init
git add -A
git commit -m "chore: initialize monorepo (server + client)"
```

---

### Task 2: 공유 타입 및 카드 데이터

**Files:**
- Create: `shared/types.ts`
- Create: `shared/cards.json`

- [ ] **Step 1: shared/types.ts 생성**

```typescript
export type CardType = 'monster' | 'spell' | 'trap';
export type EffectId = 'heal_1000' | 'power_boost' | 'monster_smash';
export type TrapConditionId = 'on_attacked' | 'on_direct_attack';
export type TrapEffectId = 'negate_attack' | 'reduce_damage_500';
export type PlayerIndex = 0 | 1;
export type LaneIndex = 0 | 1 | 2;

export interface Card {
  id: string;
  type: CardType;
  name: string;
  atk?: number;
  effect?: EffectId;
  trapCondition?: TrapConditionId;
  trapEffect?: TrapEffectId;
}

export interface LaneState {
  monster: Card | null;
  trap: Card | null;
  tempAtkBoost: number; // power_boost 적용 시 이번 전투에서만 유효
}

export interface PlayerState {
  index: PlayerIndex;
  lp: number;
  hand: Card[];
  deck: Card[];
  lanes: [LaneState, LaneState, LaneState];
}

export interface TurnAction {
  summon?: { card: Card; laneIndex: LaneIndex };
  spells: Card[];
  traps: { card: Card; laneIndex: LaneIndex }[];
}

export interface BattleEvent {
  laneIndex: LaneIndex;
  type: 'monster_vs_monster' | 'direct_attack' | 'no_action';
  attackerIndex: PlayerIndex;
  damage: number;
  destroyedCards: { playerIndex: PlayerIndex; card: Card }[];
  trapTriggered?: { playerIndex: PlayerIndex; card: Card };
  negated: boolean;
}

export interface GameState {
  turn: number; // 1~3
  phase: 'waiting' | 'action' | 'reveal' | 'battle' | 'final_battle' | 'game_over';
  players: [PlayerState, PlayerState];
  submitted: [boolean, boolean];
  pendingActions: [TurnAction | null, TurnAction | null];
  winner: PlayerIndex | 'draw' | null;
}

// ── WebSocket 메시지 ──────────────────────────────────────────
export type ClientMessage =
  | { type: 'join_room'; mode: 'single' | 'multi'; deck: Card[] }
  | { type: 'submit_action'; action: TurnAction };

export type ServerMessage =
  | { type: 'game_start'; yourIndex: PlayerIndex; yourHand: Card[]; opponentHandCount: number; turn: number }
  | { type: 'turn_start'; drawnCard: Card; turn: number }
  | { type: 'reveal'; yourAction: TurnAction; opponentAction: TurnAction }
  | { type: 'battle_result'; events: BattleEvent[]; lps: [number, number] }
  | { type: 'game_over'; winner: PlayerIndex | 'draw'; finalLPs: [number, number] }
  | { type: 'error'; message: string };
```

- [ ] **Step 2: shared/cards.json 생성 (13장)**

```json
[
  { "id": "goblin_warrior",  "type": "monster", "name": "고블린 전사",  "atk": 1000 },
  { "id": "dark_knight",     "type": "monster", "name": "어둠의 기사",  "atk": 1500 },
  { "id": "iron_golem",      "type": "monster", "name": "강철 골렘",    "atk": 2000 },
  { "id": "swift_thief",     "type": "monster", "name": "날쌘 도적",    "atk": 800  },
  { "id": "hero_warrior",    "type": "monster", "name": "영웅 전사",    "atk": 2500 },
  { "id": "village_guard",   "type": "monster", "name": "마을 수비대",  "atk": 500  },
  { "id": "dragon_mage",     "type": "monster", "name": "용 마법사",    "atk": 1800 },
  { "id": "flame_wizard",    "type": "monster", "name": "불꽃 마법사",  "atk": 1200 },
  { "id": "healing_light",   "type": "spell",   "name": "치유의 빛",    "effect": "heal_1000"     },
  { "id": "power_boost",     "type": "spell",   "name": "파워 부스트",  "effect": "power_boost"   },
  { "id": "monster_smash",   "type": "spell",   "name": "몬스터 분쇄",  "effect": "monster_smash" },
  { "id": "counter_trap",    "type": "trap",    "name": "반격의 함정",
    "trapCondition": "on_attacked",     "trapEffect": "negate_attack"    },
  { "id": "direct_shield",   "type": "trap",    "name": "다이렉트 실드",
    "trapCondition": "on_direct_attack","trapEffect": "reduce_damage_500" }
]
```

- [ ] **Step 3: 커밋**

```bash
git add shared/
git commit -m "feat: add shared types and initial card data"
```

---

### Task 3: BattleResolver — 전투 해결 로직 (TDD)

**Files:**
- Create: `server/src/BattleResolver.ts`
- Create: `server/tests/BattleResolver.test.ts`

BattleResolver는 두 PlayerState를 받아 BattleEvent 배열과 LP 변화량을 반환하는 순수 함수다.
액션 적용(소환·마법)은 GameRoom에서 처리하며, BattleResolver는 이미 완성된 필드 상태만 받는다.

- [ ] **Step 1: 테스트 파일 작성**

```typescript
// server/tests/BattleResolver.test.ts
import { describe, it, expect } from 'vitest';
import { resolveBattle } from '../src/BattleResolver';
import type { Card, LaneState, PlayerState } from '../../shared/types';

function monster(id: string, atk: number): Card {
  return { id, type: 'monster', name: id, atk };
}
function lane(mon: Card | null = null, trap: Card | null = null): LaneState {
  return { monster: mon, trap, tempAtkBoost: 0 };
}
function player(index: 0 | 1, lp: number, l0: LaneState, l1: LaneState, l2: LaneState): PlayerState {
  return { index, lp, hand: [], deck: [], lanes: [l0, l1, l2] };
}

describe('resolveBattle', () => {
  it('양쪽 레인이 모두 비어있으면 LP 변화 없음', () => {
    const p0 = player(0, 4000, lane(), lane(), lane());
    const p1 = player(1, 4000, lane(), lane(), lane());
    const result = resolveBattle(p0, p1);
    expect(result.p0LpDelta).toBe(0);
    expect(result.p1LpDelta).toBe(0);
  });

  it('p0 몬스터가 빈 레인 공격 → p1 다이렉트 데미지', () => {
    const p0 = player(0, 4000, lane(monster('m', 1500)), lane(), lane());
    const p1 = player(1, 4000, lane(), lane(), lane());
    const result = resolveBattle(p0, p1);
    expect(result.p1LpDelta).toBe(-1500);
    expect(result.p0LpDelta).toBe(0);
    expect(result.events[0].type).toBe('direct_attack');
    expect(result.events[0].attackerIndex).toBe(0);
  });

  it('p1 몬스터가 빈 레인 공격 → p0 다이렉트 데미지', () => {
    const p0 = player(0, 4000, lane(), lane(), lane());
    const p1 = player(1, 4000, lane(monster('m', 1000)), lane(), lane());
    const result = resolveBattle(p0, p1);
    expect(result.p0LpDelta).toBe(-1000);
    expect(result.p1LpDelta).toBe(0);
  });

  it('p0 몬스터 ATK > p1 몬스터 ATK → p1 몬스터 파괴, 차이만큼 LP 감소', () => {
    const p0 = player(0, 4000, lane(monster('a', 2000)), lane(), lane());
    const p1 = player(1, 4000, lane(monster('b', 1500)), lane(), lane());
    const result = resolveBattle(p0, p1);
    expect(result.p1LpDelta).toBe(-500);
    expect(result.p0LpDelta).toBe(0);
    expect(result.events[0].destroyedCards).toEqual([{ playerIndex: 1, card: monster('b', 1500) }]);
  });

  it('ATK 동일 → 양쪽 파괴, LP 변화 없음', () => {
    const p0 = player(0, 4000, lane(monster('a', 1000)), lane(), lane());
    const p1 = player(1, 4000, lane(monster('b', 1000)), lane(), lane());
    const result = resolveBattle(p0, p1);
    expect(result.p0LpDelta).toBe(0);
    expect(result.p1LpDelta).toBe(0);
    expect(result.events[0].destroyedCards).toHaveLength(2);
  });

  it('tempAtkBoost가 ATK에 반영됨', () => {
    const boostedLane: LaneState = { monster: monster('a', 1000), trap: null, tempAtkBoost: 500 };
    const p0 = player(0, 4000, boostedLane, lane(), lane());
    const p1 = player(1, 4000, lane(monster('b', 1200)), lane(), lane());
    // p0 effective ATK = 1500 > 1200 → p1 monster destroyed, p1 lp -300
    const result = resolveBattle(p0, p1);
    expect(result.p1LpDelta).toBe(-300);
  });

  it('on_attacked negate_attack 트랩 → 공격 무효화, LP 변화 없음', () => {
    const trapCard: Card = { id: 'counter_trap', type: 'trap', name: '반격', trapCondition: 'on_attacked', trapEffect: 'negate_attack' };
    const p0 = player(0, 4000, lane(monster('a', 1500)), lane(), lane());
    const p1 = player(1, 4000, lane(monster('b', 1000), trapCard), lane(), lane());
    // p1 lane has trap: p0's attack on p1 is negated; p1's attack on p0 still resolves
    const result = resolveBattle(p0, p1);
    // p0 attack negated → no damage to p1
    // p1 monster (1000) attacks p0 monster (1500) → p1 monster destroyed, p0 lp -0 (1000 < 1500)
    expect(result.p1LpDelta).toBe(0);
    expect(result.p0LpDelta).toBe(0);
    const mvmEvent = result.events.find(e => e.type === 'monster_vs_monster');
    expect(mvmEvent?.negated).toBe(true);
  });

  it('on_direct_attack reduce_damage_500 → 다이렉트 데미지 500 감소', () => {
    const trapCard: Card = { id: 'direct_shield', type: 'trap', name: '실드', trapCondition: 'on_direct_attack', trapEffect: 'reduce_damage_500' };
    const p0 = player(0, 4000, lane(monster('a', 1000)), lane(), lane());
    const p1 = player(1, 4000, lane(null, trapCard), lane(), lane());
    const result = resolveBattle(p0, p1);
    expect(result.p1LpDelta).toBe(-500); // 1000 - 500 = 500
    expect(result.events[0].trapTriggered?.card.id).toBe('direct_shield');
  });

  it('3개 레인 모두 독립적으로 처리', () => {
    const p0 = player(0, 4000, lane(monster('a', 500)), lane(monster('b', 1000)), lane(monster('c', 1500)));
    const p1 = player(1, 4000, lane(), lane(monster('d', 1500)), lane(monster('e', 1000)));
    const result = resolveBattle(p0, p1);
    // lane0: p0 direct 500 → p1 lp -500
    // lane1: p0(1000) vs p1(1500) → p0 monster destroyed, p0 lp -500
    // lane2: p0(1500) vs p1(1000) → p1 monster destroyed, p1 lp -500
    expect(result.p1LpDelta).toBe(-1000);
    expect(result.p0LpDelta).toBe(-500);
  });
});
```

- [ ] **Step 2: 테스트 실행 (실패 확인)**

```bash
cd server && npx vitest run tests/BattleResolver.test.ts
```

Expected: 실패 (BattleResolver.ts 없음)

- [ ] **Step 3: server/src/BattleResolver.ts 구현**

```typescript
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
      // 적어도 한쪽 공격이 무효화됨 — 무효화된 쪽은 데미지/파괴 없음
      const trapOwner: PlayerIndex = p0AttackNegated ? 1 : 0;
      const trapCard = p0AttackNegated ? p1Lane.trap! : p0Lane.trap!;

      // 무효화되지 않은 쪽의 공격만 처리
      if (p0AttackNegated && !p1AttackNegated) {
        // p0 attack negated; p1 attacks p0
        if (p1Atk > p0Atk) {
          destroyedCards.push({ playerIndex: 0 as PlayerIndex, card: p0Mon });
          damage = p1Atk - p0Atk;
          p0LpDelta -= damage;
        } else if (p0Atk > p1Atk) {
          destroyedCards.push({ playerIndex: 1 as PlayerIndex, card: p1Mon });
          damage = p0Atk - p1Atk;
          p1LpDelta -= damage;
        } else {
          destroyedCards.push({ playerIndex: 0 as PlayerIndex, card: p0Mon });
          destroyedCards.push({ playerIndex: 1 as PlayerIndex, card: p1Mon });
        }
      } else if (!p0AttackNegated && p1AttackNegated) {
        // p1 attack negated; p0 attacks p1
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
      }
      // 양쪽 모두 무효화: LP 변화 없음, 파괴 없음

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

  // 한쪽만 몬스터 존재 → 다이렉트 어택
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
```

- [ ] **Step 4: 테스트 실행 (통과 확인)**

```bash
cd server && npx vitest run tests/BattleResolver.test.ts
```

Expected: 9개 테스트 모두 PASS

- [ ] **Step 5: 커밋**

```bash
git add server/src/BattleResolver.ts server/tests/BattleResolver.test.ts
git commit -m "feat: implement BattleResolver with full test coverage"
```

---

### Task 4: GameRoom — 게임 상태 머신 (TDD)

**Files:**
- Create: `server/src/GameRoom.ts`
- Create: `server/tests/GameRoom.test.ts`

GameRoom은 두 플레이어의 액션을 받아 상태를 갱신하고, 브로드캐스트할 ServerMessage 배열을 반환한다.
실제 WebSocket 전송은 없으며, 테스트 가능한 순수 상태 머신이다.

- [ ] **Step 1: 테스트 파일 작성**

```typescript
// server/tests/GameRoom.test.ts
import { describe, it, expect } from 'vitest';
import { GameRoom } from '../src/GameRoom';
import type { Card, TurnAction } from '../../shared/types';
import cards from '../../shared/cards.json';

const allCards = cards as Card[];

function makeDeck(): Card[] {
  // 10장짜리 유효한 덱 (각 카드 최대 2장)
  return allCards.slice(0, 8).concat(allCards.slice(0, 2));
}

function emptyAction(): TurnAction {
  return { spells: [], traps: [] };
}

describe('GameRoom', () => {
  it('두 플레이어 참가 시 game_start 메시지 발송, 핸드 4장', () => {
    const room = new GameRoom('room1');
    const msgs0 = room.addPlayer('p0', makeDeck());
    const msgs1 = room.addPlayer('p1', makeDeck());
    const start0 = msgs0.find(m => m.playerIndex === 0 && m.message.type === 'game_start');
    const start1 = msgs1.find(m => m.playerIndex === 1 && m.message.type === 'game_start');
    expect(start0).toBeDefined();
    expect(start1).toBeDefined();
    if (start0?.message.type === 'game_start') {
      expect(start0.message.yourHand).toHaveLength(4);
    }
  });

  it('첫 번째 플레이어만 참가하면 game_start 없음', () => {
    const room = new GameRoom('room1');
    const msgs = room.addPlayer('p0', makeDeck());
    expect(msgs.find(m => m.message.type === 'game_start')).toBeUndefined();
  });

  it('양쪽 submit_action 제출 시 reveal + battle_result 발송', () => {
    const room = new GameRoom('room1');
    room.addPlayer('p0', makeDeck());
    room.addPlayer('p1', makeDeck());
    room.submitAction(0, emptyAction());
    const msgs = room.submitAction(1, emptyAction());
    expect(msgs.some(m => m.message.type === 'reveal')).toBe(true);
    expect(msgs.some(m => m.message.type === 'battle_result')).toBe(true);
  });

  it('한쪽만 제출하면 reveal 없음', () => {
    const room = new GameRoom('room1');
    room.addPlayer('p0', makeDeck());
    room.addPlayer('p1', makeDeck());
    const msgs = room.submitAction(0, emptyAction());
    expect(msgs.some(m => m.message.type === 'reveal')).toBe(false);
  });

  it('3턴 + 파이널 배틀 후 game_over 발송', () => {
    const room = new GameRoom('room1');
    room.addPlayer('p0', makeDeck());
    room.addPlayer('p1', makeDeck());
    for (let t = 0; t < 3; t++) {
      room.submitAction(0, emptyAction());
      room.submitAction(1, emptyAction());
    }
    const msgs = room.submitAction(0, emptyAction()); // final battle
    const allMsgs = msgs.concat(room.submitAction(1, emptyAction()));
    // game_over는 마지막 배틀 이후 나와야 함
    const gameOver = allMsgs.find(m => m.message.type === 'game_over');
    expect(gameOver).toBeDefined();
  });

  it('덱 크기 8~12장 밖이면 에러', () => {
    const room = new GameRoom('room1');
    const msgs = room.addPlayer('p0', allCards.slice(0, 5)); // 5장 → 에러
    expect(msgs.some(m => m.message.type === 'error')).toBe(true);
  });

  it('소환 액션 적용 후 필드에 몬스터 존재', () => {
    const room = new GameRoom('room1');
    room.addPlayer('p0', makeDeck());
    room.addPlayer('p1', makeDeck());
    const monsterCard = allCards.find(c => c.type === 'monster')!;
    const action: TurnAction = { summon: { card: monsterCard, laneIndex: 0 }, spells: [], traps: [] };
    room.submitAction(0, action);
    room.submitAction(1, emptyAction());
    expect(room.getState().players[0].lanes[0].monster?.id).toBe(monsterCard.id);
  });
});
```

- [ ] **Step 2: 테스트 실행 (실패 확인)**

```bash
cd server && npx vitest run tests/GameRoom.test.ts
```

Expected: 실패 (GameRoom.ts 없음)

- [ ] **Step 3: server/src/GameRoom.ts 구현**

```typescript
import { resolveBattle } from './BattleResolver';
import type {
  Card, GameState, LaneState, PlayerState, TurnAction,
  ServerMessage, PlayerIndex
} from '../../shared/types';
import cardsData from '../../shared/cards.json';

const ALL_CARDS = cardsData as Card[];
const INITIAL_LP = 4000;
const INITIAL_HAND_SIZE = 4;
const MAX_TURNS = 3;

export interface OutgoingMessage {
  playerIndex: PlayerIndex | 'both';
  message: ServerMessage;
}

function emptyLane(): LaneState {
  return { monster: null, trap: null, tempAtkBoost: 0 };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export class GameRoom {
  id: string;
  private state: GameState;
  private playerIds: [string | null, string | null] = [null, null];

  constructor(id: string) {
    this.id = id;
    this.state = {
      turn: 1,
      phase: 'waiting',
      players: [
        { index: 0, lp: INITIAL_LP, hand: [], deck: [], lanes: [emptyLane(), emptyLane(), emptyLane()] },
        { index: 1, lp: INITIAL_LP, hand: [], deck: [], lanes: [emptyLane(), emptyLane(), emptyLane()] },
      ],
      submitted: [false, false],
      pendingActions: [null, null],
      winner: null,
    };
  }

  getState(): GameState { return this.state; }

  addPlayer(playerId: string, deck: Card[]): OutgoingMessage[] {
    if (deck.length < 8 || deck.length > 12) {
      return [{ playerIndex: this.playerIds[0] ? 1 : 0, message: { type: 'error', message: '덱은 8~12장이어야 합니다.' } }];
    }
    const index = this.playerIds[0] === null ? 0 : 1;
    this.playerIds[index] = playerId;
    const shuffled = shuffle(deck);
    const hand = shuffled.splice(0, INITIAL_HAND_SIZE);
    this.state.players[index].deck = shuffled;
    this.state.players[index].hand = hand;

    if (this.playerIds[0] && this.playerIds[1]) {
      this.state.phase = 'action';
      return [
        { playerIndex: 0, message: { type: 'game_start', yourIndex: 0, yourHand: this.state.players[0].hand, opponentHandCount: INITIAL_HAND_SIZE, turn: 1 } },
        { playerIndex: 1, message: { type: 'game_start', yourIndex: 1, yourHand: this.state.players[1].hand, opponentHandCount: INITIAL_HAND_SIZE, turn: 1 } },
      ];
    }
    return [];
  }

  submitAction(playerIndex: PlayerIndex, action: TurnAction): OutgoingMessage[] {
    if (this.state.phase !== 'action') return [];
    this.state.pendingActions[playerIndex] = action;
    this.state.submitted[playerIndex] = true;

    if (!this.state.submitted[0] || !this.state.submitted[1]) return [];

    // 양쪽 제출 완료 → 처리
    return this.resolveActions();
  }

  private resolveActions(): OutgoingMessage[] {
    const msgs: OutgoingMessage[] = [];
    const [a0, a1] = this.state.pendingActions as [TurnAction, TurnAction];

    // reveal
    msgs.push({ playerIndex: 0, message: { type: 'reveal', yourAction: a0, opponentAction: a1 } });
    msgs.push({ playerIndex: 1, message: { type: 'reveal', yourAction: a1, opponentAction: a0 } });

    // 액션 적용
    this.applyAction(0, a0);
    this.applyAction(1, a1);

    // 전투 해결
    const { events, p0LpDelta, p1LpDelta } = resolveBattle(
      this.state.players[0],
      this.state.players[1]
    );

    // 파괴된 몬스터 제거
    for (const ev of events) {
      for (const { playerIndex, card } of ev.destroyedCards) {
        const lane = this.state.players[playerIndex].lanes[ev.laneIndex];
        if (lane.monster?.id === card.id) lane.monster = null;
      }
      // 발동된 트랩 제거
      if (ev.trapTriggered) {
        const { playerIndex } = ev.trapTriggered;
        this.state.players[playerIndex].lanes[ev.laneIndex].trap = null;
      }
    }

    // tempAtkBoost 초기화
    for (const p of this.state.players) {
      for (const l of p.lanes) l.tempAtkBoost = 0;
    }

    // LP 갱신
    this.state.players[0].lp += p0LpDelta;
    this.state.players[1].lp += p1LpDelta;

    const lps: [number, number] = [this.state.players[0].lp, this.state.players[1].lp];
    msgs.push({ playerIndex: 'both', message: { type: 'battle_result', events, lps } });

    // 즉시 패배 판정
    const p0Dead = this.state.players[0].lp <= 0;
    const p1Dead = this.state.players[1].lp <= 0;
    if (p0Dead || p1Dead) {
      const winner = p0Dead && p1Dead ? 'draw' : p0Dead ? 1 : 0;
      this.state.winner = winner;
      this.state.phase = 'game_over';
      msgs.push({ playerIndex: 'both', message: { type: 'game_over', winner, finalLPs: lps } });
      return msgs;
    }

    // 다음 턴 또는 파이널 배틀
    this.state.submitted = [false, false];
    this.state.pendingActions = [null, null];

    if (this.state.turn >= MAX_TURNS) {
      // 파이널 배틀 페이즈 — 바로 재귀 처리 (양쪽 빈 액션으로)
      this.state.phase = 'final_battle';
      return msgs.concat(this.resolveFinalBattle());
    }

    this.state.turn += 1;
    this.state.phase = 'action';

    // 드로우
    for (const pi of [0, 1] as PlayerIndex[]) {
      const drawn = this.state.players[pi].deck.shift();
      if (drawn) {
        this.state.players[pi].hand.push(drawn);
        msgs.push({ playerIndex: pi, message: { type: 'turn_start', drawnCard: drawn, turn: this.state.turn } });
      }
    }

    return msgs;
  }

  private resolveFinalBattle(): OutgoingMessage[] {
    const msgs: OutgoingMessage[] = [];
    const { events, p0LpDelta, p1LpDelta } = resolveBattle(
      this.state.players[0],
      this.state.players[1]
    );

    this.state.players[0].lp += p0LpDelta;
    this.state.players[1].lp += p1LpDelta;

    const lps: [number, number] = [this.state.players[0].lp, this.state.players[1].lp];
    msgs.push({ playerIndex: 'both', message: { type: 'battle_result', events, lps } });

    const p0Lp = this.state.players[0].lp;
    const p1Lp = this.state.players[1].lp;
    const winner: PlayerIndex | 'draw' =
      p0Lp > p1Lp ? 0 : p1Lp > p0Lp ? 1 : 'draw';

    this.state.winner = winner;
    this.state.phase = 'game_over';
    msgs.push({ playerIndex: 'both', message: { type: 'game_over', winner, finalLPs: lps } });
    return msgs;
  }

  private applyAction(playerIndex: PlayerIndex, action: TurnAction): void {
    const player = this.state.players[playerIndex];

    // 소환
    if (action.summon) {
      const { card, laneIndex } = action.summon;
      if (!player.lanes[laneIndex].monster) {
        player.lanes[laneIndex].monster = card;
        player.hand = player.hand.filter(c => c.id !== card.id);
      }
    }

    // 마법
    for (const spell of action.spells) {
      this.applySpell(playerIndex, spell);
      player.hand = player.hand.filter(c => c.id !== spell.id);
    }

    // 함정 세트
    for (const { card, laneIndex } of action.traps) {
      player.lanes[laneIndex].trap = card;
      player.hand = player.hand.filter(c => c.id !== card.id);
    }
  }

  private applySpell(playerIndex: PlayerIndex, spell: Card): void {
    const player = this.state.players[playerIndex];
    const opponent = this.state.players[playerIndex === 0 ? 1 : 0];

    switch (spell.effect) {
      case 'heal_1000':
        player.lp += 1000;
        break;
      case 'power_boost':
        for (const l of player.lanes) {
          if (l.monster) l.tempAtkBoost += 500;
        }
        break;
      case 'monster_smash': {
        // 상대 필드에서 ATK 가장 높은 몬스터 파괴
        let maxAtk = -1;
        let maxLaneIdx = -1;
        for (let i = 0; i < 3; i++) {
          const m = opponent.lanes[i].monster;
          if (m && (m.atk ?? 0) > maxAtk) {
            maxAtk = m.atk ?? 0;
            maxLaneIdx = i;
          }
        }
        if (maxLaneIdx >= 0) opponent.lanes[maxLaneIdx as 0 | 1 | 2].monster = null;
        break;
      }
    }
  }
}
```

- [ ] **Step 4: 테스트 실행 (통과 확인)**

```bash
cd server && npx vitest run tests/GameRoom.test.ts
```

Expected: 7개 테스트 모두 PASS

- [ ] **Step 5: 커밋**

```bash
git add server/src/GameRoom.ts server/tests/GameRoom.test.ts
git commit -m "feat: implement GameRoom state machine with full test coverage"
```

---

### Task 5: AIEngine (TDD)

**Files:**
- Create: `server/src/AIEngine.ts`
- Create: `server/tests/AIEngine.test.ts`

AIEngine은 현재 PlayerState와 핸드를 받아 TurnAction을 반환하는 순수 함수다.
랜덤 AI와 그리디 AI 두 가지를 구현한다.

- [ ] **Step 1: 테스트 파일 작성**

```typescript
// server/tests/AIEngine.test.ts
import { describe, it, expect } from 'vitest';
import { randomAction, greedyAction } from '../src/AIEngine';
import type { Card, PlayerState, LaneState } from '../../shared/types';

function monster(id: string, atk: number): Card {
  return { id, type: 'monster', name: id, atk };
}
function emptyLane(): LaneState {
  return { monster: null, trap: null, tempAtkBoost: 0 };
}
function player(hand: Card[]): PlayerState {
  return { index: 0, lp: 4000, hand, deck: [], lanes: [emptyLane(), emptyLane(), emptyLane()] };
}

describe('randomAction', () => {
  it('핸드에 몬스터 있으면 소환 포함 가능', () => {
    const p = player([monster('a', 1000), monster('b', 1500)]);
    const action = randomAction(p);
    // 소환 없을 수도 있음 (랜덤), 하지만 항상 유효한 TurnAction이어야 함
    expect(action.spells).toBeDefined();
    expect(action.traps).toBeDefined();
    if (action.summon) {
      expect([0, 1, 2]).toContain(action.summon.laneIndex);
    }
  });

  it('핸드가 비어있으면 아무 액션도 없음', () => {
    const p = player([]);
    const action = randomAction(p);
    expect(action.summon).toBeUndefined();
    expect(action.spells).toHaveLength(0);
    expect(action.traps).toHaveLength(0);
  });

  it('이미 몬스터가 있는 레인에는 소환하지 않음', () => {
    const fullPlayer: PlayerState = {
      index: 0, lp: 4000, deck: [],
      hand: [monster('new', 1000)],
      lanes: [
        { monster: monster('a', 500), trap: null, tempAtkBoost: 0 },
        { monster: monster('b', 500), trap: null, tempAtkBoost: 0 },
        { monster: monster('c', 500), trap: null, tempAtkBoost: 0 },
      ],
    };
    const action = randomAction(fullPlayer);
    expect(action.summon).toBeUndefined(); // 빈 레인 없음
  });
});

describe('greedyAction', () => {
  it('몬스터 중 ATK 가장 높은 것을 소환', () => {
    const p = player([monster('weak', 500), monster('strong', 2000), monster('mid', 1000)]);
    const action = greedyAction(p);
    expect(action.summon?.card.id).toBe('strong');
  });

  it('마법 카드는 모두 사용', () => {
    const spell: Card = { id: 'heal', type: 'spell', name: '치유', effect: 'heal_1000' };
    const p = player([spell, monster('m', 1000)]);
    const action = greedyAction(p);
    expect(action.spells).toHaveLength(1);
    expect(action.spells[0].id).toBe('heal');
  });

  it('함정 카드는 첫 번째 빈 레인에 세트', () => {
    const trap: Card = { id: 'ct', type: 'trap', name: '함정', trapCondition: 'on_attacked', trapEffect: 'negate_attack' };
    const p = player([trap]);
    const action = greedyAction(p);
    expect(action.traps).toHaveLength(1);
    expect(action.traps[0].laneIndex).toBe(0);
  });
});
```

- [ ] **Step 2: 테스트 실행 (실패 확인)**

```bash
cd server && npx vitest run tests/AIEngine.test.ts
```

Expected: 실패

- [ ] **Step 3: server/src/AIEngine.ts 구현**

```typescript
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
```

- [ ] **Step 4: 테스트 실행 (통과 확인)**

```bash
cd server && npx vitest run tests/AIEngine.test.ts
```

Expected: 6개 테스트 모두 PASS

- [ ] **Step 5: 전체 서버 테스트 실행**

```bash
cd server && npx vitest run
```

Expected: 전체 PASS

- [ ] **Step 6: 커밋**

```bash
git add server/src/AIEngine.ts server/tests/AIEngine.test.ts
git commit -m "feat: implement AIEngine (random + greedy)"
```

---

### Task 6: WebSocket 서버 (RoomManager + index.ts)

**Files:**
- Create: `server/src/RoomManager.ts`
- Create: `server/src/index.ts`

- [ ] **Step 1: server/src/RoomManager.ts 작성**

```typescript
import { GameRoom } from './GameRoom';
import { greedyAction } from './AIEngine';
import type { Card, ClientMessage, PlayerIndex } from '../../shared/types';
import type WebSocket from 'ws';

interface PlayerConnection {
  ws: WebSocket;
  roomId: string;
  playerIndex: PlayerIndex;
}

export class RoomManager {
  private rooms = new Map<string, GameRoom>();
  private connections = new Map<WebSocket, PlayerConnection>();
  private waitingRoom: { roomId: string; ws: WebSocket } | null = null;

  handleConnection(ws: WebSocket): void {
    ws.on('message', (raw) => {
      try {
        const msg: ClientMessage = JSON.parse(raw.toString());
        this.handleMessage(ws, msg);
      } catch {
        this.send(ws, { type: 'error', message: '잘못된 메시지 형식' });
      }
    });

    ws.on('close', () => {
      this.connections.delete(ws);
    });
  }

  private handleMessage(ws: WebSocket, msg: ClientMessage): void {
    if (msg.type === 'join_room') {
      this.joinRoom(ws, msg.mode, msg.deck);
    } else if (msg.type === 'submit_action') {
      const conn = this.connections.get(ws);
      if (!conn) return;
      const room = this.rooms.get(conn.roomId);
      if (!room) return;
      const outMsgs = room.submitAction(conn.playerIndex, msg.action);
      this.broadcast(room.id, outMsgs);
    }
  }

  private joinRoom(ws: WebSocket, mode: 'single' | 'multi', deck: Card[]): void {
    if (mode === 'single') {
      const roomId = `single_${Date.now()}`;
      const room = new GameRoom(roomId);
      this.rooms.set(roomId, room);

      // 플레이어 참가
      const conn: PlayerConnection = { ws, roomId, playerIndex: 0 };
      this.connections.set(ws, conn);
      const msgs1 = room.addPlayer('human', deck);
      this.broadcast(roomId, msgs1);

      // AI 참가 (딜레이 없이 즉시, AI는 그리디)
      const aiDeck = deck.slice(); // AI도 동일 덱 사용 (임시)
      const msgs2 = room.addPlayer('ai', aiDeck);
      this.broadcast(roomId, msgs2);

      // AI 자동 행동 리스너 설정
      this.setupAIListener(room, ws);
    } else {
      // 멀티 — 대기실 매칭
      if (this.waitingRoom) {
        const { roomId, ws: opponentWs } = this.waitingRoom;
        this.waitingRoom = null;
        const room = this.rooms.get(roomId)!;

        const conn: PlayerConnection = { ws, roomId, playerIndex: 1 };
        this.connections.set(ws, conn);
        const msgs = room.addPlayer('p1', deck);
        this.broadcast(roomId, msgs);
      } else {
        const roomId = `multi_${Date.now()}`;
        const room = new GameRoom(roomId);
        this.rooms.set(roomId, room);
        const conn: PlayerConnection = { ws, roomId, playerIndex: 0 };
        this.connections.set(ws, conn);
        room.addPlayer('p0', deck);
        this.waitingRoom = { roomId, ws };
        this.send(ws, { type: 'error', message: '상대방을 기다리는 중...' }); // 임시
      }
    }
  }

  private setupAIListener(room: GameRoom, humanWs: WebSocket): void {
    // GameRoom의 phase가 'action'으로 바뀔 때마다 AI가 제출
    // 간단한 폴링 대신 submitAction 이후 상태를 체크
    const tryAISubmit = () => {
      const state = room.getState();
      if (state.phase !== 'action') return;
      if (state.submitted[1]) return; // 이미 AI 제출됨

      const aiPlayer = state.players[1];
      const action = greedyAction(aiPlayer);

      // AI 딜레이 (500~1500ms)
      const delay = 500 + Math.random() * 1000;
      setTimeout(() => {
        const outMsgs = room.submitAction(1, action);
        this.broadcast(room.id, outMsgs);
        // 다음 턴에도 반복
        if (room.getState().phase === 'action') {
          tryAISubmit();
        }
      }, delay);
    };

    // 게임 시작 후 AI 제출 시작
    setTimeout(tryAISubmit, 100);

    // turn_start 메시지 후에도 재시도
    const originalBroadcast = this.broadcast.bind(this);
    // NOTE: 실제로는 GameRoom 이벤트 이미터를 쓰는 것이 더 깔끔하지만
    // 현재 구조에서는 broadcast 후 AI 체크로 충분
  }

  broadcast(roomId: string, msgs: import('./GameRoom').OutgoingMessage[]): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    for (const { playerIndex, message } of msgs) {
      if (playerIndex === 'both') {
        for (const [ws, conn] of this.connections) {
          if (conn.roomId === roomId) this.send(ws, message);
        }
      } else {
        const ws = [...this.connections.entries()].find(
          ([, c]) => c.roomId === roomId && c.playerIndex === playerIndex
        )?.[0];
        if (ws) this.send(ws, message);
      }
    }
  }

  private send(ws: WebSocket, msg: import('../../shared/types').ServerMessage): void {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }
}
```

- [ ] **Step 2: server/src/index.ts 작성**

```typescript
import { WebSocketServer } from 'ws';
import { RoomManager } from './RoomManager';

const PORT = Number(process.env.PORT ?? 8080);
const wss = new WebSocketServer({ port: PORT });
const manager = new RoomManager();

wss.on('connection', (ws) => {
  console.log('[server] client connected');
  manager.handleConnection(ws);
});

console.log(`[server] WebSocket server running on ws://localhost:${PORT}`);
```

- [ ] **Step 3: 서버 기동 확인**

```bash
cd server && npx ts-node-dev --transpile-only src/index.ts
```

Expected: `[server] WebSocket server running on ws://localhost:8080` 출력

- [ ] **Step 4: 커밋**

```bash
git add server/src/RoomManager.ts server/src/index.ts
git commit -m "feat: add WebSocket server and RoomManager"
```

---

### Task 7: 클라이언트 기본 설정 + SocketManager

**Files:**
- Create: `client/src/main.ts`
- Create: `client/src/data/CardTypes.ts`
- Create: `client/src/network/SocketManager.ts`

- [ ] **Step 1: client/src/data/CardTypes.ts 작성**

```typescript
export type {
  Card, CardType, EffectId, TrapConditionId, TrapEffectId,
  PlayerIndex, LaneIndex, LaneState, PlayerState,
  TurnAction, BattleEvent, GameState,
  ClientMessage, ServerMessage,
} from 'shared/types';
```

- [ ] **Step 2: client/src/network/SocketManager.ts 작성**

```typescript
import type { ClientMessage, ServerMessage } from '../data/CardTypes';

type MessageHandler = (msg: ServerMessage) => void;

export class SocketManager {
  private ws: WebSocket | null = null;
  private handlers: MessageHandler[] = [];
  private url: string;

  constructor(url: string = `ws://localhost:8080`) {
    this.url = url;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(e);
      this.ws.onmessage = (e) => {
        try {
          const msg: ServerMessage = JSON.parse(e.data);
          for (const h of this.handlers) h(msg);
        } catch { /* ignore malformed */ }
      };
    });
  }

  send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  on(handler: MessageHandler): () => void {
    this.handlers.push(handler);
    return () => { this.handlers = this.handlers.filter(h => h !== handler); };
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
  }
}
```

- [ ] **Step 3: client/src/main.ts 작성 (Phaser 앱 진입점)**

```typescript
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { DeckBuilderScene } from './scenes/DeckBuilderScene';
import { GameScene } from './scenes/GameScene';
import { ResultScene } from './scenes/ResultScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  backgroundColor: '#1a1a2e',
  scene: [BootScene, MenuScene, DeckBuilderScene, GameScene, ResultScene],
  parent: document.body,
};

new Phaser.Game(config);
```

- [ ] **Step 4: 빌드 확인**

```bash
cd client && npx vite build
```

Expected: dist/ 생성, 에러 없음 (씬 파일이 아직 없으니 import 오류 발생 → 다음 Task에서 생성)

실제로는 Task 8~12 완료 후 최종 빌드를 확인하면 된다. 지금은 `main.ts`를 작성해두고 넘어간다.

- [ ] **Step 5: 커밋**

```bash
git add client/src/
git commit -m "feat: add client entry point, CardTypes, and SocketManager"
```

---

### Task 8: BootScene + MenuScene

**Files:**
- Create: `client/src/scenes/BootScene.ts`
- Create: `client/src/scenes/MenuScene.ts`

- [ ] **Step 1: client/src/scenes/BootScene.ts 작성**

```typescript
import Phaser from 'phaser';
import cardsJson from 'shared/cards.json';
import type { Card } from '../data/CardTypes';

export const ALL_CARDS: Card[] = cardsJson as Card[];

export class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  preload(): void {
    // 카드 배경 (직사각형 그래픽으로 대체 — 별도 이미지 에셋 불필요)
    // 실제 이미지가 있을 때 this.load.image(key, url) 추가
  }

  create(): void {
    this.scene.start('MenuScene');
  }
}
```

- [ ] **Step 2: client/src/scenes/MenuScene.ts 작성**

```typescript
import Phaser from 'phaser';

export class MenuScene extends Phaser.Scene {
  constructor() { super('MenuScene'); }

  create(): void {
    const { width, height } = this.scale;

    this.add.text(width / 2, height / 4, 'YugiohLegend', {
      fontSize: '48px', color: '#e2b96e', fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(width / 2, height / 3, '유희왕 레전드', {
      fontSize: '20px', color: '#aaaaaa',
    }).setOrigin(0.5);

    this.createButton(width / 2, height / 2 - 40, '싱글 플레이 (vs AI)', () => {
      this.scene.start('GameScene', { mode: 'single' });
    });

    this.createButton(width / 2, height / 2 + 30, '덱 빌더', () => {
      this.scene.start('DeckBuilderScene');
    });
  }

  private createButton(x: number, y: number, label: string, onClick: () => void): void {
    const btn = this.add.rectangle(x, y, 280, 50, 0x2d4a7a).setInteractive();
    const txt = this.add.text(x, y, label, { fontSize: '18px', color: '#ffffff' }).setOrigin(0.5);

    btn.on('pointerover', () => btn.setFillStyle(0x3a65a8));
    btn.on('pointerout',  () => btn.setFillStyle(0x2d4a7a));
    btn.on('pointerdown', onClick);
  }
}
```

- [ ] **Step 3: 커밋**

```bash
git add client/src/scenes/BootScene.ts client/src/scenes/MenuScene.ts
git commit -m "feat: add BootScene and MenuScene"
```

---

### Task 9: 게임 컴포넌트 (Field, CardSprite, HandArea, LPDisplay)

**Files:**
- Create: `client/src/components/Field.ts`
- Create: `client/src/components/CardSprite.ts`
- Create: `client/src/components/HandArea.ts`
- Create: `client/src/components/LPDisplay.ts`

- [ ] **Step 1: client/src/components/CardSprite.ts 작성**

```typescript
import Phaser from 'phaser';
import type { Card } from '../data/CardTypes';

export class CardSprite extends Phaser.GameObjects.Container {
  card: Card;
  private bg: Phaser.GameObjects.Rectangle;
  private nameText: Phaser.GameObjects.Text;
  private atkText: Phaser.GameObjects.Text | null = null;

  static readonly W = 90;
  static readonly H = 130;

  constructor(scene: Phaser.Scene, x: number, y: number, card: Card, faceDown = false) {
    super(scene, x, y);
    this.card = card;

    const color = faceDown ? 0x444466 : card.type === 'monster' ? 0x2255aa : card.type === 'spell' ? 0x22aa55 : 0xaa5522;
    this.bg = scene.add.rectangle(0, 0, CardSprite.W, CardSprite.H, color).setStrokeStyle(2, 0xffffff);
    this.add(this.bg);

    if (!faceDown) {
      this.nameText = scene.add.text(0, -30, card.name, {
        fontSize: '11px', color: '#ffffff', wordWrap: { width: CardSprite.W - 8 }, align: 'center',
      }).setOrigin(0.5);
      this.add(this.nameText);

      if (card.type === 'monster' && card.atk !== undefined) {
        this.atkText = scene.add.text(0, 45, `ATK ${card.atk}`, {
          fontSize: '12px', color: '#ffdd88',
        }).setOrigin(0.5);
        this.add(this.atkText);
      }
    } else {
      this.nameText = scene.add.text(0, 0, '?', { fontSize: '28px', color: '#888888' }).setOrigin(0.5);
      this.add(this.nameText);
    }

    scene.add.existing(this);
  }

  highlight(on: boolean): void {
    this.bg.setStrokeStyle(on ? 3 : 2, on ? 0xffff00 : 0xffffff);
  }
}
```

- [ ] **Step 2: client/src/components/Field.ts 작성**

```typescript
import Phaser from 'phaser';
import { CardSprite } from './CardSprite';
import type { LaneState, PlayerIndex } from '../data/CardTypes';

const LANE_W = 120;
const LANE_H = 160;
const LANE_GAP = 20;

export class Field extends Phaser.GameObjects.Container {
  private laneRects: Phaser.GameObjects.Rectangle[] = [];
  private monsterSprites: (CardSprite | null)[] = [null, null, null];
  private trapIndicators: Phaser.GameObjects.Rectangle[] = [];

  constructor(scene: Phaser.Scene, x: number, y: number, public playerIndex: PlayerIndex) {
    super(scene, x, y);
    scene.add.existing(this);
    this.buildLanes(scene);
  }

  private buildLanes(scene: Phaser.Scene): void {
    for (let i = 0; i < 3; i++) {
      const lx = (i - 1) * (LANE_W + LANE_GAP);
      const rect = scene.add.rectangle(lx, 0, LANE_W, LANE_H, 0x112233).setStrokeStyle(1, 0x445566);
      this.add(rect);
      this.laneRects.push(rect);

      // 함정 인디케이터 (작은 주황 사각형)
      const trap = scene.add.rectangle(lx, LANE_H / 2 - 12, 16, 16, 0xaa5522).setVisible(false);
      this.add(trap);
      this.trapIndicators.push(trap);

      const laneLabel = scene.add.text(lx, -LANE_H / 2 + 10, `L${i + 1}`, {
        fontSize: '12px', color: '#556677',
      }).setOrigin(0.5);
      this.add(laneLabel);
    }
  }

  updateLanes(lanes: [LaneState, LaneState, LaneState]): void {
    for (let i = 0; i < 3; i++) {
      const lane = lanes[i];

      // 기존 몬스터 스프라이트 제거
      if (this.monsterSprites[i]) {
        this.monsterSprites[i]!.destroy();
        this.monsterSprites[i] = null;
      }

      if (lane.monster) {
        const lx = (i - 1) * (LANE_W + LANE_GAP);
        const sprite = new CardSprite(this.scene, lx, 0, lane.monster);
        this.add(sprite);
        this.monsterSprites[i] = sprite;
      }

      this.trapIndicators[i].setVisible(lane.trap !== null);
    }
  }

  getLaneWorldX(laneIndex: 0 | 1 | 2): number {
    return this.x + (laneIndex - 1) * (LANE_W + LANE_GAP);
  }

  highlightLane(laneIndex: number, on: boolean): void {
    this.laneRects[laneIndex].setStrokeStyle(on ? 3 : 1, on ? 0xffff00 : 0x445566);
  }
}
```

- [ ] **Step 3: client/src/components/HandArea.ts 작성**

```typescript
import Phaser from 'phaser';
import { CardSprite } from './CardSprite';
import type { Card } from '../data/CardTypes';

export class HandArea extends Phaser.GameObjects.Container {
  private sprites: CardSprite[] = [];
  private onCardSelect: (card: Card, sprite: CardSprite) => void;
  private selectedSprite: CardSprite | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number, y: number,
    onCardSelect: (card: Card, sprite: CardSprite) => void
  ) {
    super(scene, x, y);
    scene.add.existing(this);
    this.onCardSelect = onCardSelect;
  }

  setHand(hand: Card[]): void {
    for (const s of this.sprites) s.destroy();
    this.sprites = [];
    this.selectedSprite = null;

    const total = hand.length;
    const startX = -((total - 1) * (CardSprite.W + 10)) / 2;
    for (let i = 0; i < total; i++) {
      const sx = startX + i * (CardSprite.W + 10);
      const sprite = new CardSprite(this.scene, sx, 0, hand[i]);
      sprite.setInteractive();
      sprite.on('pointerdown', () => this.selectCard(hand[i], sprite));
      sprite.on('pointerover', () => sprite.highlight(true));
      sprite.on('pointerout', () => { if (this.selectedSprite !== sprite) sprite.highlight(false); });
      this.add(sprite);
      this.sprites.push(sprite);
    }
  }

  private selectCard(card: Card, sprite: CardSprite): void {
    if (this.selectedSprite) this.selectedSprite.highlight(false);
    this.selectedSprite = sprite;
    sprite.highlight(true);
    this.onCardSelect(card, sprite);
  }

  deselectAll(): void {
    if (this.selectedSprite) this.selectedSprite.highlight(false);
    this.selectedSprite = null;
  }

  removeCard(cardId: string): void {
    const idx = this.sprites.findIndex(s => s.card.id === cardId);
    if (idx < 0) return;
    this.sprites[idx].destroy();
    this.sprites.splice(idx, 1);
    // 재배치
    const total = this.sprites.length;
    const startX = -((total - 1) * (CardSprite.W + 10)) / 2;
    this.sprites.forEach((s, i) => { s.x = startX + i * (CardSprite.W + 10); });
  }
}
```

- [ ] **Step 4: client/src/components/LPDisplay.ts 작성**

```typescript
import Phaser from 'phaser';

export class LPDisplay extends Phaser.GameObjects.Container {
  private label: Phaser.GameObjects.Text;
  private bar: Phaser.GameObjects.Rectangle;
  private barBg: Phaser.GameObjects.Rectangle;
  private lp = 4000;
  private maxLp = 4000;

  constructor(scene: Phaser.Scene, x: number, y: number, private playerName: string) {
    super(scene, x, y);
    scene.add.existing(this);

    this.barBg = scene.add.rectangle(0, 0, 200, 20, 0x333333).setOrigin(0, 0.5);
    this.bar   = scene.add.rectangle(0, 0, 200, 20, 0x22cc44).setOrigin(0, 0.5);
    this.label = scene.add.text(205, 0, `${playerName}: ${this.lp}`, {
      fontSize: '16px', color: '#ffffff',
    }).setOrigin(0, 0.5);

    this.add([this.barBg, this.bar, this.label]);
  }

  update(lp: number): void {
    this.lp = lp;
    const ratio = Math.max(0, lp / this.maxLp);
    this.bar.setSize(200 * ratio, 20);
    const color = ratio > 0.5 ? 0x22cc44 : ratio > 0.25 ? 0xffaa00 : 0xcc2222;
    this.bar.setFillStyle(color);
    this.label.setText(`${this.playerName}: ${Math.max(0, lp)}`);
  }
}
```

- [ ] **Step 5: 커밋**

```bash
git add client/src/components/
git commit -m "feat: add Field, CardSprite, HandArea, LPDisplay components"
```

---

### Task 10: GameScene — 게임 흐름 및 인터랙션

**Files:**
- Create: `client/src/scenes/GameScene.ts`

GameScene은 SocketManager를 통해 서버 메시지를 받아 화면을 갱신하고,
플레이어의 행동(소환/마법/함정 세트/제출)을 처리한다.

- [ ] **Step 1: client/src/scenes/GameScene.ts 작성**

```typescript
import Phaser from 'phaser';
import { SocketManager } from '../network/SocketManager';
import { Field } from '../components/Field';
import { HandArea } from '../components/HandArea';
import { LPDisplay } from '../components/LPDisplay';
import { CardSprite } from '../components/CardSprite';
import type {
  Card, TurnAction, ServerMessage, BattleEvent, PlayerIndex, LaneIndex,
} from '../data/CardTypes';
import { ALL_CARDS } from './BootScene';

interface GameSceneData {
  mode: 'single' | 'multi';
  deck?: Card[];
}

export class GameScene extends Phaser.Scene {
  private socket!: SocketManager;
  private myIndex: PlayerIndex = 0;
  private turn = 1;

  // 상태
  private myHand: Card[] = [];
  private pendingAction: TurnAction = { spells: [], traps: [] };
  private selectedCard: Card | null = null;
  private submitted = false;

  // UI
  private myField!: Field;
  private opField!: Field;
  private myLP!: LPDisplay;
  private opLP!: LPDisplay;
  private handArea!: HandArea;
  private submitBtn!: Phaser.GameObjects.Rectangle;
  private submitTxt!: Phaser.GameObjects.Text;
  private statusTxt!: Phaser.GameObjects.Text;
  private turnTxt!: Phaser.GameObjects.Text;

  constructor() { super('GameScene'); }

  init(data: GameSceneData): void {
    this.socket = new SocketManager();
    this.pendingAction = { spells: [], traps: [] };
    this.selectedCard = null;
    this.submitted = false;
    this.myHand = [];
  }

  async create(data: GameSceneData): Promise<void> {
    const { width, height } = this.scale;

    // 덱 (기본 덱: 처음 10장)
    const deck: Card[] = data.deck ?? ALL_CARDS.slice(0, 8).concat(ALL_CARDS.slice(0, 2));

    // 필드
    this.opField = new Field(this, width / 2, height * 0.22, 1);
    this.myField = new Field(this, width / 2, height * 0.6, 0);

    // LP 표시
    this.myLP = new LPDisplay(this, 20, height - 40, '나');
    this.opLP = new LPDisplay(this, 20, 30, '상대');

    // 핸드
    this.handArea = new HandArea(this, width / 2, height - 80, (card, _sprite) => {
      this.selectedCard = card;
      this.statusTxt.setText(`선택: ${card.name} — 레인을 클릭하여 배치`);
    });

    // 제출 버튼
    this.submitBtn = this.add.rectangle(width - 80, height - 50, 140, 45, 0x334477).setInteractive();
    this.submitTxt = this.add.text(width - 80, height - 50, '제출', { fontSize: '18px', color: '#ffffff' }).setOrigin(0.5);
    this.submitBtn.on('pointerdown', () => this.submitAction());
    this.submitBtn.on('pointerover', () => this.submitBtn.setFillStyle(0x4466aa));
    this.submitBtn.on('pointerout',  () => this.submitBtn.setFillStyle(0x334477));

    // 상태/턴 텍스트
    this.statusTxt = this.add.text(width / 2, height - 130, '', { fontSize: '14px', color: '#aaaaaa' }).setOrigin(0.5);
    this.turnTxt   = this.add.text(width / 2, 10, '턴 1 / 3', { fontSize: '16px', color: '#ffffff' }).setOrigin(0.5);

    // 레인 클릭 인터랙션
    this.setupLaneInteraction();

    // 서버 연결
    await this.socket.connect();
    this.socket.on((msg) => this.handleServerMessage(msg));
    this.socket.send({ type: 'join_room', mode: data.mode, deck });
  }

  private setupLaneInteraction(): void {
    // 내 필드 레인 클릭
    for (let i = 0; i < 3; i++) {
      const laneIndex = i as LaneIndex;
      const hitArea = this.add.rectangle(
        this.myField.getLaneWorldX(laneIndex), this.myField.y,
        100, 150, 0x000000, 0
      ).setInteractive();
      hitArea.on('pointerdown', () => this.onLaneClick(laneIndex));
    }
  }

  private onLaneClick(laneIndex: LaneIndex): void {
    if (!this.selectedCard || this.submitted) return;
    const card = this.selectedCard;

    if (card.type === 'monster') {
      if (this.pendingAction.summon) {
        this.statusTxt.setText('이번 턴에 이미 소환했습니다.');
        return;
      }
      this.pendingAction.summon = { card, laneIndex };
      this.myHand = this.myHand.filter(c => c.id !== card.id);
      this.handArea.removeCard(card.id);
      this.statusTxt.setText(`${card.name} → 레인 ${laneIndex + 1} 소환 예정`);
    } else if (card.type === 'trap') {
      this.pendingAction.traps.push({ card, laneIndex });
      this.myHand = this.myHand.filter(c => c.id !== card.id);
      this.handArea.removeCard(card.id);
      this.statusTxt.setText(`${card.name} → 레인 ${laneIndex + 1} 세트 예정`);
    }

    this.selectedCard = null;
    this.handArea.deselectAll();
  }

  private handleCardSelect(card: Card): void {
    if (card.type === 'spell') {
      // 마법은 즉시 사용 목록에 추가 (레인 선택 불필요)
      this.pendingAction.spells.push(card);
      this.myHand = this.myHand.filter(c => c.id !== card.id);
      this.handArea.removeCard(card.id);
      this.statusTxt.setText(`${card.name} 사용 예정`);
      this.selectedCard = null;
      this.handArea.deselectAll();
    }
    // monster/trap은 레인 클릭 대기
  }

  private submitAction(): void {
    if (this.submitted) return;
    this.submitted = true;
    this.submitBtn.setFillStyle(0x222222);
    this.submitTxt.setText('대기 중...');
    this.socket.send({ type: 'submit_action', action: this.pendingAction });
    this.statusTxt.setText('상대방을 기다리는 중...');
  }

  private handleServerMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case 'game_start':
        this.myIndex = msg.yourIndex;
        this.myHand = msg.yourHand;
        this.handArea.setHand(this.myHand);
        this.turn = msg.turn;
        this.turnTxt.setText(`턴 ${this.turn} / 3`);
        this.statusTxt.setText('행동을 입력하세요');
        break;

      case 'turn_start':
        this.submitted = false;
        this.pendingAction = { spells: [], traps: [] };
        this.turn = msg.turn;
        this.turnTxt.setText(`턴 ${this.turn} / 3`);
        this.myHand.push(msg.drawnCard);
        this.handArea.setHand(this.myHand);
        this.submitBtn.setFillStyle(0x334477);
        this.submitTxt.setText('제출');
        this.statusTxt.setText('행동을 입력하세요');
        break;

      case 'reveal':
        this.statusTxt.setText('전투 해결 중...');
        break;

      case 'battle_result':
        this.myLP.update(msg.lps[this.myIndex]);
        this.opLP.update(msg.lps[this.myIndex === 0 ? 1 : 0]);
        this.showBattleEvents(msg.events);
        break;

      case 'game_over':
        this.time.delayedCall(1000, () => {
          this.scene.start('ResultScene', {
            winner: msg.winner,
            myIndex: this.myIndex,
            finalLPs: msg.finalLPs,
          });
        });
        break;

      case 'error':
        this.statusTxt.setText(`오류: ${msg.message}`);
        break;
    }
  }

  private showBattleEvents(events: BattleEvent[]): void {
    for (const ev of events) {
      if (ev.type === 'no_action') continue;
      const x = this.myField.getLaneWorldX(ev.laneIndex);
      const y = this.scale.height / 2;
      const txt = ev.type === 'direct_attack'
        ? `다이렉트 -${ev.damage}`
        : ev.negated ? `무효!` : `-${ev.damage}`;
      const color = ev.negated ? '#88ff88' : '#ff4444';
      const label = this.add.text(x, y, txt, { fontSize: '20px', color, fontStyle: 'bold' }).setOrigin(0.5);
      this.tweens.add({
        targets: label,
        y: y - 50,
        alpha: 0,
        duration: 1200,
        onComplete: () => label.destroy(),
      });
    }
  }

  // HandArea의 콜백은 create() 시점에 설정되므로 별도 메서드로 분리
  override update(): void {
    // 마법 카드 자동 선택 처리 (HandArea에서 selectedCard 세팅 후 여기서 처리)
    if (this.selectedCard?.type === 'spell') {
      this.handleCardSelect(this.selectedCard);
    }
  }
}
```

- [ ] **Step 2: HandArea의 onCardSelect 콜백을 GameScene과 연결**

`GameScene.create()` 내 HandArea 생성 부분을 다음과 같이 수정:

```typescript
this.handArea = new HandArea(this, width / 2, height - 80, (card, _sprite) => {
  this.selectedCard = card;
  if (card.type === 'spell') {
    this.handleCardSelect(card);
  } else {
    this.statusTxt.setText(`선택: ${card.name} — 레인을 클릭하여 배치`);
  }
});
```

`update()` 메서드에서 마법 카드 중복 처리 제거:

```typescript
override update(): void { /* nothing needed */ }
```

- [ ] **Step 3: 커밋**

```bash
git add client/src/scenes/GameScene.ts
git commit -m "feat: implement GameScene with field interaction and server message handling"
```

---

### Task 11: DeckBuilderScene

**Files:**
- Create: `client/src/scenes/DeckBuilderScene.ts`

- [ ] **Step 1: client/src/scenes/DeckBuilderScene.ts 작성**

```typescript
import Phaser from 'phaser';
import { CardSprite } from '../components/CardSprite';
import type { Card } from '../data/CardTypes';
import { ALL_CARDS } from './BootScene';

const STORAGE_KEY = 'yugioh_deck';

export class DeckBuilderScene extends Phaser.Scene {
  private deck: Card[] = [];
  private deckTexts: Phaser.GameObjects.Text[] = [];
  private countText!: Phaser.GameObjects.Text;
  private saveBtn!: Phaser.GameObjects.Rectangle;

  constructor() { super('DeckBuilderScene'); }

  create(): void {
    const { width, height } = this.scale;

    // 저장된 덱 불러오기
    const saved = localStorage.getItem(STORAGE_KEY);
    this.deck = saved ? JSON.parse(saved) : [];

    this.add.text(20, 15, '덱 빌더', { fontSize: '28px', color: '#e2b96e' });
    this.add.text(width - 20, 15, '← 메뉴로', { fontSize: '16px', color: '#aaaaaa' })
      .setOrigin(1, 0).setInteractive()
      .on('pointerdown', () => this.scene.start('MenuScene'));

    // 전체 카드 목록 (왼쪽)
    this.add.text(20, 60, '전체 카드', { fontSize: '16px', color: '#aaaaaa' });
    ALL_CARDS.forEach((card, i) => {
      const col = Math.floor(i / 6);
      const row = i % 6;
      const x = 65 + col * 110;
      const y = 90 + row * 150;
      const sprite = new CardSprite(this, x, y, card);
      sprite.setInteractive();
      sprite.on('pointerdown', () => this.addToDeck(card));
      sprite.on('pointerover', () => sprite.highlight(true));
      sprite.on('pointerout',  () => sprite.highlight(false));
    });

    // 덱 목록 (오른쪽)
    this.add.text(width - 220, 60, '내 덱 (8~12장)', { fontSize: '16px', color: '#aaaaaa' });
    this.countText = this.add.text(width - 220, 85, `${this.deck.length}장`, { fontSize: '14px', color: '#ffffff' });

    // 저장 버튼
    this.saveBtn = this.add.rectangle(width - 100, height - 40, 160, 40, 0x225544).setInteractive();
    this.add.text(width - 100, height - 40, '저장 & 게임 시작', { fontSize: '14px', color: '#ffffff' }).setOrigin(0.5);
    this.saveBtn.on('pointerdown', () => this.saveAndStart());

    this.refreshDeckList();
  }

  private addToDeck(card: Card): void {
    const count = this.deck.filter(c => c.id === card.id).length;
    if (count >= 2) { return; } // 같은 카드 최대 2장
    if (this.deck.length >= 12) { return; }
    this.deck.push(card);
    this.refreshDeckList();
  }

  private removeFromDeck(index: number): void {
    this.deck.splice(index, 1);
    this.refreshDeckList();
  }

  private refreshDeckList(): void {
    for (const t of this.deckTexts) t.destroy();
    this.deckTexts = [];

    const { width } = this.scale;
    this.countText.setText(`${this.deck.length}장`);

    this.deck.forEach((card, i) => {
      const t = this.add.text(width - 210, 110 + i * 24, `${i + 1}. ${card.name}`, {
        fontSize: '13px', color: '#cccccc',
      }).setInteractive();
      t.on('pointerdown', () => this.removeFromDeck(i));
      t.on('pointerover', () => t.setColor('#ff8888'));
      t.on('pointerout',  () => t.setColor('#cccccc'));
      this.deckTexts.push(t);
    });

    const valid = this.deck.length >= 8 && this.deck.length <= 12;
    this.saveBtn.setFillStyle(valid ? 0x225544 : 0x443322);
  }

  private saveAndStart(): void {
    if (this.deck.length < 8 || this.deck.length > 12) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.deck));
    this.scene.start('GameScene', { mode: 'single', deck: this.deck });
  }
}
```

- [ ] **Step 2: 커밋**

```bash
git add client/src/scenes/DeckBuilderScene.ts
git commit -m "feat: implement DeckBuilderScene with localStorage persistence"
```

---

### Task 12: ResultScene + 최종 빌드 확인

**Files:**
- Create: `client/src/scenes/ResultScene.ts`

- [ ] **Step 1: client/src/scenes/ResultScene.ts 작성**

```typescript
import Phaser from 'phaser';
import type { PlayerIndex } from '../data/CardTypes';

interface ResultData {
  winner: PlayerIndex | 'draw';
  myIndex: PlayerIndex;
  finalLPs: [number, number];
}

export class ResultScene extends Phaser.Scene {
  constructor() { super('ResultScene'); }

  create(data: ResultData): void {
    const { width, height } = this.scale;
    const { winner, myIndex, finalLPs } = data;

    const isWin  = winner === myIndex;
    const isDraw = winner === 'draw';
    const label  = isDraw ? '무승부!' : isWin ? '승리!' : '패배...';
    const color  = isDraw ? '#aaaaaa' : isWin ? '#ffdd00' : '#ff4444';

    this.add.text(width / 2, height / 3, label, {
      fontSize: '72px', color, fontStyle: 'bold',
    }).setOrigin(0.5);

    const myLp = finalLPs[myIndex];
    const opLp = finalLPs[myIndex === 0 ? 1 : 0];
    this.add.text(width / 2, height / 2, `내 LP: ${myLp}  상대 LP: ${opLp}`, {
      fontSize: '24px', color: '#ffffff',
    }).setOrigin(0.5);

    // 다시하기
    const retry = this.add.text(width / 2, height * 0.65, '다시 하기', {
      fontSize: '22px', color: '#88aaff',
    }).setOrigin(0.5).setInteractive();
    retry.on('pointerdown', () => this.scene.start('GameScene', { mode: 'single' }));
    retry.on('pointerover', () => retry.setColor('#aaccff'));
    retry.on('pointerout',  () => retry.setColor('#88aaff'));

    // 메뉴로
    const menu = this.add.text(width / 2, height * 0.75, '메인 메뉴', {
      fontSize: '22px', color: '#88aaff',
    }).setOrigin(0.5).setInteractive();
    menu.on('pointerdown', () => this.scene.start('MenuScene'));
    menu.on('pointerover', () => menu.setColor('#aaccff'));
    menu.on('pointerout',  () => menu.setColor('#88aaff'));
  }
}
```

- [ ] **Step 2: 전체 서버 테스트 최종 확인**

```bash
cd server && npx vitest run
```

Expected: 전체 테스트 PASS

- [ ] **Step 3: 클라이언트 빌드 확인**

```bash
cd client && npx vite build
```

Expected: dist/ 생성, TypeScript 에러 없음

- [ ] **Step 4: 통합 동작 확인**

터미널 1:
```bash
cd server && npx ts-node-dev --transpile-only src/index.ts
```

터미널 2:
```bash
cd client && npx vite
```

브라우저에서 `http://localhost:3000` 접속 → 메뉴 → 싱글 플레이 → AI 자동 제출 확인

- [ ] **Step 5: 최종 커밋**

```bash
git add client/src/scenes/ResultScene.ts
git commit -m "feat: implement ResultScene and complete v0.1.0 web prototype"
```

---

## 셀프 리뷰 체크

**스펙 커버리지:**
- [x] 3레인, 몬스터 자동 공격, 다이렉트 어택 → BattleResolver
- [x] 함정 자동 발동 (on_attacked, on_direct_attack) → BattleResolver
- [x] 마법 즉발 (heal, power_boost, monster_smash) → GameRoom.applySpell
- [x] 덱 빌딩 8~12장 → GameRoom.addPlayer + DeckBuilderScene
- [x] 3턴 + 파이널 배틀 페이즈 → GameRoom.resolveActions
- [x] 동시 행동 공개 → submit_action + reveal 메시지
- [x] AI (랜덤/그리디) → AIEngine + RoomManager
- [x] LP 4000, 즉시 패배 판정 → GameRoom
- [x] 시작 핸드 4장, 매턴 드로우 1장 → GameRoom
- [x] 결과 화면 → ResultScene
- [x] 덱 빌더 화면 → DeckBuilderScene

**타입 일관성:** `LaneIndex`, `PlayerIndex`, `TurnAction`, `BattleEvent` 모두 shared/types.ts 기준으로 통일됨.

**플레이스홀더:** 없음.
