import { GameAudioDirector, type CueName } from './GameAudioDirector';

declare global { var __gameAudioRuntime: GameAudioDirector | undefined; }

export function installGameAudioRuntime(basePath: string, bgmFile = 'bgm-loop.ogg'): GameAudioDirector {
  if (globalThis.__gameAudioRuntime) return globalThis.__gameAudioRuntime;
  const url = (name: string): string => `${basePath}/${name}.wav`;
  const director = new GameAudioDirector({
    audioFactory: () => new Audio(),
    bgmUrl: `${basePath}/${bgmFile}`,
    cues: { ui: url('sfx-ui'), action: url('sfx-action'), danger: url('sfx-danger'), transition: url('sfx-transition'), result: url('sfx-result') },
  });
  director.setBgmVolume(0.24);
  director.setSfxVolume(0.62);
  const start = (): void => director.startFromGesture();
  window.addEventListener('pointerdown', start, { once: true });
  window.addEventListener('keydown', start, { once: true });
  window.addEventListener('pointerdown', (event) => {
    const target = event.target instanceof Element ? event.target.closest('button,[data-audio-cue]') : null;
    if (target) director.playCue((target.getAttribute('data-audio-cue') || 'ui') as CueName);
    else if (event.target instanceof HTMLCanvasElement) director.playCue('action');
  });
  window.addEventListener('keydown', (event) => {
    if (!event.repeat && (event.code === 'Space' || event.code === 'Enter')) director.playCue('action');
  });
  window.addEventListener('game-audio', ((event: CustomEvent<{ cue: CueName }>) => {
    if (event.detail?.cue) director.playCue(event.detail.cue);
  }) as EventListener);
  globalThis.__gameAudioRuntime = director;
  return director;
}

export function emitGameAudioCue(cue: CueName): void {
  window.dispatchEvent(new CustomEvent('game-audio', { detail: { cue } }));
}
