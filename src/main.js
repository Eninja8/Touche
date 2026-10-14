// Entry point. Connects the pieces and runs the main loop:
//
//   input  ──commands──▶  simulation (src/sim)  ──events──▶  sound, effects, menus
//                               │
//                               └──────── state ──────────▶  renderer (draws it)
//
// The simulation always advances in fixed 1/120 s ticks, no matter the screen's
// frame rate. Slow motion after a touch only changes how fast ticks are fed in.

import {DT} from './sim/constants.js';
import {createGame, newMatch, step} from './sim/game.js';
import {drain} from './sim/events.js';
import {settings} from './ui/settings.js';
import {initInput, sampleCommands, clearKeys, resetMouseAim} from './ui/input.js';
import {initMenus, hud, setLamp, showGameOver, selectedDifficulty, menuEl, pauseEl, overEl, setEl} from './ui/menus.js';
import {unlockAudio, sfx} from './view/audio.js';
import {C} from './view/theme.js';
import {fx, view, puff, sparks, callout, onKill, resetRound, clearDecals, updateFx, updateRealtime} from './view/fx.js';
import {render} from './view/render.js';

// A fresh random seed for each match. (Choosing the seed is the only place
// Math.random touches the simulation; online, the host will pick and share it.)
const newSeed = () => (Math.random() * 4294967296) >>> 0;

let slow = 0; // seconds of KO slow motion left (real time)

const app = {
  S: createGame(newSeed()),
  paused: false,

  startMatch(vsCPU) {
    unlockAudio();
    app.paused = false; setEl.hidden = true; menuEl.hidden = true; pauseEl.hidden = true; overEl.hidden = true;
    resetMouseAim();
    newMatch(app.S, {demo: false, vsCPU, diff: selectedDifficulty(), target: settings.target, seed: newSeed()});
    dispatch(drain());
  },

  showMenu() {
    app.paused = false; menuEl.hidden = false; pauseEl.hidden = true; overEl.hidden = true; setEl.hidden = true; ui.cancelRebind();
    newMatch(app.S, {demo: true, seed: newSeed()});
    dispatch(drain());
    document.getElementById('b2p').focus({preventScroll: true});
  },

  togglePause() {
    if (app.paused) { app.paused = false; pauseEl.hidden = true; }
    else if (app.S.phase !== 'over') { app.paused = true; pauseEl.hidden = false; clearKeys(); document.getElementById('bresume').focus({preventScroll: true}); }
  },
};

// React to what happened inside the simulation this tick.
function dispatch(events) {
  const S = app.S;
  for (const e of events) {
    switch (e.type) {
      case 'sfx': sfx(e.name, S.mode.demo); break;
      case 'puff': puff(e.x, e.y, e.n); break;
      case 'sparks': sparks(e.x, e.y, e.n); break;
      case 'shake': view.shake = Math.max(view.shake, e.amount); break;
      case 'text': fx.push({type: 'text', x: e.x, y: e.y, vx: 0, vy: -60, life: .8, max: .8, text: e.text, color: C[e.color]}); break;
      case 'callout': callout(e.text, C[e.color], e.dur); break;
      case 'lamp': setLamp(e.p, e.on); break;
      case 'kill': onKill(e.victim, e.hit); slow = .8; sfx('kill', S.mode.demo); break;
      case 'roundStart': resetRound(S); slow = 0; setLamp(0, false); setLamp(1, false); hud(S); break;
      case 'score': hud(S); break;
      case 'matchOver': showGameOver(S, e.winner); break;
      case 'matchStart': case 'clearDecals': clearDecals(); break;
    }
  }
}

// One simulation tick plus the cosmetic effects that go with it.
function tick() {
  const S = app.S;
  const moved = step(S, sampleCommands(S));
  dispatch(drain());
  if (moved) updateFx(S, DT);
}

let acc = 0, last = performance.now();
function frame(now) {
  const rdt = Math.min(.05, (now - last) / 1000); last = now;
  if (!app.paused) {
    let ts = 1;
    if (slow > 0) { slow -= rdt; const k = Math.max(0, slow) / .8; ts = 1 - .8 * Math.pow(k, .6); }
    acc += rdt * ts;
    let n = 0; while (acc >= DT && n < 12) { tick(); acc -= DT; n++; } if (n >= 12) acc = 0;
    updateRealtime(rdt);
  }
  render(app.S);
  requestAnimationFrame(frame);
}

const ui = initMenus(app);
initInput(app, ui);
dispatch(drain());
app.showMenu();
if (document.fonts && document.fonts.load) { document.fonts.load('900 92px "Big Shoulders Display"').catch(() => {}); }
requestAnimationFrame(frame);
