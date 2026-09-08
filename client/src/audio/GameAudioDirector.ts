export interface AudioLike {
  src: string;
  loop: boolean;
  volume: number;
  currentTime: number;
  paused: boolean;
  duration?: number;
  play(): Promise<void> | void;
  pause(): void;
  addEventListener?(type: string, listener: () => void, options?: { once?: boolean }): void;
}

export type CueName = 'ui' | 'action' | 'danger' | 'transition' | 'result';
export type CueConfig = string | { src: string; category?: CueName; gain?: number };
export interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void; }
export interface GameAudioSettings { bgmVolume: number; sfxVolume: number; muted: boolean; }
export interface GameAudioDirectorOptions {
  audioFactory: (src?: string) => AudioLike;
  cues?: Partial<Record<CueName, CueConfig>>;
  bgmUrl?: string;
  storage?: StorageLike;
  storageKey?: string;
  maxSfx?: number;
  now?: () => number;
  setTimer?: (callback: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimer?: (id: ReturnType<typeof setTimeout>) => void;
}

export const DUCK_FACTOR = 0.55;
export const MIN_DUCK_MS: Partial<Record<CueName, number>> = { danger: 1000, result: 800 };
const DEFAULT_SETTINGS: GameAudioSettings = { bgmVolume: 0.24, sfxVolume: 0.62, muted: false };
const CUE_GAIN: Record<CueName, number> = { ui: 0.45, action: 1, danger: 1, transition: 0.8, result: 1 };
const clamp01 = (value: number, fallback = 0): number => Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;

export class GameAudioDirector {
  private readonly audioFactory: (src?: string) => AudioLike;
  private readonly cues: Partial<Record<CueName, CueConfig>>;
  private readonly bgmUrl: string;
  private readonly storage?: StorageLike;
  private readonly storageKey: string;
  private readonly maxSfx: number;
  private readonly now: () => number;
  private readonly setTimer: (callback: () => void, ms: number) => ReturnType<typeof setTimeout>;
  private readonly clearTimer: (id: ReturnType<typeof setTimeout>) => void;
  private mixSettings: GameAudioSettings;
  private bgm: AudioLike | null = null;
  private gestureStarted = false;
  private duckDeadline = 0;
  private duckTimer?: ReturnType<typeof setTimeout>;
  private voices: Array<{ audio: AudioLike; gain: number }> = [];
  public lastError: unknown = null;

  constructor(options: GameAudioDirectorOptions) {
    this.audioFactory = options.audioFactory;
    this.cues = options.cues ?? {};
    this.bgmUrl = options.bgmUrl ?? '';
    const globalScope = globalThis as unknown as { localStorage?: StorageLike };
    this.storage = options.storage ?? globalScope.localStorage;
    this.storageKey = options.storageKey ?? 'yugiohLegend.audio.v1';
    this.maxSfx = Math.max(1, options.maxSfx ?? 8);
    this.now = options.now ?? (() => performance.now());
    this.setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimer = options.clearTimer ?? ((id) => clearTimeout(id));
    this.mixSettings = this.loadSettings();
  }

  private loadSettings(): GameAudioSettings {
    try {
      const saved = JSON.parse(this.storage?.getItem(this.storageKey) || 'null') as Partial<GameAudioSettings> | null;
      if (!saved) return { ...DEFAULT_SETTINGS };
      return {
        bgmVolume: clamp01(saved.bgmVolume ?? DEFAULT_SETTINGS.bgmVolume, DEFAULT_SETTINGS.bgmVolume),
        sfxVolume: clamp01(saved.sfxVolume ?? DEFAULT_SETTINGS.sfxVolume, DEFAULT_SETTINGS.sfxVolume),
        muted: saved.muted === true,
      };
    } catch (error) { this.lastError = error; return { ...DEFAULT_SETTINGS }; }
  }

  private persist(): void {
    try { this.storage?.setItem(this.storageKey, JSON.stringify(this.mixSettings)); }
    catch (error) { this.lastError = error; }
  }

  private safePlay(audio: AudioLike, onError?: () => void): void {
    try {
      const result = audio.play();
      if (result && 'catch' in result) result.catch((error) => { this.lastError = error; onError?.(); });
    } catch (error) { this.lastError = error; onError?.(); }
  }

  startFromGesture(): boolean {
    this.gestureStarted = true;
    if (!this.bgmUrl) return false;
    if (!this.bgm) {
      try { this.bgm = this.audioFactory(this.bgmUrl); }
      catch (error) { this.lastError = error; return false; }
      this.bgm.src = this.bgmUrl;
      this.bgm.loop = true;
    }
    this.applyBgmVolume();
    if (this.bgm.paused !== false) this.safePlay(this.bgm);
    return true;
  }

  handleVisibility(hidden: boolean): void {
    if (hidden) {
      try { this.bgm?.pause(); } catch (error) { this.lastError = error; }
    } else if (this.gestureStarted && !this.mixSettings.muted && this.bgm?.paused) {
      this.safePlay(this.bgm);
    }
  }

  playCue(name: CueName): boolean {
    const config = this.cues[name];
    if (!config) return false;
    const cue = typeof config === 'string' ? { src: config, category: name, gain: CUE_GAIN[name] } : {
      src: config.src, category: config.category ?? name, gain: config.gain ?? CUE_GAIN[name],
    };
    if (!cue.src) return false;
    if (this.voices.length >= this.maxSfx) {
      const oldest = this.voices.shift();
      try { oldest?.audio.pause(); if (oldest) oldest.audio.currentTime = 0; } catch (error) { this.lastError = error; }
    }
    let audio: AudioLike;
    try { audio = this.audioFactory(cue.src); }
    catch (error) { this.lastError = error; return false; }
    audio.src = cue.src;
    audio.loop = false;
    audio.volume = this.mixSettings.muted ? 0 : clamp01(this.mixSettings.sfxVolume * cue.gain);
    const voice = { audio, gain: cue.gain };
    this.voices.push(voice);
    const cleanup = (): void => { this.voices = this.voices.filter((entry) => entry !== voice); };
    audio.addEventListener?.('ended', cleanup, { once: true });
    audio.addEventListener?.('error', cleanup, { once: true });
    if (MIN_DUCK_MS[cue.category]) this.startDuck(cue.category, audio);
    this.safePlay(audio, cleanup);
    return true;
  }

  private startDuck(category: CueName, audio: AudioLike): void {
    const minimum = MIN_DUCK_MS[category] ?? 0;
    const extend = (): void => {
      const duration = Number.isFinite(audio.duration) ? (audio.duration ?? 0) * 1000 : 0;
      this.extendDuck(this.now() + Math.max(minimum, duration));
    };
    extend();
    if (!Number.isFinite(audio.duration)) audio.addEventListener?.('loadedmetadata', extend, { once: true });
  }

  private extendDuck(deadline: number): void {
    if (deadline <= this.duckDeadline) return;
    this.duckDeadline = deadline;
    this.applyBgmVolume();
    if (this.duckTimer) this.clearTimer(this.duckTimer);
    this.duckTimer = this.setTimer(() => { this.duckTimer = undefined; this.applyBgmVolume(); }, Math.max(0, deadline - this.now()));
  }

  private applyBgmVolume(): void {
    if (!this.bgm) return;
    const factor = this.now() < this.duckDeadline ? DUCK_FACTOR : 1;
    this.bgm.volume = this.mixSettings.muted ? 0 : this.mixSettings.bgmVolume * factor;
  }

  setBgmVolume(value: number): void { this.mixSettings.bgmVolume = clamp01(value, this.mixSettings.bgmVolume); this.persist(); this.applyBgmVolume(); }
  setSfxVolume(value: number): void { this.mixSettings.sfxVolume = clamp01(value, this.mixSettings.sfxVolume); this.persist(); for (const voice of this.voices) voice.audio.volume = this.mixSettings.muted ? 0 : clamp01(this.mixSettings.sfxVolume * voice.gain); }
  setMuted(value: boolean): void { this.mixSettings.muted = !!value; this.persist(); this.applyBgmVolume(); this.setSfxVolume(this.mixSettings.sfxVolume); }
  stopBgm(): void { try { this.bgm?.pause(); if (this.bgm) this.bgm.currentTime = 0; } catch (error) { this.lastError = error; } }
  get settings(): GameAudioSettings { return { ...this.mixSettings }; }
}
