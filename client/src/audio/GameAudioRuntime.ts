import { GameAudioDirector, type CueName } from './GameAudioDirector';

declare global { var __gameAudioRuntime: GameAudioDirector | undefined; }

export function installGameAudioRuntime(basePath: string, bgmFile = 'bgm-loop.ogg'): GameAudioDirector {
  if (globalThis.__gameAudioRuntime) return globalThis.__gameAudioRuntime;
  const url = (name: string): string => `${basePath}/${name}.ogg`;
  const director = new GameAudioDirector({
    audioFactory: () => new Audio(),
    bgmUrl: `${basePath}/${bgmFile}`,
    cues: { ui: url('sfx-ui'), action: url('sfx-action'), danger: url('sfx-danger'), transition: url('sfx-transition'), result: url('sfx-result') },
  });
  const start = (): void => director.startFromGesture();
  window.addEventListener('pointerdown', start, { once: true });
  window.addEventListener('keydown', start, { once: true });
  document.addEventListener('visibilitychange', () => director.handleVisibility(document.hidden));
  window.addEventListener('game-audio', ((event: CustomEvent<{ cue: CueName }>) => {
    if (event.detail?.cue) director.playCue(event.detail.cue);
  }) as EventListener);
  globalThis.__gameAudioRuntime = director;
  return director;
}

export function emitGameAudioCue(cue: CueName): void {
  window.dispatchEvent(new CustomEvent('game-audio', { detail: { cue } }));
}
