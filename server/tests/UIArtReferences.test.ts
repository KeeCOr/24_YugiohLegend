import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '..', '..');

function readProjectFile(path: string): string {
  return readFileSync(resolve(root, path), 'utf8');
}

describe('UI art references', () => {
  it('defines dedicated textures for buttons, HUD frames, hand rails, and lane frames', () => {
    const art = readProjectFile('client/src/art/ProceduralArt.ts');

    expect(art).toContain("buttonPrimary: 'art_button_primary'");
    expect(art).toContain("hudFrame: 'art_hud_frame'");
    expect(art).toContain("handRail: 'art_hand_rail'");
    expect(art).toContain("laneFrame: 'art_lane_frame'");
    expect(art).toContain('createButtonPrimary(scene)');
    expect(art).toContain('createHudFrame(scene)');
    expect(art).toContain('createHandRail(scene)');
    expect(art).toContain('createLaneFrame(scene)');
  });

  it('applies the dedicated textures to the main battle UI surfaces', () => {
    const gameScene = readProjectFile('client/src/scenes/GameScene.ts');
    const handArea = readProjectFile('client/src/components/HandArea.ts');
    const field = readProjectFile('client/src/components/Field.ts');
    const lpDisplay = readProjectFile('client/src/components/LPDisplay.ts');

    expect(gameScene).toContain('ART_KEYS.buttonPrimary');
    expect(gameScene).toContain('ART_KEYS.hudFrame');
    expect(field).toContain('ART_KEYS.laneFrame');
    expect(lpDisplay).toContain('ART_KEYS.hudFrame');
  });

  it('keeps the battle UX affordances wired into the hand, field, and scene', () => {
    const gameScene = readProjectFile('client/src/scenes/GameScene.ts');
    const handArea = readProjectFile('client/src/components/HandArea.ts');
    const field = readProjectFile('client/src/components/Field.ts');
    const cardSprite = readProjectFile('client/src/components/CardSprite.ts');

    expect(gameScene).toContain('updateLaneGuidanceForSelectedCard');
    expect(gameScene).toContain('getPlayBlockReason');
    expect(gameScene).toContain('setCommitReady');
    expect(handArea).toContain('onCardHover');
    expect(field).toContain('setGuidedLanes');
    expect(field).toContain('setTributeLanes');
    expect(cardSprite).toContain('setBlocked');
  });

  it('shows readable spell effect summaries on cards and hand guidance', () => {
    const gameScene = readProjectFile('client/src/scenes/GameScene.ts');
    const cardSprite = readProjectFile('client/src/components/CardSprite.ts');
    const cardText = readProjectFile('client/src/data/CardText.ts');

    expect(cardText).toContain('getSpellEffectSummary');
    expect(cardText).toContain('NEXT TURN +1 SUMMON');
    expect(cardText).toContain('IF RIVAL SUMMONS 2+: WIPE FIELD');
    expect(cardSprite).toContain('getSpellEffectSummary(card)');
    expect(gameScene).toContain('getSpellEffectSummary(card)');
  });

  it('auto-pays tribute costs when placing a tribute monster', () => {
    const gameScene = readProjectFile('client/src/scenes/GameScene.ts');

    expect(gameScene).toContain('getAutoTributeLaneIndices');
    expect(gameScene).toContain('applyLocalTributePayment');
    expect(gameScene).toContain('getTributeCandidateLaneIndices');
    expect(gameScene).not.toContain('pendingTributeSummon');
    expect(gameScene).not.toContain('beginTributeSelection');
    expect(gameScene).not.toContain('selectTributeLane');
    expect(gameScene).not.toContain('updateTributeCommitState');
  });

  it('keeps opponent pending actions hidden until battle results resolve', () => {
    const gameScene = readProjectFile('client/src/scenes/GameScene.ts');

    expect(gameScene).toContain('keepOpponentLastConfirmedField');
    expect(gameScene).not.toContain('showOpponentPending(msg.opponentAction)');
  });

  it('keeps HUD guide text inside its frame and avoids abandoned mana UI', () => {
    const gameScene = readProjectFile('client/src/scenes/GameScene.ts');
    const field = readProjectFile('client/src/components/Field.ts');

    expect(gameScene).toContain('Select a card,\\nthen choose a lane');
    expect(gameScene).toContain('wordWrap: { width: 244');
    expect(gameScene).not.toContain('MANA');
    expect(gameScene).not.toContain('manaTxt');
    expect(field).toContain('FIELD_CARD_SCALE = 1.0');
  });
});
