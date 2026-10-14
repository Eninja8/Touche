// Entry point. Connects the pieces and runs the main loop:
//
//   input  ──commands──▶  simulation (src/sim)  ──events──▶  sound, effects, menus
//                               │
//                               └──────── state ──────────▶  renderer (draws it)
//
// The simulation always advances in fixed 1/120 s ticks, no matter the screen's
// frame rate. Slow motion after a touch only changes how fast ticks are fed in.
// Online matches are driven by src/net/online.js instead of the local loop below.

import {DT} from './sim/constants.js';
import {getMap} from './sim/maps.js';
import {createGame, newMatch, step} from './sim/game.js';
import {drain} from './sim/events.js';
import {settings} from './ui/settings.js';
import {initInput, sampleCommands, clearKeys, mousePlayer} from './ui/input.js';
import {initMenus, hud, setLamp, showGameOver, setPauseHint, setPauseNote, pauseEl, overEl, setEl} from './ui/menus.js';
import {showScreen, hideScreens} from './ui/screens.js';
import {cross, resetCross, isLocked, requestLock, releaseLock, onLockChange} from './ui/mouse.js';
import {unlockAudio, sfx} from './view/audio.js';
import {C} from './view/theme.js';
import {fx, view, puff, sparks, beatFx, callout, showMapName, onKill, resetRound, clearDecals, updateFx, updateRealtime} from './view/fx.js';
import {render} from './view/render.js';
import * as online from './net/online.js';

// A fresh random seed for each match. (Choosing the seed is the only place
// Math.random touches the simulation; online, the host will pick and share it.)
const newSeed = () => (Math.random() * 4294967296) >>> 0;

let slow = 0; // seconds of KO slow motion left (real time)
let lastMap = null; // map of the last round (blood is cleared when it changes)
let resumeWanted = false; // waiting for the mouse lock before un-pausing

// Does the match need the mouse locked right now?
const wantsLock = () => mousePlayer(app.S) >= 0 && !app.paused && !app.menuOpen && app.S.phase !== 'over' && (!app.S.mode.online || online.inMatch());

// Which player this computer's mouse and keys control (Red locally).
const localIndex = S => S.mode.online ? online.localPlayer() : 0;
const refreshHud = () => hud(app.S, app.S.mode.online ? {me: online.localPlayer(), ping: online.ping()} : null);

const app = {
  S: createGame(newSeed()),
  paused: false,   // local match frozen
  menuOpen: false, // online: pause menu showing (the match keeps running)
  lastMatch: null, // {mode, opts} of the last local match, for Rematch

  // A local match. mode: 'cpu' or 'local'; opts: the lobby's {diff, map, hazards, target}.
  startMatch(mode, opts) {
    unlockAudio();
    app.lastMatch = {mode, opts};
    app.paused = false; hideScreens(); pauseEl.hidden = true; overEl.hidden = true; setEl.hidden = true;
    if (settings.mouseAim) requestLock().catch(() => {});
    newMatch(app.S, {demo: false, vsCPU: mode === 'cpu', diff: opts.diff, target: opts.target, map: opts.map, hazards: opts.hazards, seed: newSeed()});
    dispatch(drain());
  },

  showMenu() {
    online.leave();
    releaseLock(); resumeWanted = false; app.menuOpen = false;
    document.getElementById('netmsg').hidden = true;
    app.paused = false; pauseEl.hidden = true; overEl.hidden = true; ui.cancelRebind();
    showScreen('menu', 'bplay');
    newMatch(app.S, {demo: true, seed: newSeed(), map: 'round'});
    dispatch(drain());
  },

  rematch() { if (app.S.mode.online) online.requestRematch(); else app.startMatch(app.lastMatch.mode, app.lastMatch.opts); },

  pause() {
    if (app.paused || app.menuOpen || app.S.phase === 'over' || app.S.mode.demo) return;
    if (app.S.mode.online) { // can't freeze an online match: just show the menu over it
      if (!online.inMatch()) return;
      app.menuOpen = true; resumeWanted = false; pauseEl.hidden = false; clearKeys(); releaseLock();
      setPauseHint(settings.mouseAim, true);
      document.getElementById('bresume').focus({preventScroll: true});
      return;
    }
    app.paused = true; resumeWanted = false; pauseEl.hidden = false; clearKeys(); releaseLock();
    setPauseHint(settings.mouseAim);
    document.getElementById('bresume').focus({preventScroll: true});
  },

  // With mouse aiming, resuming must re-grab the mouse first; the game
  // continues once the browser confirms the lock (see onLockChange below).
  resume() {
    if (!app.paused && !app.menuOpen) return;
    if (mousePlayer(app.S) < 0) { app.paused = app.menuOpen = false; pauseEl.hidden = true; return; }
    resumeWanted = true;
    requestLock().catch(() => { resumeWanted = false; setPauseNote('Click Resume again.'); });
  },
};

onLockChange(locked => {
  if (locked && resumeWanted) { resumeWanted = false; app.paused = app.menuOpen = false; pauseEl.hidden = true; }
  else if (!locked && wantsLock()) app.pause(); // Esc, alt-tab, clicking away
});

// Safety net: if the mouse should be locked but isn't for a moment
// (e.g. the browser refused the lock), pause so the player can click Resume.
let unlockedSince = null;
function checkLock(now) {
  if (wantsLock() && !isLocked()) { if (unlockedSince === null) unlockedSince = now; else if (now - unlockedSince > 400) { unlockedSince = null; app.pause(); } }
  else unlockedSince = null;
}

// React to what happened inside the simulation this tick.
// isOnline: events from an online tick that a rollback could still undo. The
// KO announcements are skipped (online.js shows them once the touch is
// confirmed) and the body is marked provisional, with no slow motion yet.
function dispatch(events, isOnline) {
  const S = app.S;
  for (const e of events) {
    if (isOnline && e.ko) continue;
    switch (e.type) {
      case 'sfx': sfx(e.name, S.mode.demo); break;
      case 'puff': puff(e.x, e.y, e.n); break;
      case 'sparks': sparks(e.x, e.y, e.n); break;
      case 'beat': beatFx(e.x, e.y); break;
      case 'shake': view.shake = Math.max(view.shake, e.amount); break;
      case 'text': fx.push({type: 'text', x: e.x, y: e.y, vx: 0, vy: -60, life: .8, max: .8, text: e.text, color: C[e.color]}); break;
      case 'callout': callout(e.text, C[e.color], e.dur); break;
      case 'lamp': setLamp(e.p, e.on); break;
      case 'kill': onKill(e.victim, e.hit, isOnline); if (!isOnline) slow = .8; sfx('kill', S.mode.demo); break;
      case 'roundStart':
        if (e.map !== lastMap) { lastMap = e.map; clearDecals(getMap(S)); }
        if (!S.mode.demo) showMapName(e.name);
        resetRound(S); resetCross(S.F[localIndex(S)].face); slow = 0; setLamp(0, false); setLamp(1, false); refreshHud(); break;
      case 'score': refreshHud(); break;
      case 'matchOver': releaseLock(); showGameOver(S, e.winner, S.mode.online ? online.localPlayer() : -1); break;
      case 'matchStart': case 'clearDecals': clearDecals(getMap(S)); lastMap = null; break;
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
  if (online.isActive()) { online.frame(rdt, now); updateRealtime(rdt); }
  else if (!app.paused) {
    let ts = 1;
    if (slow > 0) { slow -= rdt; const k = Math.max(0, slow) / .8; ts = 1 - .8 * Math.pow(k, .6); }
    acc += rdt * ts;
    let n = 0; while (acc >= DT && n < 12) { tick(); acc -= DT; n++; } if (n >= 12) acc = 0;
    updateRealtime(rdt);
  }
  checkLock(now);
  const mp = mousePlayer(app.S);
  render(app.S, mp >= 0 && isLocked() ? {p: mp, x: cross.x, y: cross.y} : null);
  requestAnimationFrame(frame);
}

const ui = initMenus(app);
initInput(app, ui);
online.initOnline({app, dispatch, hud: refreshHud});
dispatch(drain());
app.showMenu();
if (document.fonts && document.fonts.load) { document.fonts.load('900 92px "Big Shoulders Display"').catch(() => {}); }
requestAnimationFrame(frame);
