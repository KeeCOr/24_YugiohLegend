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
    expect(cardText).toContain('IF RIVAL SUMMONS 2+');
    expect(cardText).toContain('WIPE FIELD');
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
  it('stages revealed summons before battle damage and LP updates', () => {
    const gameScene = readProjectFile('client/src/scenes/GameScene.ts');

    expect(gameScene).toContain('beginBattleResolutionSequence');
    expect(gameScene).toContain('preBattleLanes');
    expect(gameScene).toContain('battleSequenceActive');
    expect(gameScene).toContain('deferredTurnStart');
    expect(gameScene).toContain('deferredGameOver');
    expect(gameScene).toContain('BATTLE_EVENT_STAGGER_MS = 780');
    expect(gameScene).toContain('finishBattleResolutionSequence');
    expect(gameScene).toContain('this.myLP.update(result.lps[this.myIndex])');
    expect(gameScene).not.toContain('this.myLP.update(msg.lps[this.myIndex]);');
  });
  it('keeps lethal attacks wired to a dedicated finisher effect', () => {
    const gameScene = readProjectFile('client/src/scenes/GameScene.ts');

    expect(gameScene).toContain('lastBattleHadFinisher');
    expect(gameScene).toContain('playFinisherImpact');
    expect(gameScene).toContain('ev.finisher');
    expect(gameScene).toContain('FINAL BLOW');
    expect(gameScene).toContain('const resultDelay = this.lastBattleHadFinisher ? 2600 : 1500');
  });
  it('separates card effect conditions from outcomes for faster reading', () => {
    const cardSprite = readProjectFile('client/src/components/CardSprite.ts');
    const cardText = readProjectFile('client/src/data/CardText.ts');
    const gameScene = readProjectFile('client/src/scenes/GameScene.ts');

    expect(cardText).toContain('getEffectConditionSummary');
    expect(cardText).toContain('getEffectOutcomeSummary');
    expect(cardText).toContain("case 'on_attacked':");
    expect(cardText).toContain("return 'WHEN ATTACKED'");
    expect(cardText).toContain("case 'negate_attack':");
    expect(cardText).toContain("return 'NEGATE ATTACK'");
    expect(cardSprite).toContain('getEffectConditionSummary(card)');
    expect(cardSprite).toContain('getEffectOutcomeSummary(card)');
    expect(cardSprite).toContain("conditionText.setName('effect-condition')");
    expect(cardSprite).toContain("outcomeText.setName('effect-outcome')");
    expect(gameScene).toContain('getReadableEffectSummary(card)');
  });
  it('keeps unavailable cards readable and fits portrait art in a portrait slot', () => {
    const cardSprite = readProjectFile('client/src/components/CardSprite.ts');

    expect(cardSprite).toContain('CARD_ART_SLOT_W = 76');
    expect(cardSprite).toContain('CARD_ART_SLOT_H = 100');
    expect(cardSprite).toContain('fitArtworkToSlot');
    expect(cardSprite).toContain('setCrop(');
    expect(cardSprite).toContain('Math.max(CARD_ART_SLOT_W / source.width, CARD_ART_SLOT_H / source.height)');
    expect(cardSprite).toContain('setBlocked(on: boolean): void');
    expect(cardSprite).toContain('void on;');
    expect(cardSprite).not.toContain('art.setDisplaySize(108, 84)');
    expect(cardSprite).not.toContain('this.setAlpha(on ? 0.62 : 1)');
    expect(cardSprite).not.toContain('CARD_ART_SLOT_W = 112');
    expect(cardSprite).not.toContain('CARD_ART_SLOT_H = 88');
  });
  it('preloads generated resources through runtime art keys and keeps procedural fallbacks granular', () => {
    const boot = readProjectFile('client/src/scenes/BootScene.ts');
    const art = readProjectFile('client/src/art/ProceduralArt.ts');

    expect(boot).toContain('ART_KEYS');
    expect(boot).toContain('registerProceduralArt(this)');
    expect(boot).toContain("this.load.image(ART_KEYS.cardBack, 'assets/generated/art_cardBack.png')");
    expect(boot).toContain("this.load.image(ART_KEYS.cardMonster, 'assets/generated/art_cardMonster.png')");
    expect(boot).toContain("this.load.image(ART_KEYS.cardSpell, 'assets/generated/art_cardSpell.png')");
    expect(boot).toContain("this.load.image(ART_KEYS.laneEnemy, 'assets/generated/art_laneEnemy.png')");
    expect(boot).toContain("this.load.image(ART_KEYS.buttonPrimary, 'assets/generated/art_buttonPrimary.png')");
    expect(boot).toContain("this.load.image(ART_KEYS.hudFrame, 'assets/generated/art_hudFrame.png')");
    expect(boot).not.toContain("this.load.image('art_cardBack'");
    expect(boot).not.toContain("this.load.image('art_buttonPrimary'");
    expect(art).toContain('ensureTexture(scene, ART_KEYS.cardTrap');
    expect(art).not.toContain('if (scene.textures.exists(ART_KEYS.backdrop)) return;');
  });
  it('renders conditional trigger cards as pink traps instead of green spells', () => {
    const art = readProjectFile('client/src/art/ProceduralArt.ts');
    const cardSprite = readProjectFile('client/src/components/CardSprite.ts');
    const cardText = readProjectFile('client/src/data/CardText.ts');
    const gameScene = readProjectFile('client/src/scenes/GameScene.ts');
    const field = readProjectFile('client/src/components/Field.ts');

    expect(art).toContain("cardTrap: 'art_card_trap'");
    expect(art).toContain('createCardFrame(scene, ART_KEYS.cardTrap, 0x7a1d50, 0xff70bc, 0x2d1024)');
    expect(art).toContain("if (type === 'trap') return ART_KEYS.cardTrap");
    expect(art).toContain("if (type === 'trap') return 0xff70bc");
    expect(cardSprite).toContain("if (card.type === 'trap') return 'TRAP'");
    expect(cardText).toContain("return 'TRAP'");
    expect(gameScene).toContain('card.type === \'trap\'');
    expect(field).toContain('createTrapIndicator');
    expect(field).toContain('0xff70bc');
  });
  it('shows readable turn summary headline and steps after battle resolution', () => {
    const gameScene = readProjectFile('client/src/scenes/GameScene.ts');

    expect(gameScene).toContain('formatTurnSummary(result.turnSummary)');
    expect(gameScene).toContain('turnSummary.headline');
    expect(gameScene).toContain('turnSummary.steps');
  });
  it('shows a visual duel-end overlay from LP 0 turn summary data', () => {
    const gameScene = readProjectFile('client/src/scenes/GameScene.ts');

    expect(gameScene).toContain('showDuelEndSummaryOverlay(result.turnSummary, result.lps)');
    expect(gameScene).toContain('turnSummary.nextTurn !== null');
    expect(gameScene).toContain('P1 LP 0');
    expect(gameScene).toContain('P2 LP 0');
    expect(gameScene).toContain('turnSummary.steps.slice(1)');
    expect(gameScene).toContain('ART_KEYS.hudFrame');
  });

});
