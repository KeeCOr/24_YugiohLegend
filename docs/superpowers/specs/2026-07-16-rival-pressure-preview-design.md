# YugiohLegend Rival Pressure Preview Design

Date: 2026-07-16 KST
Version Target: v0.8.0

## Goal
Make the duel board feel denser by summarizing immediate lane pressure before battle resolution, so players can understand whether they are threatening rival LP, under rival pressure, or in a quiet board state.

## Recommended Approach
Extend the existing `shared/battlePreview.ts` lane-preview model with a board-level pressure summary. This keeps the behavior deterministic, testable on the server side, and reusable by the Phaser HUD without creating a second combat rules path.

## Alternatives Considered
1. Client-only text: fastest, but risks drifting from battle math.
2. New AI behavior: more game impact, but too broad for this batch.
3. Shared board pressure summary: selected because it reuses current battle preview math and has a small testing surface.

## Design
- Add `getBoardBattlePressure(playerLanes, opponentLanes)` to aggregate LP risk, winning trades, losing trades, quiet lanes, tone, headline, and detail.
- Keep `getLaneBattlePreview` unchanged for existing badges.
- Add a HUD text line above lane badges in `GameScene` that displays the board pressure headline and detail.
- Use tone colors already consistent with lane badges: green for advantage, red for danger, blue for neutral.

## Testing
- Add Vitest coverage for rival LP pressure, player LP pressure, and quiet boards.
- Run `npm test`, `npm run build:client`, `npm run build:all`, and package through `npm run electron:build` after docs/version updates.
