(function (root) {
  'use strict';
  if (root.GameBgm) return;
  let context, gain, buffer, source, loading, starting, url;
  let unlocked = false, muted = false, volume = 0.25;
  try {
    muted = root.localStorage.getItem('game-bgm-muted') === 'true';
    const saved = root.localStorage.getItem('game-bgm-volume');
    if (saved !== null && Number.isFinite(Number(saved))) volume = Math.max(0, Math.min(1, Number(saved)));
  } catch (_) {}
  function audible() { return root.document.visibilityState !== 'hidden'; }
  function applyGain() {
    if (!gain) return;
    const now = context.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setTargetAtTime(muted ? 0 : volume, now, 0.025);
  }
  async function loadBytes() {
    try {
      const response = await root.fetch(url);
      if (!response.ok) throw new Error('BGM HTTP ' + response.status);
      return await response.arrayBuffer();
    } catch (error) {
      // Electron loadFile permits local XHR while Chromium fetch rejects file URLs.
      if (!/^file:/i.test(url) || !root.XMLHttpRequest) throw error;
      return new Promise(function (resolve, reject) {
        const request = new root.XMLHttpRequest();
        request.open('GET', url, true);
        request.responseType = 'arraybuffer';
        request.onload = function () {
          if ((request.status === 0 || request.status === 200) && request.response && request.response.byteLength) resolve(request.response);
          else reject(new Error('BGM local file load failed'));
        };
        request.onerror = function () { reject(new Error('BGM local file unavailable')); };
        request.send();
      });
    }
  }
  async function play() {
    if (!unlocked || !url || !audible()) return;
    if (starting) return starting;
    starting = (async function () {
      const AudioContext = root.AudioContext || root.webkitAudioContext;
      if (!AudioContext) return;
      if (!context) {
        context = new AudioContext();
        gain = context.createGain();
        gain.gain.value = muted ? 0 : volume;
        gain.connect(context.destination);
      }
      // Resume synchronously in the gesture's task, before any fetch awaits.
      await context.resume();
      if (!buffer) {
        if (!loading) loading = loadBytes().then(function (bytes) { return context.decodeAudioData(bytes); }).then(function (decoded) {
          buffer = decoded;
        }).finally(function () { loading = null; });
        await loading;
      }
      if (!audible()) { await context.suspend(); return; }
      // Visibility may have suspended us while the initial decode was pending.
      if (context.state === 'suspended') await context.resume();
      if (!audible()) { await context.suspend(); return; }
      if (!source) {
        source = context.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.connect(gain);
        source.start();
      }
      applyGain();
    })().catch(function (error) {
      // Keep gesture listeners installed so a network or policy failure is retryable.
      if (root.console) root.console.warn('BGM will retry on interaction:', error.message);
    }).finally(function () { starting = null; });
    return starting;
  }
  function gesture(event) {
    if (event && event.isTrusted === false) return;
    unlocked = true; void play();
  }
  root.document.addEventListener('pointerdown', gesture);
  root.document.addEventListener('keydown', gesture);
  root.document.addEventListener('visibilitychange', function () {
    if (!audible()) {
      if (context) void context.suspend().catch(function () {});
    } else void play();
  });
  root.GameBgm = {
    start: function (src) { if (!url) url = src; return play(); },
    setMuted: function (value) {
      muted = Boolean(value); applyGain();
      try { root.localStorage.setItem('game-bgm-muted', String(muted)); } catch (_) {}
      if (!muted) gesture();
    },
    setVolume: function (value) {
      if (!Number.isFinite(Number(value))) return;
      volume = Math.max(0, Math.min(1, Number(value))); applyGain();
      try { root.localStorage.setItem('game-bgm-volume', String(volume)); } catch (_) {}
    },
    getMuted: function () { return muted; },
    getVolume: function () { return volume; }
  };
  const script = root.document.currentScript;
  if (script && script.dataset.bgmSrc) root.GameBgm.start(new URL(script.dataset.bgmSrc, script.src).href);
})(globalThis);
