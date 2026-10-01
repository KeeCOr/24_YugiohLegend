# YugiohLegend Next Improvement Instruction

Date: 2026-06-24

## Goal
Turn the current biggest project issue into a small, executable improvement batch. This file is intentionally scoped so the next worker can start without rereading the whole workspace audit.

## Instructions
1. Resolve the pending LP 0 finish direction before implementing final duel-end presentation.
2. Improve one duel turn flow: draw/choose, summon or action, LP change, and end-turn summary.
3. Keep server/client docs clear about which package script validates each side.

## Completion Rules
- Do not include discarded projects in this batch.
- If gameplay, UI, systems, content, controls, build behavior, or project scope changes, update the project planning document and update log before build/release.
- If runtime source changes, run the nearest available validation and then perform the required build/package step from the project instructions.
- If a folder or asset looks ambiguous, document the decision instead of deleting it.

## 2026-06-30 Completion Note
- Completed as v0.6.0: battle result summaries now cover draw, action, LP change, end-turn, and LP 0 finish direction.
- Next recommended batch: add a visual duel-end overlay that uses the existing LP 0 summary data instead of only the status text.


## 2026-07-01 v0.7.0 Completion Note
- Completed the recommended visual duel-end overlay using existing LP 0 turn summary data.
- Validation: `npm test` passed 7 files / 85 tests; `npm run build:all` and `npm run electron:build` passed.
- Release target: `YugiohLegend_v0.7.0_portable.exe`.

## 2026-07-16 v0.8.0 Completion Note
- Completed Rival Pressure Preview: the shared battle preview layer now produces board-level LP risk and trade summaries.
- The duel HUD shows the board pressure headline above lane badges so players can read danger/advantage faster.
- Next recommended batch: resolve the IP/rebrand risk before adding new card content or expanding public-facing marketing material.


## 2026-09-18 전체 프로젝트 공통 완료 조건

1. **첫 5분 핵심 루프**: 시작 10초 안에 목표가 읽히고, 5분 안에 첫 판단→실행→결과→보상/손실→다음 목표가 한 번 완결되어야 한다.
2. **판단 전후 피드백**: 선택 전 예상 이득·위험·비용, 실행 직후 성공·실패·상태 변화, 결과 화면의 원인·변화·다음 점검 행동을 같은 흐름으로 제공한다. 정답을 자동 추천하지 않는다.
3. **출시 증거 패키지**: 테스트·빌드·첫 5분 수동 확인·대표 실행 화면·로딩/빈 상태/오류/저장 복귀·버전과 검증 날짜를 기록한다. 수행하지 않은 항목은 미검증으로 표시한다.

공통 기준 원문: `C:\Development\_workspace_docs\전체_프로젝트_공통_개선기준_2026-09-18.md`

## 2026-09-18 프로젝트별 고유 개선 3개
> 아래 세 항목은 이 프로젝트의 고유 우선순위다. 구현 후에만 완료로 표시한다.

1. 독자 게임명·카드 용어·룰 정체성으로 IP 의존 축소
2. 카드 선택 전 콤보 결과와 대응 가능성 표시
3. 초보 덱 하나로 소환·공격·역전까지 첫 듀얼 완결

## 2026-09-22 Completion Note

- 카드 배치 직후 대기 소환과 공물 지불을 보드에 투영해 `AFTER COMMIT` 압박 요약과 레인별 결과를 갱신한다.
- 상대의 비공개 대응과 마법/함정 효과는 범위 밖이며, UI가 이 불확실성을 명시한다.
- 목표 화면: `docs/design-references/2026-09-22-after-commit-pressure-preview.png`
- 검증: `npm test` 7파일/91테스트, `npm run build:all`, `npm run electron:build` 통과. 실제 듀얼 수동 확인은 미검증.
- 다음 후보: 마법/함정 중 결정론적으로 계산 가능한 공개 효과만 투영 모델에 추가하고, 첫 듀얼에서 소환→압박 변화→COMMIT 흐름을 수동 검증한다.
