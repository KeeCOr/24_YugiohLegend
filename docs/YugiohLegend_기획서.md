# YugiohLegend 기획서

## 개요
YugiohLegend는 3개 레인, 4턴, 동시 행동 공개를 중심으로 한 간단한 카드 대전 게임이다. 1턴은 공격 없이 카드를 내고 필드를 준비하는 셋업 턴이며, 2턴부터 양쪽 행동이 공개된 뒤 전투가 자동으로 해결된다.

## 핵심 규칙
- 시작 LP는 4000이다.
- 시작 손패는 4장이고, 매턴 1장을 드로우한다.
- 각 플레이어는 3개 레인을 가진다.
- 한 턴에 몬스터는 1장까지 소환할 수 있다.
- 마법과 함정은 여러 장 사용할 수 있다.
- 1턴은 소환, 세트, 마법 적용만 처리하고 공격하지 않는다.
- 2~4턴은 행동 공개 후 자동 전투를 처리한다.
- 4턴 종료 후 마지막 전투를 처리하고 LP가 높은 쪽이 승리한다.

## 2026-05-15 최신화

### 턴 구조
- 총 턴 수를 3턴에서 4턴으로 변경했다.
- 1턴은 플레이 전용 준비 턴이다. 몬스터를 소환하고 함정을 세트할 수 있지만, 전투 이벤트와 LP 피해는 발생하지 않는다.
- 2턴부터 레인별 자동 공격이 발생한다.
- 화면 상단 턴 표시는 `TURN n / 4`로 표시한다.

### 상대 카드 표시
- 서버는 `battle_result` 메시지에 양쪽 플레이어의 최신 레인 상태를 포함한다.
- 클라이언트는 내 레인 상태와 상대 레인 상태를 모두 갱신한다.
- `reveal` 단계에서는 상대가 예약한 소환/함정을 먼저 보여주어 상대 카드가 보이지 않는 문제를 줄인다.

### 입력 피드백
- 손패 카드를 선택하고 내 레인을 클릭하면 반투명 예약 카드가 즉시 필드에 표시된다.
- 이미 몬스터가 있는 레인에는 추가 몬스터를 예약하지 못한다.
- 이미 함정이 있는 레인에는 추가 함정을 예약하지 못한다.
- 소환 또는 함정 세트 뒤에는 `COMMIT`을 눌러야 하는 상태 문구를 보여준다.

### 카드 표기
- 몬스터 카드는 하스스톤식으로 좌하단에 전투력(ATK), 우하단에 생명력(HP)을 표시한다.
- 몬스터 카드는 `FREE SUMMON` 또는 `TRIBUTE xN`을 표시해 즉시 소환 가능 여부와 제물 필요량을 구분한다.
- 마법 카드는 `CAST`, 함정 카드는 `SET TRAP`으로 표시한다.

### 기본 몬스터 역할
- `STRIKER`: 전투력이 높지만 생명력이 낮다. 빠르게 상대 LP나 몬스터를 압박한다.
- `GUARDIAN`: 생명력이 높지만 전투력이 낮다. 레인을 오래 지키는 역할이다.
- `UTILITY`: 전투력과 생명력이 낮지만 존 이동이나 특수효과를 가진다. 전투력보다 전술 선택지를 제공한다.

### 현재 기본 몬스터 분포
| 카드 | 역할 | ATK | HP | 소환 | 능력 |
| --- | --- | ---: | ---: | --- | --- |
| Bronze Raider | STRIKER | 1900 | 1 | FREE | - |
| Gate Watcher | GUARDIAN | 600 | 5 | FREE | - |
| Swift Cutpurse | UTILITY | 800 | 1 | FREE | Zone Shift |
| Dragon Acolyte | UTILITY | 1100 | 2 | FREE | Draw Spark |
| Ember Magus | UTILITY | 1200 | 2 | FREE | Last Stand |
| Sky Lancer | STRIKER | 1800 | 2 | FREE | Sky Pierce |
| Shield Mason | GUARDIAN | 900 | 4 | FREE | Fortify |

### 제물 소환 몬스터 구성
제물이 필요한 몬스터는 기본 몬스터보다 전술 방향성이 더 뚜렷하다.

| 카드 | 제물 역할 | ATK | HP | 제물 | 능력 | 용도 |
| --- | --- | ---: | ---: | ---: | --- | --- |
| Iron Colossus | BRUISER | 2400 | 5 | 1 | Heavy Body | 강한 전투력과 생존력을 모두 가진 중심 몬스터 |
| Radiant Champion | ALLY+ | 1800 | 4 | 1 | Ally +300 | 아군 몬스터를 강화하는 지원형 몬스터 |
| Banner Titan | FIELD+ | 1700 | 5 | 1 | Lane Aura | 특정 필드/레인 가치를 올리는 운영형 몬스터 |
| Nightbound Knight | MOBILE | 2100 | 3 | 1 | Stride | 어느 정도 존 이동이 가능한 기동형 몬스터 |
| Relic Devourer | SCALER | 1600 | 3 | 2 | +Power/Tribute | 바친 제물만큼 강해지는 성장형 몬스터 |

현재 능력은 카드 표기와 밸런스 설계 기준으로 먼저 반영되어 있다. 실제 능력 자동 처리, 제물 소환 절차, 존 이동 선택 UI는 후속 규칙 업데이트에서 확장한다.

## 카드 데이터 구조
```typescript
interface Card {
  id: string;
  type: CardType;
  name: string;
  atk?: number;
  hp?: number;
  tributeCost?: number;
  monsterRole?: 'striker' | 'guardian' | 'utility';
  tributeRole?: 'bruiser' | 'ally_booster' | 'field_booster' | 'mobile' | 'tribute_scaler';
  monsterAbility?: string;
  abilityText?: string;
  effect?: EffectId;
  trapCondition?: TrapConditionId;
  trapEffect?: TrapEffectId;
}
```
