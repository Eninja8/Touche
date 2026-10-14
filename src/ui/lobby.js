// The match lobby, shared by vs CPU, Local and Online: the match options
// (remembered per mode in settings.lobby), a Start button and Back.
// Online, the host can change the options and the joiner sees them read-only.

import {settings, saveSettings} from './settings.js';
import {MAPS} from '../sim/maps.js';
import {optionRow} from './options.js';
import {showScreen, onBack} from './screens.js';

const $ = id => document.getElementById(id);

const OPTIONS = {
  diff: {label: 'Difficulty', values: [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']]},
  map: {label: 'Map', values: Object.keys(MAPS).map(k => [k, MAPS[k].name])},
  target: {label: 'First to', values: [[3, '3'], [5, '5'], [7, '7'], [10, '10']]},
};
const MODE_OPTIONS = {cpu: ['diff', 'map', 'target'], local: ['map', 'target'], online: ['map', 'target']};
const TITLES = {cpu: 'vs CPU', local: 'Local', online: 'Online'};

// The lobby being shown: {mode, readOnly, values, rows, onStart, onBack, onChange}
let cur = null;

// opts: {readOnly, values (joiner: the host's), code (show the room code row), onStart, onBack, onChange}
export function openLobby(mode, opts = {}) {
  const values = opts.values || settings.lobby[mode];
  cur = {mode, readOnly: !!opts.readOnly, values, rows: [], onStart: opts.onStart, onBack: opts.onBack, onChange: opts.onChange};
  $('lobbyTitle').textContent = TITLES[mode];
  $('codeRow').hidden = !opts.code; $('roomCode').textContent = '····';
  const box = $('lobbyOpts'); box.textContent = '';
  for (const key of MODE_OPTIONS[mode]) {
    const o = optionRow({...OPTIONS[key], get: () => cur.values[key], set: v => {
      cur.values[key] = v;
      if (!cur.readOnly) { settings.lobby[mode] = {...cur.values}; saveSettings(); }
      if (cur.onChange) cur.onChange(lobbyValues());
    }});
    o.btn.disabled = cur.readOnly;
    box.appendChild(o.row); cur.rows.push(o);
  }
  $('bstart').hidden = !opts.onStart; $('bstart').disabled = false;
  setLobbyStatus(''); setLobbyError('');
  showScreen('lobby', opts.onStart ? 'bstart' : 'blobbyBack');
}

export const lobbyValues = () => ({...cur.values});
// Joiner: the host changed something.
export function setLobbyValues(v) { if (!cur) return; Object.assign(cur.values, v); for (const r of cur.rows) r.show(); }
export function setLobbyStatus(t) { $('lobbyStatus').textContent = t; }
export function setLobbyError(t) { $('lobbyError').textContent = t; }
export function setStartEnabled(on) { $('bstart').disabled = !on; }

export function initLobby() {
  $('bstart').addEventListener('click', () => { if (cur && cur.onStart) cur.onStart(lobbyValues()); });
  const back = () => { if (cur && cur.onBack) cur.onBack(); };
  $('blobbyBack').addEventListener('click', back);
  onBack('lobby', back);
}
