// Sound effects, synthesised with the Web Audio API (no sound files needed).
// Browsers only allow audio after the player clicks or presses a key, so
// `unlockAudio()` is called from input handlers.

import {settings, saveSettings} from '../ui/settings.js';

let AC = null, NB = null, MG = null; // audio context, noise buffer, master gain

export function applyVolume() { if (MG) MG.gain.value = settings.muted ? 0 : settings.volume; }
export function toggleMute() { settings.muted = !settings.muted; applyVolume(); saveSettings(); }

export function unlockAudio() {
  if (!AC) {
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      const n = AC.sampleRate * .6; NB = AC.createBuffer(1, n, AC.sampleRate);
      const d = NB.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      MG = AC.createGain(); MG.connect(AC.destination); applyVolume();
    } catch (e) { AC = null; MG = null; return; }
  }
  if (AC.state === 'suspended') AC.resume();
}

function tone(f0, dur, type, vol, f1) {
  const a = AC, t = a.currentTime, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g).connect(MG); o.start(t); o.stop(t + dur + .02);
}
function noise(dur, vol, ft, f0, f1) {
  const a = AC, t = a.currentTime, s = a.createBufferSource(), fl = a.createBiquadFilter(), g = a.createGain();
  s.buffer = NB; fl.type = ft; fl.frequency.setValueAtTime(f0, t); if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  s.connect(fl).connect(g).connect(MG); s.start(t, Math.random() * .3); s.stop(t + dur + .02);
}

const SFX = {
  clash() { tone(1850, .22, 'triangle', .16); tone(2780, .16, 'sine', .09); noise(.05, .18, 'highpass', 3500); },
  parry() { tone(2300, .3, 'triangle', .18); tone(3450, .22, 'sine', .1); noise(.06, .2, 'highpass', 4000); },
  swish() { noise(.13, .13, 'bandpass', 900, 3200); },
  dash() { noise(.1, .09, 'bandpass', 2200, 700); },
  jump() { tone(330, .07, 'square', .025, 520); },
  land() { noise(.07, .12, 'lowpass', 500); },
  slide() { noise(.25, .07, 'lowpass', 1200, 300); },
  kill() { tone(160, .42, 'sine', .32, 40); noise(.2, .28, 'lowpass', 900); tone(980, .12, 'triangle', .08, 500); },
  ready() { tone(523, .12, 'square', .035); },
  allez() { tone(784, .28, 'square', .05); tone(1046, .28, 'square', .03); },
};

// Play a named sound. `quiet` = true during the menu's demo bout (silent unless forced).
export function sfx(name, quiet, force) {
  if (!AC || !MG || (quiet && !force)) return;
  try { SFX[name](); } catch (e) {}
}
