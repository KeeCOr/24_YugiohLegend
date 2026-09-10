import Phaser from 'phaser';
import { ART_KEYS } from '../art/ProceduralArt';

const ONBOARDING_KEY = 'yugioh_legend_onboarding_v1';

export const MIN_CONTENT_TO_BUTTON_CLEARANCE_PX = 24;
const KOREAN_FONT_FAMILY = "'Noto Sans KR', 'Malgun Gothic', sans-serif";

function computeConfirmButtonY(
  contentBottomY: number,
  panelBottomY: number,
  buttonHeight: number,
  bottomPadding: number,
): number {
  const minAllowedY = contentBottomY + MIN_CONTENT_TO_BUTTON_CLEARANCE_PX + buttonHeight / 2;
  const maxAllowedY = panelBottomY - bottomPadding - buttonHeight / 2;
  return Math.min(minAllowedY, maxAllowedY);
}

export function hasSeenOnboarding(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_KEY) === 'done';
  } catch {
    return false;
  }
}

function markOnboardingSeen(): void {
  try {
    localStorage.setItem(ONBOARDING_KEY, 'done');
  } catch {
    // ignore
  }
}

interface OnboardingSceneData {
  nextScene: string;
  nextData?: object;
}

/**
 * OnboardingScene — full-screen overlay shown exactly once (localStorage guard).
 * Explains TCG phase order, attack/defense positioning, and spell/trap timing.
 * After the user clicks "이해했어요!" it starts the intended next scene.
 */
export class OnboardingScene extends Phaser.Scene {
  private nextScene = 'GameScene';
  private nextData: object = {};

  constructor() { super('OnboardingScene'); }

  init(data: OnboardingSceneData): void {
    this.nextScene = data.nextScene ?? 'GameScene';
    this.nextData = data.nextData ?? {};
  }

  create(): void {
    const { width, height } = this.scale;
    const cx = width / 2;

    // ── Dim overlay ──────────────────────────────────────────────────────────
    this.add.rectangle(cx, height / 2, width, height, 0x000000, 0.74).setDepth(0);

    // ── Modal panel ──────────────────────────────────────────────────────────
    const panelW = 860;
    const panelH = 780;
    const panelY = height / 2;
    const panelTop = panelY - panelH / 2;
    const panelBottom = panelY + panelH / 2;

    // outer border
    this.add.rectangle(cx, panelY, panelW + 8, panelH + 8, 0xd8b56a, 1).setDepth(1);
    // inner background
    const panel = this.add.rectangle(cx, panelY, panelW, panelH, 0x0d1220, 1).setDepth(2);
    // subtle inner frame
    this.add.rectangle(cx, panelY, panelW - 12, panelH - 12, 0x000000, 0)
      .setStrokeStyle(1, 0x8fd8ff, 0.3)
      .setDepth(3);
    void panel; // used for layering reference

    // ── Title ─────────────────────────────────────────────────────────────────
    this.add.text(cx, panelY - panelH / 2 + 44, '듀얼 규칙 안내', {
      fontSize: '32px',
      color: '#f2c86a',
      fontStyle: 'bold',
      fontFamily: KOREAN_FONT_FAMILY,
      stroke: '#07090e',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(10);

    this.add.text(cx, panelY - panelH / 2 + 80, 'YugiohLegend — 3-LANE SUMMON DUEL', {
      fontSize: '13px',
      color: '#8fd8ff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(10);

    // separator line
    this.add.rectangle(cx, panelY - panelH / 2 + 104, panelW - 60, 2, 0xd8b56a, 0.4).setDepth(10);

    // ── Content sections ─────────────────────────────────────────────────────
    const startY = panelTop + 134;
    const sectionGap = 20;

    const sec1Bottom = this.addSection(cx, startY, panelW,
      '① 페이즈 순서',
      [
        '드로우 → 스탠바이 → 메인1 → 배틀 → 메인2 → 엔드',
        '· 드로우: 덱에서 카드 1장 드로우',
        '· 메인1: 몬스터 소환 / 마법·함정 세팅',
        '· 배틀: 공격 선언 → 상대 몬스터 또는 직접 공격',
        '· 메인2: 배틀 후 추가 카드 배치 가능',
        '· 엔드: 턴 종료 선언',
      ],
      0xf2c86a,
    );

    const sec2Y = sec1Bottom + sectionGap;
    const sec2Bottom = this.addSection(cx, sec2Y, panelW,
      '② 공격 표시 / 수비 표시',
      [
        '· 공격 표시 (세로): ATK로 전투. 직접 공격 가능.',
        '· 수비 표시 (가로): DEF로 방어. 직접 공격 불가.',
        '· 메인 페이즈에 표시 변경 가능 (턴당 1회)',
        '· 수비 표시 몬스터를 공격해도 LP 데미지 없음',
        '  (단, 관통 효과 보유 시 초과 데미지)',
      ],
      0x6ebcff,
    );

    const sec3Y = sec2Bottom + sectionGap;
    const sec3Bottom = this.addSection(cx, sec3Y, panelW,
      '③ 마법 / 함정 발동 타이밍',
      [
        '· 일반 마법: 자신 메인 페이즈에만 발동 가능',
        '· 속공 마법: 자신 턴 · 상대 턴 모두 발동 가능',
        '· 함정: 세팅 후 상대 턴부터 발동 가능',
        '  (세팅한 턴에는 발동 불가)',
        '· 페이스 다운 카드: 조건 충족 시 자동 발동',
      ],
      0x88ffb0,
    );

    // ── Confirm button ────────────────────────────────────────────────────────
    const btnHeight = 72;
    const btnY = computeConfirmButtonY(sec3Bottom, panelBottom, btnHeight, 40);
    const btn = this.add.image(cx, btnY, ART_KEYS.buttonPrimary)
      .setDisplaySize(300, btnHeight)
      .setInteractive()
      .setDepth(10);
    const btnTxt = this.add.text(cx, btnY, '이해했어요!', {
      fontSize: '22px',
      color: '#ffffff',
      fontStyle: 'bold',
      fontFamily: KOREAN_FONT_FAMILY,
      stroke: '#07090e',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(11);

    btn.on('pointerover', () => {
      btn.setTint(0xffe29a);
      btnTxt.setColor('#fff3bf');
    });
    btn.on('pointerout', () => {
      btn.clearTint();
      btnTxt.setColor('#ffffff');
    });
    btn.on('pointerdown', () => {
      markOnboardingSeen();
      this.scene.stop('OnboardingScene');
      this.scene.start(this.nextScene, this.nextData);
    });

    // entrance fade-in
    this.cameras.main.setAlpha(0);
    this.tweens.add({
      targets: this.cameras.main,
      alpha: 1,
      duration: 280,
      ease: 'Sine.easeOut',
    });
  }

  // ── Helper: render a titled section with bullet lines ─────────────────────
  private addSection(
    cx: number,
    y: number,
    panelW: number,
    title: string,
    lines: string[],
    accentColor: number,
  ): number {
    const leftX = cx - panelW / 2 + 48;
    const lineH = 23;
    const accentHex = '#' + accentColor.toString(16).padStart(6, '0');

    // accent bar
    this.add.rectangle(leftX - 12, y + 10, 4, 22, accentColor, 1).setDepth(10);

    this.add.text(leftX, y, title, {
      fontSize: '17px',
      color: accentHex,
      fontStyle: 'bold',
      fontFamily: KOREAN_FONT_FAMILY,
    }).setDepth(10);

    for (let i = 0; i < lines.length; i++) {
      this.add.text(leftX + 8, y + 28 + i * lineH, lines[i], {
        fontSize: '14px',
        color: '#d8e7ff',
        fontFamily: KOREAN_FONT_FAMILY,
      }).setDepth(10);
    }

    return y + 28 + lines.length * lineH;
  }
}
