# Rival Pressure Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a board-level pressure summary to YugiohLegend's duel HUD.

**Architecture:** Reuse the shared battle-preview module as the single source of combat preview math. The client reads this summary and renders a compact HUD line above existing lane preview badges.

**Tech Stack:** TypeScript, Vitest, Phaser 3, Vite, Electron.

## Global Constraints
- Keep behavior in the authoritative shared/server TypeScript path.
- Do not change combat resolution rules in this batch.
- Update docs and package version to v0.8.0.
- Validate with server tests and client/build packaging.

---

### Task 1: Board Pressure Summary

**Files:**
- Modify: `shared/battlePreview.ts`
- Test: `server/tests/BattlePreview.test.ts`

**Interfaces:**
- Produces: `getBoardBattlePressure(playerLanes: LaneState[], opponentLanes: LaneState[]): BoardBattlePressure`

- [x] Write failing tests for rival LP pressure, player LP pressure, and quiet boards.
- [x] Verify RED with `npm exec vitest run server/tests/BattlePreview.test.ts`.
- [x] Implement `BoardBattlePressure` aggregation in `shared/battlePreview.ts`.
- [x] Verify GREEN with `npm exec vitest run server/tests/BattlePreview.test.ts`.

### Task 2: Phaser HUD Summary

**Files:**
- Modify: `client/src/scenes/GameScene.ts`

**Interfaces:**
- Consumes: `getBoardBattlePressure` and `BattlePreviewTone`.

- [x] Add a stable HUD text line above battle preview badges.
- [x] Update it whenever `updateBattlePreviews()` runs.
- [x] Match tone colors to existing lane preview badge palette.
- [x] Validate client TypeScript/Vite build with `npm run build:client`.

### Task 3: Release Freshness

**Files:**
- Modify: `package.json`, `package-lock.json`, project docs.

- [x] Bump root package version to `0.8.0`.
- [x] Update GDD/update notes/next-improvement notes.
- [x] Run final `npm test`, `npm run build:all`, and `npm run electron:build`.
- [x] Copy the portable executable to root and Drive when packaging succeeds.
- [x] Commit and push scoped source/docs changes.
