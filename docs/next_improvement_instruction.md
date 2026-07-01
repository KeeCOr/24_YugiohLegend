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
