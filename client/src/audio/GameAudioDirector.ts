export interface AudioLike {
  src: string;
  loop: boolean;
  volume: number;
  currentTime: number;
  paused: boolean;
  play(): Promise<void> | void;
  pause(): void;
}

export type CueName = 'ui' | 'action' | 'danger' | 'transition' | 'result';
export interface GameAudioDirectorOptions { audioFactory: () => AudioLike; cues: Partial<Record<CueName, string>>; bgmUrl: string; }
const CUE_NAMES: CueName[] = ['ui', 'action', 'danger', 'transition', 'result'];
const CUE_GAIN: Record<CueName, number> = { ui: 0.45, action: 1, danger: 1.15, transition: 0.8, result: 1.15 };
const clamp01 = (value: number): number => Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;

export class GameAudioDirector {
  private readonly audioFactory: () => AudioLike;
  private readonly cues: Partial<Record<CueName, string>> = {};
  private readonly bgmUrl: string;
  private bgmVolume = 1;
  private sfxVolume = 1;
  private muted = false;
  private bgm: AudioLike | null = null;
  private duckTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(opts: GameAudioDirectorOptions) {
    this.audioFactory = opts.audioFactory;
    for (const name of CUE_NAMES) if (opts.cues[name]) this.cues[name] = opts.cues[name];
    this.bgmUrl = opts.bgmUrl;
  }

  startFromGesture(): void {
    if (this.bgm && !this.bgm.paused) return;
    const bgm = this.audioFactory();
    bgm.src = this.bgmUrl;
    bgm.loop = true;
    bgm.volume = this.muted ? 0 : this.bgmVolume;
    this.bgm = bgm;
    try { const result = bgm.play(); if (result && 'catch' in result) result.catch(() => {}); } catch {}
  }

  playCue(name: CueName): void {
    const src = this.cues[name];
    if (!src) return;
    const sfx = this.audioFactory();
    sfx.src = src;
    sfx.loop = false;
    sfx.volume = this.muted ? 0 : Math.min(1, this.sfxVolume * CUE_GAIN[name]);
    if (this.bgm && (name === 'danger' || name === 'result')) {
      this.bgm.volume = this.muted ? 0 : this.bgmVolume * 0.55;
      clearTimeout(this.duckTimer);
      this.duckTimer = setTimeout(() => this.applyBgmVolume(), 650);
    }
    try { const result = sfx.play(); if (result && 'catch' in result) result.catch(() => {}); } catch {}
  }

  setBgmVolume(value: number): void { this.bgmVolume = clamp01(value); this.applyBgmVolume(); }
  setSfxVolume(value: number): void { this.sfxVolume = clamp01(value); }
  setMuted(value: boolean): void { this.muted = !!value; this.applyBgmVolume(); }
  private applyBgmVolume(): void { if (this.bgm) this.bgm.volume = this.muted ? 0 : this.bgmVolume; }
  stopBgm(): void { if (this.bgm) { this.bgm.pause(); this.bgm.currentTime = 0; } }
  get settings() { return { bgmVolume: this.bgmVolume, sfxVolume: this.sfxVolume, muted: this.muted }; }
}
