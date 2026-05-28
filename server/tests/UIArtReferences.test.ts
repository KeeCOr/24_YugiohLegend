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
    expect(handArea).toContain('ART_KEYS.handRail');
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
    expect(cardSprite).toContain('setBlocked');
  });
});
