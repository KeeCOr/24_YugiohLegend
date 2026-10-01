# YugiohLegend 설계 문서

**날짜:** 2026-05-14  
**최신화:** 2026-05-15  
**스택:** Phaser 3 클라이언트 + Node.js WebSocket 서버 + Electron 패키징

## 게임 개요
유희왕을 단순화한 4레인 카드 대전 게임이다. 양쪽 플레이어가 비공개로 행동을 입력하고, 동시에 공개한 뒤 서버가 전투를 해결한다.

## 기본 수치
| 항목 | 값 |
| --- | --- |
| 시작 LP | 4000 |
| 기준 해상도 | 900 x 1600 |
| 총 턴 수 | 4턴 + 파이널 배틀 페이즈 |
| 1턴 규칙 | 공격 없는 셋업 턴 |
| 라인 해금 | 1턴 1라인, 2턴 2라인, 3턴 3라인, 4턴 4라인 |
| 시작 핸드 | 4장 |
| 매턴 드로우 | 1장 |
| 매턴 소환 | 1장 |
| 제물 소환 | `tributeCost`만큼 내 몬스터를 소모 |
| 마법/함정 사용 | 제한 없음, 해금된 레인 배치 필요 |
| 덱 크기 | 8~12장 |
| 같은 카드 최대 | 2장 |

## 라인 해금
- 1턴에는 중앙 레인만 사용할 수 있다.
- 2턴에는 왼쪽과 중앙 레인을 사용할 수 있다.
- 3턴에는 세 레인을 사용할 수 있다.
- 4턴에는 네 레인을 모두 사용할 수 있다.
- 서버는 잠긴 레인에 대한 소환, 마법 배치, 함정 세트를 무시한다.
- AI는 현재 턴에 해금된 레인만 선택한다.
- 클라이언트는 잠긴 레인에 어두운 오버레이와 해금 턴을 표시한다.

## 턴 흐름
```text
[1턴]
1. 중앙 레인에만 행동 입력
2. 몬스터 소환, 마법 배치, 함정 세트
3. 행동 공개
4. 전투 없이 필드/LP 상태만 동기화

[2~4턴]
1. 기존 지연 마법 카운트다운 및 발동
2. 양쪽 행동 공개
3. 해금된 레인에 새 행동 적용
4. 레인별 자동 전투 해결
5. LP 갱신 및 0 이하 즉시 승패 판정
```

## 지연 마법
- 마법은 즉발이 아니라 레인에 먼저 놓인다.
- 상대에게는 마법/함정 예약 카드가 뒷면으로만 보인다.
- `LaneState.spell`은 `{ card, remainingTurns }` 형태로 저장된다.
- 새 행동을 적용하기 전에 기존 마법의 `remainingTurns`를 줄인다.
- 0이 된 마법은 효과를 발동하고 레인에서 제거된다.
- 발동 전에 해당 레인이 직접 공격당하면 마법은 파괴되고 효과는 사라진다.

## 제물 소환
- 제물 몬스터는 `TurnAction.summon.tributeLaneIndices`에 제물 레인을 포함해 제출한다.
- 서버는 제물 수, 목표 레인 해금 여부, 목표 레인 비어 있음 여부를 검증한다.
- 검증 실패 시 소환은 무시된다.
- 검증 성공 시 제물 몬스터를 제거하고 목표 레인에 몬스터를 놓는다.
- 클라이언트와 AI는 낮은 ATK 몬스터부터 자동 제물로 선택한다.

## 손패 가독성
- 카드 상단 타입 바를 크게 표시한다.
- 몬스터는 `MONSTER - FREE`와 `MONSTER - TRIBUTE`로 구분한다.
- 역할 배지는 별도 색상으로 표시한다.
- ATK/HP 젬과 숫자를 키워 손패에서도 전투력과 생명력을 읽을 수 있게 한다.
- 손패 패널 높이와 카드 간격을 늘려 카드 하단 정보가 겹치지 않게 한다.

## 화면 레이아웃
- Phaser 캔버스와 Electron 창은 900 x 1600 세로형을 기준으로 한다.
- 게임 화면은 상대 필드, 전투선, 내 필드, 상태/커밋, 손패가 세로로 쌓이는 구조다.
- 덱 빌더는 카드 아카이브를 3열로 배치하고 현재 덱을 하단 패널에 둔다.

## 메시지
| 방향 | 타입 | 내용 |
| --- | --- | --- |
| C→S | `join_room` | 방 참가 |
| S→C | `game_start` | 초기 핸드, 인덱스, 턴 |
| C→S | `submit_action` | 턴 행동 제출 |
| S→C | `reveal` | 양쪽 행동 공개 |
| S→C | `battle_result` | 전투 결과, LP, 양쪽 레인 상태 |
| S→C | `turn_start` | 새 턴 및 드로우 카드 |
| S→C | `game_over` | 승패 결과 |

## 2026-05-15 Spell Catalog Update
- Spell cards are scoped to ATK boosts, opponent monster removal, and opponent spell/trap removal.
- Current spell effects are `power_boost`, `monster_smash`, and `backrow_break`; `heal_1000` is no longer part of the active catalog.
- `backrow_break` resolves after its delay and removes the opponent spell/trap in the opposite lane first, with a fallback to any opponent spell/trap if that lane is empty.

## 2026-05-15 UI/Line Fix
- Lane unlocks follow visible lane labels: turn 1 unlocks lane 1, turn 2 unlocks lanes 1-2, and turn 3 onward unlocks lanes 1-3.
- Server validation, AI lane choice, client click validation, and locked overlay labels use the same unlock order.
- Phaser uses FIT scaling in the Electron content area so the bottom hand panel remains visible when the window frame reduces available height.

## 2026-05-15 Face-Up/Face-Down Spell Update
- Removed trap as a card type. Cards are now `monster` or `spell`.
- `spellMode: face_up` means visible delayed magic. `spellMode: face_down` means hidden conditional magic.
- `LaneState` uses `spell` for face-up delayed spells and `faceDownSpell` for hidden conditional spells.
- `TurnAction.spells` carries both spell modes; opponent reveal masks only face-down spells.
