# YugiohLegend 기획서

## 개요
YugiohLegend는 3개 레인, 3턴, 동시 행동 공개를 중심으로 한 간단한 카드 대전 게임이다. 플레이어는 매턴 손패에서 몬스터, 마법, 함정을 선택해 커밋하고, 양쪽 행동이 공개된 뒤 전투가 자동으로 해결된다.

## 핵심 규칙
- 시작 LP는 4000이다.
- 시작 손패는 4장이고, 매턴 1장을 드로우한다.
- 각 플레이어는 3개 레인을 가진다.
- 한 턴에 몬스터는 1장까지 소환할 수 있다.
- 마법과 함정은 여러 장 사용할 수 있다.
- 3턴 종료 후 마지막 전투를 처리하고 LP가 높은 쪽이 승리한다.

## 2026-05-15 최신화

### 상대 카드 표시
- 서버의 `battle_result` 메시지에 양쪽 플레이어의 최신 레인 상태를 포함한다.
- 클라이언트는 이 레인 상태로 내 필드와 상대 필드를 모두 갱신한다.
- `reveal` 단계에서는 상대가 예약한 소환/함정도 먼저 보여주어 상대 카드가 안 보이는 문제를 줄인다.

### 입력 피드백
- 손패 카드를 선택하고 내 레인을 클릭하면 반투명 예약 카드가 즉시 필드에 표시된다.
- 이미 몬스터가 있는 레인에는 추가 몬스터를 예약하지 못하게 안내한다.
- 이미 함정이 있는 레인에는 추가 함정을 예약하지 못하게 안내한다.
- 소환 또는 함정 세트 후에는 `COMMIT`을 누르라는 상태 문구를 보여준다.

### 카드 표기
- 몬스터 카드는 하스스톤식으로 좌하단에 전투력(ATK), 우하단에 생명력(HP)을 표시한다.
- 몬스터 카드에는 `FREE SUMMON` 또는 `TRIBUTE xN`을 표시해 그냥 소환 가능한지, 제물이 필요한지 알 수 있게 한다.
- 마법 카드는 `CAST`, 함정 카드는 `SET TRAP`을 표시한다.

### 기본 몬스터 역할군
- `STRIKER`: 전투력이 높지만 생명력이 낮다. 빠르게 상대 LP나 몬스터를 압박하는 역할이다.
- `GUARDIAN`: 생명력이 높지만 전투력이 낮다. 레인을 오래 버티는 역할이다.
- `UTILITY`: 전투력과 생명력이 낮지만 존 이동이나 특수효과를 가진다. 전투력보다 전술 선택지를 제공한다.

### 현재 기본 몬스터 분포
| 카드 | 역할 | ATK | HP | 소환 | 능력 표기 |
| --- | --- | ---: | ---: | --- | --- |
| Bronze Raider | STRIKER | 1900 | 1 | FREE | - |
| Nightbound Knight | STRIKER | 2200 | 2 | TRIBUTE x1 | Last Stand |
| Radiant Champion | STRIKER | 2500 | 2 | TRIBUTE x1 | - |
| Iron Colossus | GUARDIAN | 900 | 6 | TRIBUTE x1 | Guard Adjacent |
| Gate Watcher | GUARDIAN | 600 | 5 | FREE | - |
| Swift Cutpurse | UTILITY | 800 | 1 | FREE | Zone Shift |
| Dragon Acolyte | UTILITY | 1100 | 2 | FREE | Draw Spark |
| Ember Magus | UTILITY | 1200 | 2 | FREE | Last Stand |

### 카드 데이터 구조
```typescript
interface Card {
  id: string;
  type: CardType;
  name: string;
  atk?: number;
  hp?: number;
  tributeCost?: number;
  monsterRole?: 'striker' | 'guardian' | 'utility';
  monsterAbility?: string;
  abilityText?: string;
  effect?: EffectId;
  trapCondition?: TrapConditionId;
  trapEffect?: TrapEffectId;
}
```

현재 제물 표기는 정보 표시용이다. 실제 제물 소환 절차는 별도 규칙 확장으로 다룬다.
