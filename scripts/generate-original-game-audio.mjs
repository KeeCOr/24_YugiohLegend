#!/usr/bin/env node
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const SAMPLE_RATE = 44100;

function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeNoiseArray(len, seed) {
  const rng = mulberry32(seed);
  const arr = new Float64Array(len);
  for (let i = 0; i < len; i++) arr[i] = rng() * 2 - 1;
  return arr;
}

function floatTo16BitPCM(samples) {
  const buf = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    let s = Math.max(-1, Math.min(1, samples[i]));
    s = s < 0 ? s * 0x8000 : s * 0x7fff;
    buf.writeInt16LE(Math.round(s), i * 2);
  }
  return buf;
}

function writeWav(filePath, samples, sampleRate = SAMPLE_RATE) {
  const dataBuf = floatTo16BitPCM(samples);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + dataBuf.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(dataBuf.length, 40);
  writeFileSync(filePath, Buffer.concat([header, dataBuf]));
}

function softClip(x) { return Math.tanh(x * 1.5) / Math.tanh(1.5); }
function adsr(t, dur, a, d, r, sustainLevel) {
  if (t < 0 || t > dur) return 0;
  if (t < a) return t / a;
  const afterA = t - a;
  if (afterA < d) return 1 - (1 - sustainLevel) * (afterA / d);
  const releaseStart = dur - r;
  if (t < releaseStart) return sustainLevel;
  return sustainLevel * Math.max(0, 1 - (t - releaseStart) / r);
}
function freqAt(root, semitone) { return root * Math.pow(2, semitone / 12); }
function additive(t, freq, harmonics) {
  let s = 0;
  for (const [ratio, amp] of harmonics) s += amp * Math.sin(2 * Math.PI * freq * ratio * t);
  return s;
}
function applyEdgeFade(samples, fadeSamples) {
  const n = Math.min(fadeSamples, Math.floor(samples.length / 2));
  for (let i = 0; i < n; i++) {
    const g = i / n;
    samples[i] *= g;
    samples[samples.length - 1 - i] *= g;
  }
}

const PROFILES = {
  tactical: { root: 110, scale: [0,2,3,5,7,8,10], leadHarmonics: [[1,.6],[2,.25],[3,.1]], bassHarmonics: [[1,.8],[2,.2]], padHarmonics: [[1,.4],[2,.15],[3,.05]], density: .35, hatDensity: .5, kickDensity: .7 },
  fantasy: { root: 293.66, scale: [0,2,4,6,7,9,11], leadHarmonics: [[1,.5],[2,.3],[3,.15],[4,.05]], bassHarmonics: [[1,.7],[2,.2]], padHarmonics: [[1,.5],[2,.25],[3,.1],[4,.05]], density: .6, hatDensity: .25, kickDensity: .4 },
  action: { root: 82.41, scale: [0,1,3,5,7,8,10], leadHarmonics: [[1,.5],[2,.35],[3,.2],[4,.1],[5,.05]], bassHarmonics: [[1,.75],[2,.3],[3,.1]], padHarmonics: [[1,.35],[2,.2],[3,.1]], density: .75, hatDensity: .8, kickDensity: .9 },
  rhythm: { root: 130.81, scale: [0,2,4,7,9], leadHarmonics: [[1,.55],[2,.3],[3,.15]], bassHarmonics: [[1,.8],[2,.25]], padHarmonics: [[1,.4],[2,.2]], density: .85, hatDensity: .9, kickDensity: .85 },
  horror: { root: 65.41, scale: [0,1,3,6,7,10], leadHarmonics: [[1,.4],[2,.4],[3,.25],[5,.1]], bassHarmonics: [[1,.6],[1.5,.2]], padHarmonics: [[1,.5],[2,.3],[3,.15]], density: .2, hatDensity: .15, kickDensity: .25 },
  sports: { root: 196, scale: [0,2,4,5,7,9,11], leadHarmonics: [[1,.5],[2,.3],[3,.2],[4,.1]], bassHarmonics: [[1,.75],[2,.25]], padHarmonics: [[1,.4],[2,.2],[3,.1]], density: .7, hatDensity: .7, kickDensity: .75 },
};

function generateBgm(profileName, bpm, seed) {
  const cfg = PROFILES[profileName];
  const beatDur = 60 / bpm, barDur = beatDur * 4, totalBars = 8;
  const totalDur = barDur * totalBars, totalSamples = Math.round(totalDur * SAMPLE_RATE);
  const stepsPerBar = 16, stepDur = barDur / stepsPerBar, scaleLen = cfg.scale.length;
  const out = new Float64Array(totalSamples), rng = mulberry32(seed);
  const noise = makeNoiseArray(totalSamples, seed ^ 0x9e3779b9), bars = [];
  for (let b = 0; b < totalBars; b++) {
    const steps = [];
    for (let s = 0; s < stepsPerBar; s++) steps.push({
      kick: s % 4 === 0 ? rng() < cfg.kickDensity : rng() < cfg.kickDensity * .15,
      hat: rng() < cfg.hatDensity && s % 2 === 1,
      leadOn: rng() < cfg.density,
      degree: Math.floor(rng() * scaleLen),
      octave: rng() < .3 ? 12 : 0,
    });
    bars.push(steps);
  }
  for (let b = 0; b < totalBars; b++) {
    const semis = b % 2 === 0 ? 0 : cfg.scale[Math.min(4, scaleLen - 1)];
    const freq = freqAt(cfg.root / 2, semis), start = b * barDur, dur = barDur * .95;
    const startSample = Math.round(start * SAMPLE_RATE), endSample = Math.min(totalSamples, Math.round((start + dur) * SAMPLE_RATE));
    for (let i = startSample; i < endSample; i++) {
      const t = (i - startSample) / SAMPLE_RATE;
      out[i] += .3 * adsr(t, dur, .01, .1, .3, .7) * additive(t, freq, cfg.bassHarmonics);
    }
  }
  for (let b = 0; b < totalBars; b++) {
    const start = b * barDur, dur = barDur * .98, startSample = Math.round(start * SAMPLE_RATE), endSample = Math.min(totalSamples, Math.round((start + dur) * SAMPLE_RATE));
    for (let i = startSample; i < endSample; i++) {
      const t = (i - startSample) / SAMPLE_RATE;
      let s = 0;
      for (const deg of [0, 2 % scaleLen, 4 % scaleLen]) s += additive(t, freqAt(cfg.root, cfg.scale[deg % scaleLen]), cfg.padHarmonics) / 3;
      out[i] += .15 * adsr(t, dur, .3, .3, .5, .6) * s;
    }
  }
  for (let b = 0; b < totalBars; b++) for (let s = 0; s < stepsPerBar; s++) {
    const st = bars[b][s], stepStart = b * barDur + s * stepDur, startSample = Math.round(stepStart * SAMPLE_RATE);
    if (st.leadOn) {
      const freq = freqAt(cfg.root * 2, cfg.scale[st.degree] + st.octave), dur = stepDur * .9;
      const endSample = Math.min(totalSamples, Math.round((stepStart + dur) * SAMPLE_RATE));
      for (let i = startSample; i < endSample; i++) {
        const t = (i - startSample) / SAMPLE_RATE;
        out[i] += .2 * adsr(t, dur, .005, .05, .15, .4) * additive(t, freq, cfg.leadHarmonics);
      }
    }
    if (st.kick) {
      const dur = .18, endSample = Math.min(totalSamples, Math.round((stepStart + dur) * SAMPLE_RATE));
      for (let i = startSample; i < endSample; i++) {
        const t = (i - startSample) / SAMPLE_RATE;
        out[i] += .5 * Math.exp(-t * 25) * Math.sin(2 * Math.PI * (90 * Math.exp(-t * 18) + 40) * t);
      }
    }
    if (st.hat) {
      const dur = .06, endSample = Math.min(totalSamples, Math.round((stepStart + dur) * SAMPLE_RATE));
      for (let i = startSample; i < endSample; i++) out[i] += .15 * Math.exp(-((i - startSample) / SAMPLE_RATE) * 90) * noise[i];
    }
  }
  for (let i = 0; i < totalSamples; i++) out[i] = softClip(out[i]);
  applyEdgeFade(out, Math.round(SAMPLE_RATE * .005));
  return out;
}

function generateUi(profileName) {
  const cfg = PROFILES[profileName], dur = .15, n = Math.round(dur * SAMPLE_RATE), out = new Float64Array(n);
  const freq = freqAt(cfg.root * 4, cfg.scale[Math.min(2, cfg.scale.length - 1)]);
  for (let i = 0; i < n; i++) { const t = i / SAMPLE_RATE; out[i] = softClip(.5 * adsr(t,dur,.005,.03,.08,.3) * additive(t,freq,[[1,.7],[2,.3]])); }
  applyEdgeFade(out, Math.round(SAMPLE_RATE * .003)); return out;
}
function generateAction(profileName, seed) {
  const cfg=PROFILES[profileName], dur=.25, n=Math.round(dur*SAMPLE_RATE), out=new Float64Array(n), noise=makeNoiseArray(n,seed^0x1234abcd), freq=cfg.root*2;
  for(let i=0;i<n;i++){const t=i/SAMPLE_RATE;out[i]=softClip(.5*additive(t,freq,cfg.bassHarmonics)*Math.exp(-t*12)+.4*Math.exp(-t*30)*noise[i]);}
  applyEdgeFade(out,Math.round(SAMPLE_RATE*.003));return out;
}
function generateDanger(profileName) {
  const cfg=PROFILES[profileName],dur=1,n=Math.round(dur*SAMPLE_RATE),out=new Float64Array(n),f1=cfg.root,f2=f1*Math.pow(2,.5);
  for(let i=0;i<n;i++){const t=i/SAMPLE_RATE,pulse=.5+.5*Math.sin(2*Math.PI*5*t),env=adsr(t,dur,.02,.1,.15,.8),s=(additive(t,f1,cfg.leadHarmonics)+additive(t,f2,cfg.leadHarmonics))*.5;out[i]=softClip(.5*env*pulse*s);}
  applyEdgeFade(out,Math.round(SAMPLE_RATE*.005));return out;
}
function generateTransition(profileName, seed) {
  const cfg=PROFILES[profileName],dur=.6,n=Math.round(dur*SAMPLE_RATE),out=new Float64Array(n),noise=makeNoiseArray(n,seed^0x5678dcba),fStart=cfg.root,fEnd=cfg.root*2;let phase=0;
  for(let i=0;i<n;i++){const t=i/SAMPLE_RATE,f=fStart+(fEnd-fStart)*(t/dur);phase+=2*Math.PI*f/SAMPLE_RATE;const env=adsr(t,dur,.05,.1,.2,.6);out[i]=softClip(.5*env*(Math.sin(phase)*.6+Math.sin(phase*2)*.2)+.05*env*noise[i]);}
  applyEdgeFade(out,Math.round(SAMPLE_RATE*.005));return out;
}
function generateResult(profileName) {
  const cfg=PROFILES[profileName],noteDur=.15,dur=noteDur*4+.2,n=Math.round(dur*SAMPLE_RATE),out=new Float64Array(n),degrees=[0,2,4,6].map(d=>cfg.scale[d%cfg.scale.length]);
  for(let k=0;k<4;k++){const freq=freqAt(cfg.root*2,degrees[k]+(k===3?12:0)),start=k*noteDur,ndur=noteDur*1.4,startSample=Math.round(start*SAMPLE_RATE),endSample=Math.min(n,Math.round((start+ndur)*SAMPLE_RATE));for(let i=startSample;i<endSample;i++){const t=(i-startSample)/SAMPLE_RATE;out[i]+=.4*adsr(t,ndur,.01,.05,.3,.5)*additive(t,freq,cfg.leadHarmonics);}}
  for(let i=0;i<n;i++)out[i]=softClip(out[i]);applyEdgeFade(out,Math.round(SAMPLE_RATE*.005));return out;
}

const [outputDir, profile, bpmStr] = process.argv.slice(2);
if (!outputDir || !PROFILES[profile] || !Number.isFinite(Number(bpmStr)) || Number(bpmStr) <= 0) {
  console.error('Usage: node generate-original-game-audio.mjs <outputDir> <profile> <bpm>');
  console.error(`Profiles: ${Object.keys(PROFILES).join(', ')}`);
  process.exit(1);
}
if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });
const bpm=Number(bpmStr), seed=hashSeed(`${profile}:${bpm}`);
writeWav(join(outputDir,'bgm-loop.wav'),generateBgm(profile,bpm,seed));
writeWav(join(outputDir,'sfx-ui.wav'),generateUi(profile));
writeWav(join(outputDir,'sfx-action.wav'),generateAction(profile,seed^2));
writeWav(join(outputDir,'sfx-danger.wav'),generateDanger(profile));
writeWav(join(outputDir,'sfx-transition.wav'),generateTransition(profile,seed^4));
writeWav(join(outputDir,'sfx-result.wav'),generateResult(profile));
console.log(`Generated ${profile} audio at ${bpm} BPM in ${outputDir}`);
