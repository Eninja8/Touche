// Player preferences (key bindings, volume, match length, effects), saved in
// the browser's localStorage so they survive a page reload.

export const DEFAULT_BINDS = [
  {left: 'KeyA', right: 'KeyD', up: 'KeyW', down: 'KeyS', raise: 'KeyQ', lower: 'KeyE', attack: 'KeyF', dash: 'KeyG'},
  {left: 'KeyJ', right: 'KeyL', up: 'KeyI', down: 'KeyK', raise: 'KeyU', lower: 'KeyO', attack: 'Semicolon', dash: 'Quote'},
];
export const ACTIONS = [['left', 'Move left'], ['right', 'Move right'], ['up', 'Jump'], ['down', 'Crouch · slide · drop'], ['raise', 'Raise blade'], ['lower', 'Lower blade'], ['attack', 'Thrust'], ['dash', 'Dash']];

export const settings = {binds: JSON.parse(JSON.stringify(DEFAULT_BINDS)), volume: .8, muted: false, target: 5, shake: true, blood: true};

try {
  const s = JSON.parse(localStorage.getItem('touche-settings') || 'null');
  if (s) {
    for (const k of ['volume', 'muted', 'target', 'shake', 'blood']) if (k in s) settings[k] = s[k];
    if (Array.isArray(s.binds)) for (let p = 0; p < 2; p++) for (const [a] of ACTIONS) if (s.binds[p] && typeof s.binds[p][a] === 'string') settings.binds[p][a] = s.binds[p][a];
  }
} catch (e) {}

export function saveSettings() { try { localStorage.setItem('touche-settings', JSON.stringify(settings)); } catch (e) {} }
