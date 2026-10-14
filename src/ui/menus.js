// Everything in the HTML around the canvas: the scoring box (HUD), the main and
// play menus, pause and game-over overlays, the corner icons, and the settings
// panel with key rebinding. (Lobbies: lobby.js. Screen switching: screens.js.)

import {settings, saveSettings, DEFAULT_BINDS, ACTIONS} from './settings.js';
import {optionRow, ON_OFF} from './options.js';
import {showScreen, onBack} from './screens.js';
import {openLobby, initLobby} from './lobby.js';
import {unlockAudio, applyVolume, sfx, toggleMute} from '../view/audio.js';

const $ = id => document.getElementById(id);
export const pauseEl = $('pause'), overEl = $('over'), setEl = $('settings');

let setReturn = 'menu', rebinding = null, optRows = [];

// ---------- key rebinding ----------
const KEY_NAMES = {Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\', BracketLeft: '[', BracketRight: ']', Minus: '-', Equal: '=', Backquote: '`', Space: 'Space', ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', ShiftLeft: 'L Shift', ShiftRight: 'R Shift', ControlLeft: 'L Ctrl', ControlRight: 'R Ctrl', AltLeft: 'L Alt', AltRight: 'R Alt', Enter: 'Enter', Tab: 'Tab', CapsLock: 'Caps', Backspace: 'Bksp'};
function keyLabel(c) { if (KEY_NAMES[c]) return KEY_NAMES[c]; if (c.startsWith('Key')) return c.slice(3); if (c.startsWith('Digit')) return c.slice(5); if (c.startsWith('Numpad')) return 'Num ' + c.slice(6); return c; }

function renderBinds() {
  const tb = $('bindRows'); tb.textContent = '';
  for (const [a, label] of ACTIONS) {
    const tr = document.createElement('tr'), th = document.createElement('th'); th.scope = 'row'; th.textContent = label; tr.appendChild(th);
    for (let p = 0; p < 2; p++) {
      const td = document.createElement('td'), b = document.createElement('button'), name = keyLabel(settings.binds[p][a]);
      b.type = 'button'; b.className = 'key'; b.id = `key-${p}-${a}`; b.textContent = name;
      b.setAttribute('aria-label', `${p ? 'Green' : 'Red'} ${label}: ${name}`);
      b.addEventListener('click', () => { rebinding = {p, a}; renderBinds(); const nb = $(`key-${p}-${a}`); nb.textContent = '…'; nb.classList.add('listening'); nb.focus(); });
      td.appendChild(b); tr.appendChild(td);
    }
    tb.appendChild(tr);
  }
  $('key-fs').textContent = settings.fullscreenKey ? keyLabel(settings.fullscreenKey) : 'None';
  $('key-fs').classList.remove('listening');
}

function finishRebind(code) {
  if (rebinding.fs) { finishFullscreenRebind(code); return; }
  const {p, a} = rebinding; rebinding = null; let msg = '';
  if (code === 'KeyM') msg = 'M is reserved for mute.';
  else if (code === 'KeyN') msg = 'N is reserved for network stats.';
  else if (code !== 'Escape') {
    const old = settings.binds[p][a];
    // if the key was already used elsewhere, swap the two
    for (let q = 0; q < 2; q++) for (const [b] of ACTIONS) if (settings.binds[q][b] === code && !(q === p && b === a)) { settings.binds[q][b] = old; msg = 'Swapped.'; }
    settings.binds[p][a] = code; saveSettings();
  }
  renderBinds(); $('bindNote').textContent = msg; const nb = $(`key-${p}-${a}`); if (nb) nb.focus();
}

// The fullscreen key is a single global key, not per player. It can't share a key with a player action.
function finishFullscreenRebind(code) {
  rebinding = null; let msg = '';
  const used = settings.binds.some(b => Object.values(b).includes(code));
  if (code === 'KeyM') msg = 'M is reserved for mute.';
  else if (code === 'KeyN') msg = 'N is reserved for network stats.';
  else if (used) msg = 'Already in use.';
  else if (code !== 'Escape') { settings.fullscreenKey = code; saveSettings(); }
  renderBinds(); $('bindNote').textContent = msg; $('key-fs').focus();
}

// ---------- corner icons: fullscreen and mute ----------
export function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  else document.documentElement.requestFullscreen().catch(() => {});
}
function syncIcons() {
  $('bfs').classList.toggle('on', !!document.fullscreenElement); $('bfs').setAttribute('aria-label', document.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen');
  $('bmute').classList.toggle('on', settings.muted); $('bmute').setAttribute('aria-label', settings.muted ? 'Unmute' : 'Mute');
}

// ---------- settings panel ----------
function buildOptions() {
  const opt = (box, label, values, key) => { const o = optionRow({label, values, get: () => settings[key], set: v => { settings[key] = v; saveSettings(); if (key === 'muted') { applyVolume(); syncIcons(); } }}); $(box).appendChild(o.row); optRows.push(o); };
  opt('optsControls', 'Aim with mouse', ON_OFF, 'mouseAim');
  opt('optsControls', 'Aim style', [['free', 'Free cursor'], ['arrow', 'Arrow'], ['off', 'Off']], 'aimStyle');
  opt('optsSound', 'Mute', ON_OFF, 'muted');
  opt('optsDisplay', 'Screen shake', ON_OFF, 'shake');
  opt('optsDisplay', 'Blood', ON_OFF, 'blood');
}
function syncSettingsUI() {
  $('vol').value = Math.round(settings.volume * 100); $('volOut').textContent = $('vol').value;
  $('sens').value = Math.round(settings.sens * 100); $('sensOut').textContent = settings.sens.toFixed(2);
  for (const o of optRows) o.show();
  renderBinds(); syncIcons();
}
function showTab(t) {
  document.querySelectorAll('.tabs [data-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === t)));
  document.querySelectorAll('[data-pane]').forEach(p => p.hidden = p.dataset.pane !== t);
}
// from: 'menu' (a screen of its own) or 'pause' (over a running match)
function openSettings(from) {
  setReturn = from; $('bindNote').textContent = ''; syncSettingsUI(); showTab('controls');
  if (from === 'menu') showScreen('settings', 'bclose');
  else { pauseEl.hidden = true; setEl.hidden = false; $('bclose').focus({preventScroll: true}); }
}
function closeSettings() {
  rebinding = null;
  if (setReturn === 'pause') { setEl.hidden = true; pauseEl.hidden = false; $('bresume').focus({preventScroll: true}); }
  else showScreen('menu', 'bset1');
}

// ---------- HUD ----------
export function setLamp(i, on) { $('lamp' + (i + 1)).classList.toggle('lit', on); }
// net: online info {me, ping} or null
export function hud(S, net) {
  const m = S.mode;
  $('s1').textContent = S.scores[0]; $('s2').textContent = S.scores[1];
  if (net) {
    $('n1').textContent = net.me === 0 ? 'Red · You' : 'Red'; $('n2').textContent = net.me === 1 ? 'Green · You' : 'Green';
    $('status').textContent = `Online · first to ${m.target}` + (net.ping ? ` · ${net.ping} ms` : '');
    return;
  }
  $('n1').textContent = m.vsCPU ? 'Red · You' : 'Red'; $('n2').textContent = m.vsCPU ? 'Green · CPU ' + m.diff : 'Green';
  $('status').textContent = `First to ${m.target}`;
}
// me: this computer's player when online, else -1
export function showGameOver(S, w, me) {
  const text = me >= 0 ? (me === w ? 'You win' : 'You lose') : (S.mode.vsCPU ? ['You win', 'CPU wins'] : ['Red wins', 'Green wins'])[w];
  $('overHint').textContent = me >= 0 ? '' : 'Enter: rematch · Esc: menu';
  $('winText').textContent = text; $('winText').style.color = w ? 'var(--green)' : 'var(--red)';
  $('winScore').textContent = `${S.scores[0]} – ${S.scores[1]}`;
  overEl.hidden = false; $('brematch').focus({preventScroll: true});
}
// Pause screen text depends on whether resuming needs a click to grab the mouse again.
// online: the match keeps running behind the menu
export function setPauseHint(needsClick, online) {
  $('pauseHint').textContent = (online ? 'Match still running · ' : '') + (needsClick ? 'Click Resume to aim' : 'Esc to resume');
  $('pauseNote').textContent = '';
}
export function setPauseNote(t) { $('pauseNote').textContent = t; }

// Wire up all buttons. Returns the hooks input.js needs.
// app: {startMatch(mode, opts), resume, showMenu, rematch}
export function initMenus(app) {
  buildOptions(); initLobby();
  document.querySelectorAll('.tabs [data-tab]').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
  $('vol').addEventListener('input', e => { unlockAudio(); settings.volume = e.target.value / 100; $('volOut').textContent = e.target.value; applyVolume(); saveSettings(); });
  $('vol').addEventListener('change', () => sfx('clash', false, true));
  $('bresetKeys').addEventListener('click', () => { settings.binds = JSON.parse(JSON.stringify(DEFAULT_BINDS)); settings.fullscreenKey = null; saveSettings(); renderBinds(); $('bindNote').textContent = 'Reset.'; });
  $('sens').addEventListener('input', e => { settings.sens = e.target.value / 100; $('sensOut').textContent = settings.sens.toFixed(2); saveSettings(); });
  $('key-fs').addEventListener('click', () => { rebinding = {fs: true}; renderBinds(); const b = $('key-fs'); b.textContent = '…'; b.classList.add('listening'); b.focus(); });
  $('bclearFs').addEventListener('click', () => { settings.fullscreenKey = null; saveSettings(); renderBinds(); });
  $('bfs').addEventListener('click', toggleFullscreen);
  $('bmute').addEventListener('click', () => { unlockAudio(); toggleMute(); syncSettingsUI(); });
  document.addEventListener('fullscreenchange', syncIcons);
  $('bclose').addEventListener('click', closeSettings); onBack('settings', closeSettings);
  $('bset1').addEventListener('click', () => openSettings('menu'));
  $('bset2').addEventListener('click', () => openSettings('pause'));
  // main menu → play → a lobby
  $('bplay').addEventListener('click', () => showScreen('play'));
  const toPlay = focus => showScreen('play', focus);
  $('bplayBack').addEventListener('click', () => showScreen('menu', 'bplay')); onBack('play', () => showScreen('menu', 'bplay'));
  for (const [id, mode] of [['bcpu', 'cpu'], ['blocal', 'local']]) {
    $(id).addEventListener('click', () => openLobby(mode, {onStart: v => app.startMatch(mode, v), onBack: () => toPlay(id)}));
  }
  $('bresume').addEventListener('click', () => app.resume());
  $('bquit').addEventListener('click', () => app.showMenu());
  $('brematch').addEventListener('click', () => app.rematch());
  $('bmenu').addEventListener('click', () => app.showMenu());
  syncIcons();
  return {
    isRebinding: () => !!rebinding, finishRebind, syncSettingsUI,
    settingsOpen: () => !setEl.hidden,
    cancelRebind: () => { rebinding = null; },
  };
}
