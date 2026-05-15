# YugiohLegend 기획서

## 개요
YugiohLegend는 3개 레인, 4턴, 동시 행동 공개를 중심으로 한 간단한 카드 대전 게임이다. 1턴은 공격 없이 카드를 내고 필드를 준비하는 셋업 턴이며, 이후 턴부터 레인이 하나씩 열리고 자동 전투가 해결된다.

## 핵심 규칙
- 시작 LP는 4000이다.
- 시작 손패는 4장이고, 매턴 1장을 드로우한다.
- 각 플레이어는 3개 레인을 가진다.
- 라인은 매턴 하나씩 해금된다.
- 한 턴에 몬스터는 1장까지 소환할 수 있다.
- 마법과 함정은 여러 장 사용할 수 있지만, 각각 해금된 레인에 먼저 배치해야 한다.
- 1턴은 소환, 마법 배치, 함정 세트만 처리하고 공격하지 않는다.
- 2~4턴은 행동 공개 후 자동 전투를 처리한다.
- 4턴 종료 후 마지막 전투를 처리하고 LP가 높은 쪽이 승리한다.

## 라인 해금
| 턴 | 사용 가능 레인 |
| --- | --- |
| 1턴 | 중앙 레인만 |
| 2턴 | 왼쪽 + 중앙 레인 |
| 3턴 | 모든 레인 |
| 4턴 | 모든 레인 |

- 잠긴 레인은 서버에서 소환, 마법 배치, 함정 세트를 무시한다.
- AI도 현재 턴에 열린 레인만 사용한다.
- 클라이언트는 잠긴 레인을 어둡게 표시하고, 클릭 시 상태 문구로 안내한다.

## 지연 마법
- 마법은 손에서 즉시 발동되지 않는다.
- 마법 카드를 선택한 뒤 해금된 내 레인을 클릭해 해당 레인에 배치한다.
- 배치된 마법은 `spellDelayTurns`만큼 카운트다운한 뒤 효과가 발동된다. 현재 기본값은 1턴이다.
- 지연 중인 마법은 레인 상태에 저장되며, UI에는 남은 턴 수가 표시된다.
- 발동 전에 해당 레인이 직접 공격당하면 배치된 마법은 파괴되고 효과가 사라진다.
- 발동한 마법은 레인에서 제거된다.

## 손패 카드 가독성
- 카드 상단에 큰 타입 바를 표시한다.
- 몬스터는 `MONSTER - FREE` 또는 `MONSTER - TRIBUTE`로 일반 소환과 제물 소환을 구분한다.
- 몬스터 역할 배지는 `STRIKER`, `GUARDIAN`, `UTILITY`, `BRUISER`, `ALLY+`처럼 별도 색상으로 표시한다.
- ATK/HP 젬 크기와 숫자 크기를 키워 손패 상태에서도 전투력과 생명력을 읽기 쉽게 한다.
- 손패 패널 높이와 카드 간격을 키워 하단 스탯이 덜 가려지게 한다.
- 마법 카드는 `DELAY nT`, 함정 카드는 `SET TRAP`으로 표시한다.

## 상대 카드 표시
- 서버는 `battle_result` 메시지에 양쪽 플레이어의 최신 레인 상태를 포함한다.
- 클라이언트는 내 레인 상태와 상대 레인 상태를 모두 갱신한다.
- `reveal` 단계에서는 상대가 예약한 소환/마법/함정을 먼저 보여준다.

## 기본 몬스터 역할
- `STRIKER`: 전투력이 높지만 생명력이 낮다. 빠르게 상대 LP나 몬스터를 압박한다.
- `GUARDIAN`: 생명력이 높지만 전투력이 낮다. 레인을 오래 지키는 역할이다.
- `UTILITY`: 전투력과 생명력이 낮지만 존 이동이나 특수효과를 가진다.

## 현재 기본 몬스터 분포
| 카드 | 역할 | ATK | HP | 소환 | 능력 |
| --- | --- | ---: | ---: | --- | --- |
| Bronze Raider | STRIKER | 1900 | 1 | FREE | - |
| Gate Watcher | GUARDIAN | 600 | 5 | FREE | - |
| Swift Cutpurse | UTILITY | 800 | 1 | FREE | Zone Shift |
| Dragon Acolyte | UTILITY | 1100 | 2 | FREE | Draw Spark |
| Ember Magus | UTILITY | 1200 | 2 | FREE | Last Stand |
| Sky Lancer | STRIKER | 1800 | 2 | FREE | Sky Pierce |
| Shield Mason | GUARDIAN | 900 | 4 | FREE | Fortify |

## 제물 소환 몬스터 구성
| 카드 | 제물 역할 | ATK | HP | 제물 | 능력 | 용도 |
| --- | --- | ---: | ---: | ---: | --- | --- |
| Iron Colossus | BRUISER | 2400 | 5 | 1 | Heavy Body | 강한 전투력과 생존력을 모두 가진 중심 몬스터 |
| Radiant Champion | ALLY+ | 1800 | 4 | 1 | Ally +300 | 아군 몬스터를 강화하는 지원형 몬스터 |
| Banner Titan | FIELD+ | 1700 | 5 | 1 | Lane Aura | 특정 필드/레인 가치를 올리는 운영형 몬스터 |
| Nightbound Knight | MOBILE | 2100 | 3 | 1 | Stride | 어느 정도 존 이동이 가능한 기동형 몬스터 |
| Relic Devourer | SCALER | 1600 | 3 | 2 | +Power/Tribute | 바친 제물만큼 강해지는 성장형 몬스터 |

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
  spellDelayTurns?: number;
}

interface SpellSlot {
  card: Card;
  remainingTurns: number;
}

interface LaneState {
  monster: Card | null;
  spell: SpellSlot | null;
  trap: Card | null;
  tempAtkBoost: number;
}
```
