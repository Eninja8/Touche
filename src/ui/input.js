// Keyboard and mouse. Turns what the player is doing into one "command" per
// player per tick, which is the only way input reaches the simulation:
//   {held: {left,right,up,down,raise,lower}, presses: ['attack', ...], aim: {x,y} | null}
// For online play, these small commands are exactly what gets sent over the network.

import {W, H} from '../sim/constants.js';
import {isAI} from '../sim/game.js';
import {settings} from './settings.js';
import {unlockAudio, toggleMute} from '../view/audio.js';

const keys = new Set();                // physical keys currently held down
const presses = [new Set(), new Set()]; // taps waiting for the next tick
let mouse = {x: W / 2, y: H / 2}, mouseAim = false;

// Against the CPU, Red can also use arrows/Space/Shift.
const CPU_EXTRA = {left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp', 'Space'], down: ['ArrowDown'], raise: [], lower: [], attack: [], dash: ['ShiftLeft']};
const GAME_CODES = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Quote', 'Semicolon']);
const HELD = ['left', 'right', 'up', 'down', 'raise', 'lower'], TAPS = ['up', 'down', 'attack', 'dash'];

function bind(S, p) { const b = settings.binds[p], o = {}; for (const k in b) o[k] = [b[k]].concat(p === 0 && S.mode.vsCPU ? CPU_EXTRA[k] : []); return o; }

export function clearKeys() { keys.clear(); }

// Build this tick's commands and use up the waiting taps.
export function sampleCommands(S) {
  const cmds = [];
  for (let p = 0; p < 2; p++) {
    const b = bind(S, p), held = {};
    for (const a of HELD) held[a] = b[a].some(c => keys.has(c));
    const aim = p === 0 && S.mode.vsCPU && !S.mode.demo && mouseAim ? {x: mouse.x, y: mouse.y} : null;
    cmds.push({held, presses: [...presses[p]], aim});
    presses[p].clear();
  }
  return cmds;
}

// app: {S, paused, showMenu, togglePause, startMatch}; ui: hooks from menus.js
export function initInput(app, ui) {
  const cv = document.getElementById('cv');

  addEventListener('keydown', e => {
    unlockAudio();
    const S = app.S;
    if (ui.isRebinding()) { e.preventDefault(); if (!e.repeat) ui.finishRebind(e.code); return; }
    if (ui.settingsOpen()) { if (e.code === 'Escape' && !e.repeat) ui.closeSettings(); return; }
    const playing = !S.mode.demo && !app.paused;
    const bound = Object.values(settings.binds[0]).includes(e.code) || Object.values(settings.binds[1]).includes(e.code);
    if (playing && (GAME_CODES.has(e.code) || bound)) e.preventDefault();
    if (e.repeat) return;
    if (e.code === 'KeyM') { toggleMute(); ui.syncSettingsUI(); return; }
    if (e.code === 'Escape') {
      if (S.phase === 'over' && !S.mode.demo) { app.showMenu(); return; }
      if (!S.mode.demo) app.togglePause();
      return;
    }
    if (e.code === 'Enter' && S.phase === 'over' && !S.mode.demo) { e.preventDefault(); app.startMatch(S.mode.vsCPU); return; }
    keys.add(e.code);
    for (let p = 0; p < 2; p++) {
      if (isAI(S, p)) continue;
      const b = bind(S, p);
      for (const a of TAPS) if (b[a].includes(e.code)) presses[p].add(a);
      if (p === 0 && (e.code === settings.binds[0].raise || e.code === settings.binds[0].lower)) mouseAim = false;
    }
  });
  addEventListener('keyup', e => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());

  // Mouse (only used against the CPU): aim, left-click thrust, right-click dash.
  const toLogical = e => { const r = cv.getBoundingClientRect(); return {x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H}; };
  cv.addEventListener('mousemove', e => { mouse = toLogical(e); if (app.S.mode.vsCPU && !app.S.mode.demo) mouseAim = true; });
  cv.addEventListener('mousedown', e => {
    unlockAudio(); const S = app.S;
    if (S.mode.demo || !S.mode.vsCPU) return;
    mouse = toLogical(e); mouseAim = true;
    if (e.button === 0) presses[0].add('attack');
    if (e.button === 2) presses[0].add('dash');
  });
  cv.addEventListener('contextmenu', e => e.preventDefault());
}

export function resetMouseAim() { mouseAim = false; }
