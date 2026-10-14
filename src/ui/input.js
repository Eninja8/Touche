// Keyboard and mouse. Turns what the player is doing into one "command" per
// player per tick, which is the only way input reaches the simulation:
//   {held: {left,right,up,down,raise,lower}, presses: ['attack', ...], aim: {x,y} | null}
// `aim` is the mouse crosshair's offset from the shoulder (see mouse.js), or
// null for keyboard aiming. For online play, these small commands are exactly
// what gets sent over the network.

import {isAI} from '../sim/game.js';
import {settings} from './settings.js';
import {unlockAudio, toggleMute} from '../view/audio.js';
import {cross, isLocked, requestLock, lostRecently} from './mouse.js';
import {toggleFullscreen} from './menus.js';

const keys = new Set();                // physical keys currently held down
const presses = [new Set(), new Set()]; // taps waiting for the next tick

// Against the CPU, Red can also use arrows/Space/Shift.
const CPU_EXTRA = {left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp', 'Space'], down: ['ArrowDown'], raise: [], lower: [], attack: [], dash: ['ShiftLeft']};
const GAME_CODES = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Quote', 'Semicolon']);
const HELD = ['left', 'right', 'up', 'down', 'raise', 'lower'], TAPS = ['up', 'down', 'attack', 'dash'];

function bind(S, p) { const b = settings.binds[p], o = {}; for (const k in b) o[k] = [b[k]].concat(p === 0 && S.mode.vsCPU ? CPU_EXTRA[k] : []); return o; }

// Which player (if any) on this computer aims with the mouse. Locally that's Red.
export const mousePlayer = S => !S.mode.demo && settings.mouseAim ? 0 : -1;

export function clearKeys() { keys.clear(); }

// Build this tick's commands and use up the waiting taps.
export function sampleCommands(S) {
  const cmds = [], mp = mousePlayer(S);
  for (let p = 0; p < 2; p++) {
    const b = bind(S, p), held = {};
    for (const a of HELD) held[a] = b[a].some(c => keys.has(c));
    const aim = p === mp ? {x: Math.round(cross.x), y: Math.round(cross.y)} : null;
    cmds.push({held, presses: [...presses[p]], aim});
    presses[p].clear();
  }
  return cmds;
}

// app: {S, paused, showMenu, pause, resume, startMatch}; ui: hooks from menus.js
export function initInput(app, ui) {
  const cv = document.getElementById('cv');

  addEventListener('keydown', e => {
    unlockAudio();
    const S = app.S;
    if (ui.isRebinding()) { e.preventDefault(); if (!e.repeat) ui.finishRebind(e.code); return; }
    if (settings.fullscreenKey && e.code === settings.fullscreenKey) { if (!e.repeat) toggleFullscreen(); e.preventDefault(); return; }
    if (ui.settingsOpen()) { if (e.code === 'Escape' && !e.repeat) ui.closeSettings(); return; }
    const playing = !S.mode.demo && !app.paused;
    const bound = Object.values(settings.binds[0]).includes(e.code) || Object.values(settings.binds[1]).includes(e.code);
    if (playing && (GAME_CODES.has(e.code) || bound)) e.preventDefault();
    if (e.repeat) return;
    if (e.code === 'KeyM') { toggleMute(); ui.syncSettingsUI(); return; }
    if (e.code === 'Escape') {
      if (lostRecently()) return; // this Esc just released the mouse; the game already paused
      if (S.phase === 'over' && !S.mode.demo) { app.showMenu(); return; }
      if (S.mode.demo) return;
      if (app.paused) app.resume(); else app.pause();
      return;
    }
    if (e.code === 'Enter' && S.phase === 'over' && !S.mode.demo) { e.preventDefault(); app.startMatch(S.mode.vsCPU); return; }
    keys.add(e.code);
    for (let p = 0; p < 2; p++) {
      if (isAI(S, p)) continue;
      const b = bind(S, p);
      for (const a of TAPS) if (b[a].includes(e.code)) presses[p].add(a);
    }
  });
  addEventListener('keyup', e => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());

  // Mouse buttons for the mouse-aiming player: left = thrust, right = dash.
  // A click while the mouse isn't locked just grabs it.
  cv.addEventListener('mousedown', e => {
    unlockAudio(); const S = app.S, mp = mousePlayer(S);
    if (mp < 0 || app.paused) return;
    if (!isLocked()) { requestLock().catch(() => {}); return; }
    if (e.button === 0) presses[mp].add('attack');
    if (e.button === 2) presses[mp].add('dash');
  });
  cv.addEventListener('contextmenu', e => e.preventDefault());
}
