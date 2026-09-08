import { describe, expect, it, vi } from 'vitest';
import { GameAudioDirector, type AudioLike } from '../../client/src/audio/GameAudioDirector';

const factory = (created: AudioLike[]) => () => {
  const audio: AudioLike = { src: '', loop: false, volume: 0, currentTime: 0, paused: true, play: vi.fn(function (this: AudioLike) { this.paused = false; }), pause: vi.fn() };
  created.push(audio); return audio;
};

describe('client audio director', () => {
  it('defers and de-duplicates looping BGM start', () => { const made: AudioLike[] = []; const d = new GameAudioDirector({ audioFactory: factory(made), bgmUrl: '/b', cues: {} }); expect(made).toHaveLength(0); d.startFromGesture(); d.startFromGesture(); expect(made).toHaveLength(1); expect(made[0].loop).toBe(true); });
  it('separates BGM and SFX volume', () => { const made: AudioLike[] = []; const d = new GameAudioDirector({ audioFactory: factory(made), bgmUrl: '/b', cues: { action: '/a' } }); d.setBgmVolume(.2); d.setSfxVolume(.7); d.startFromGesture(); d.playCue('action'); expect(made[0].volume).toBe(.2); expect(made[1].volume).toBe(.7); });
  it('clamps and mutes safely', () => { const made: AudioLike[] = []; const d = new GameAudioDirector({ audioFactory: factory(made), bgmUrl: '/b', cues: {} }); d.setBgmVolume(9); d.setSfxVolume(-1); d.startFromGesture(); d.setMuted(true); expect(d.settings).toEqual({ bgmVolume: 1, sfxVolume: 0, muted: true }); expect(made[0].volume).toBe(0); });
});
