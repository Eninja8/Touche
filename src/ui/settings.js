// Player preferences (key bindings, volume, effects, last lobby choices), saved
// in the browser's localStorage so they survive a page reload.

import {MAPS} from '../sim/maps.js';

export const DEFAULT_BINDS = [
  {left: 'KeyA', right: 'KeyD', up: 'KeyW', down: 'KeyS', raise: 'KeyQ', lower: 'KeyE', attack: 'KeyF', dash: 'KeyG', throw: 'KeyR'},
  {left: 'KeyJ', right: 'KeyL', up: 'KeyI', down: 'KeyK', raise: 'KeyU', lower: 'KeyO', attack: 'Semicolon', dash: 'Quote', throw: 'KeyP'},
];
export const ACTIONS = [['left', 'Move left'], ['right', 'Move right'], ['up', 'Jump · climb'], ['down', 'Crouch · slide · drop'], ['raise', 'Raise blade'], ['lower', 'Lower blade'], ['attack', 'Thrust'], ['dash', 'Dash'], ['throw', 'Throw knife']];

// Last-used lobby options for each mode (see lobby.js).
// (map: 'round' = a random map each round, 'match' = one random map per match, or a map's key)
const DEFAULT_LOBBY = {cpu: {diff: 'normal', map: 'round', hazards: true, powerups: true, target: 5}, local: {map: 'round', hazards: true, powerups: true, target: 5}, online: {map: 'round', hazards: true, powerups: true, target: 5}};

// mouseAim: Red aims with the mouse (online: you aim with yours). sens: mouse sensitivity multiplier.
// aimIndicator: 'arrow' or 'off' (the faint chevron showing where the mouse aims).
// fullscreenKey: optional key that toggles fullscreen (unbound by default).
export const settings = {binds: JSON.parse(JSON.stringify(DEFAULT_BINDS)), volume: .8, muted: false, shake: true, blood: true, mouseAim: true, sens: 1, aimIndicator: 'arrow', fullscreenKey: null, lobby: JSON.parse(JSON.stringify(DEFAULT_LOBBY))};

try {
  const s = JSON.parse(localStorage.getItem('touche-settings') || 'null');
  if (s) {
    for (const k of ['volume', 'muted', 'shake', 'blood', 'mouseAim', 'sens', 'aimIndicator', 'fullscreenKey']) if (k in s) settings[k] = s[k];
    if (Array.isArray(s.binds)) for (let p = 0; p < 2; p++) for (const [a] of ACTIONS) if (s.binds[p] && typeof s.binds[p][a] === 'string') settings.binds[p][a] = s.binds[p][a];
    // older saves had one match length for everything
    if (typeof s.target === 'number') for (const m in settings.lobby) settings.lobby[m].target = s.target;
    if (s.lobby) for (const m in settings.lobby) for (const k in settings.lobby[m]) if (s.lobby[m] && k in s.lobby[m]) settings.lobby[m][k] = s.lobby[m][k];
    // a map that no longer exists (Hall, Open Hall) goes back to the default
    for (const m in settings.lobby) { const v = settings.lobby[m].map; if (v !== 'round' && v !== 'match' && !MAPS[v]) settings.lobby[m].map = 'round'; }
  }
} catch (e) {}

export function saveSettings() { try { localStorage.setItem('touche-settings', JSON.stringify(settings)); } catch (e) {} }
