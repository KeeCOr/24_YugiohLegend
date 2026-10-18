const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const code = fs.readFileSync(require('node:path').join(__dirname, "../client/src/audio/bgm-player.js"), 'utf8');
function setup(failures = 0) {
  const listeners = {}, stats = {fetches: 0, starts: 0, contexts: 0, resumes: 0, suspends: 0, gain: 0};
  const document = {visibilityState: 'visible', addEventListener: (name, fn) => listeners[name] = fn};
  class AudioContext {
    constructor() { stats.contexts++; this.currentTime = 0; this.state='suspended'; }
    createGain() { return {gain: {cancelScheduledValues() {}, setTargetAtTime(v) { stats.gain = v; }}, connect() {}}; }
    createBufferSource() { return {connect() {}, start() { assert.equal(this.loop, true); assert.ok(this.buffer); stats.starts++; }}; }
    async resume() { stats.resumes++; this.state='running'; }
    async suspend() { stats.suspends++; this.state='suspended'; }
    async decodeAudioData() { return {duration: 1}; }
  }
  const sandbox = {document, AudioContext, URL, console: {warn() {}}, localStorage: {getItem() {return null;}, setItem() {}}, fetch: async () => {
    stats.fetches++; if (failures-- > 0) throw Error('offline');
    return {ok: true, arrayBuffer: async () => new ArrayBuffer(1)};
  }};
  vm.runInNewContext(code, sandbox);
  return {sandbox, stats, listeners, document};
}
const flush = () => new Promise(resolve => setImmediate(resolve));
test('untrusted synthetic input cannot unlock playback', async () => {
  const s = setup(); s.sandbox.GameBgm.start('track.ogg');
  s.listeners.pointerdown({isTrusted:false}); s.listeners.keydown({isTrusted:false});
  await flush(); assert.equal(s.stats.contexts, 0);
});
test('gesture gates start; concurrent gestures and resumes preserve one source', async () => {
  const s = setup(); await s.sandbox.GameBgm.start('track.ogg');
  assert.equal(s.stats.contexts, 0);
  s.listeners.pointerdown(); s.listeners.keydown(); await flush();
  assert.equal(s.stats.fetches, 1); assert.equal(s.stats.starts, 1);
  s.document.visibilityState = 'hidden'; s.listeners.visibilitychange(); await flush();
  assert.equal(s.stats.suspends, 1);
  s.document.visibilityState = 'visible'; s.listeners.visibilitychange(); s.listeners.pointerdown(); await flush();
  assert.equal(s.stats.starts, 1); assert.equal(s.stats.contexts, 1);
});
test('failed network load retries on a later gesture', async () => {
  const s = setup(1); s.sandbox.GameBgm.start('track.ogg'); s.listeners.pointerdown(); await flush();
  assert.equal(s.stats.starts, 0);
  s.listeners.keydown(); await flush();
  assert.equal(s.stats.fetches, 2); assert.equal(s.stats.starts, 1);
});
test('Electron file URL fetch rejection falls back to arraybuffer XHR with status zero', async () => {
  const s = setup(1);
  s.sandbox.XMLHttpRequest = class {
    open(method, url) { assert.equal(method, 'GET'); assert.equal(url, 'file:///track.ogg'); }
    send() { this.status = 0; this.response = new ArrayBuffer(8); this.onload(); }
  };
  s.sandbox.GameBgm.start('file:///track.ogg'); s.listeners.pointerdown(); await flush();
  assert.equal(s.stats.starts, 1);
});
test('hidden gestures never resume, gain clamps and mute does not recreate source', async () => {
  const s = setup(); s.sandbox.GameBgm.start('track.ogg'); s.document.visibilityState = 'hidden';
  s.listeners.pointerdown(); await flush(); assert.equal(s.stats.contexts, 0);
  s.document.visibilityState = 'visible'; s.listeners.visibilitychange(); await flush();
  s.sandbox.GameBgm.setVolume(99); assert.equal(s.stats.gain, 1);
  s.sandbox.GameBgm.setMuted(true); assert.equal(s.stats.gain, 0);
  s.sandbox.GameBgm.setMuted(false); await flush(); assert.equal(s.stats.starts, 1);
});
test('hide during a pending decode suspends without starting until visible', async () => {
  const s = setup(); let finish;
  s.sandbox.AudioContext.prototype.decodeAudioData = () => new Promise(resolve => finish = resolve);
  s.sandbox.GameBgm.start('track.ogg'); s.listeners.pointerdown(); await flush();
  s.document.visibilityState = 'hidden'; s.listeners.visibilitychange(); finish({duration:1}); await flush();
  assert.equal(s.stats.starts, 0);
  s.document.visibilityState = 'visible'; s.listeners.visibilitychange(); await flush();
  assert.equal(s.stats.starts, 1);
});
test('hide then show before pending decode completes resumes the one owner', async () => {
  const s = setup(); let finish;
  s.sandbox.AudioContext.prototype.decodeAudioData = () => new Promise(resolve => finish = resolve);
  s.sandbox.GameBgm.start('track.ogg'); s.listeners.pointerdown(); await flush();
  s.document.visibilityState='hidden'; s.listeners.visibilitychange();
  s.document.visibilityState='visible'; s.listeners.visibilitychange();
  finish({duration:1}); await flush();
  assert.equal(s.stats.starts,1); assert.equal(s.stats.resumes,2);
});
