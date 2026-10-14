// Everything in the HTML around the canvas: the scoring box (HUD), the main
// menu, pause and game-over overlays, and the settings panel with key rebinding.

import {settings, saveSettings, DEFAULT_BINDS, ACTIONS} from './settings.js';
import {unlockAudio, applyVolume, sfx} from '../view/audio.js';

const $ = id => document.getElementById(id);
export const menuEl = $('menu'), pauseEl = $('pause'), overEl = $('over'), setEl = $('settings');

let setReturn = 'menu', rebinding = null;

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
      b.setAttribute('aria-label', `${p ? 'Green' : 'Red'} ${label}: ${name}. Press to change.`);
      b.addEventListener('click', () => { rebinding = {p, a}; renderBinds(); const nb = $(`key-${p}-${a}`); nb.textContent = 'Press a key…'; nb.classList.add('listening'); nb.focus(); });
      td.appendChild(b); tr.appendChild(td);
    }
    tb.appendChild(tr);
  }
  $('key-fs').textContent = settings.fullscreenKey ? keyLabel(settings.fullscreenKey) : 'Not set';
  $('key-fs').classList.remove('listening');
}

function finishRebind(code) {
  if (rebinding.fs) { finishFullscreenRebind(code); return; }
  const {p, a} = rebinding; rebinding = null; let msg = '';
  if (code === 'KeyM') msg = 'M is reserved for mute.';
  else if (code !== 'Escape') {
    const old = settings.binds[p][a];
    // if the key was already used elsewhere, swap the two
    for (let q = 0; q < 2; q++) for (const [b] of ACTIONS) if (settings.binds[q][b] === code && !(q === p && b === a)) { settings.binds[q][b] = old; msg = `Swapped: ${q ? 'Green' : 'Red'} now uses ${keyLabel(old)} there.`; }
    settings.binds[p][a] = code; saveSettings();
  }
  renderBinds(); $('bindNote').textContent = msg; const nb = $(`key-${p}-${a}`); if (nb) nb.focus();
}

// The fullscreen key is a single global key, not per player. It can't share a key with a player action.
function finishFullscreenRebind(code) {
  rebinding = null; let msg = '';
  const used = settings.binds.some(b => Object.values(b).includes(code));
  if (code === 'KeyM') msg = 'M is reserved for mute.';
  else if (used) msg = 'That key is already used by a player.';
  else if (code !== 'Escape') { settings.fullscreenKey = code; saveSettings(); }
  renderBinds(); $('bindNote').textContent = msg; $('key-fs').focus();
}

// ---------- fullscreen ----------
export function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  else document.documentElement.requestFullscreen().catch(() => {});
}
function syncFullscreenButtons() { document.querySelectorAll('[data-fs]').forEach(b => b.textContent = document.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen'); }

// ---------- settings panel ----------
function syncSettingsUI() {
  $('vol').value = Math.round(settings.volume * 100); $('volOut').textContent = $('vol').value; $('mute').checked = settings.muted;
  const t = document.querySelector(`input[name="target"][value="${settings.target}"]`); if (t) t.checked = true;
  $('shake').checked = settings.shake; $('gore').checked = settings.blood; renderBinds();
  document.querySelector(`input[name="mouseaim"][value="${settings.mouseAim ? 'on' : 'off'}"]`).checked = true;
  document.querySelector(`input[name="aimind"][value="${settings.aimIndicator === 'off' ? 'off' : 'arrow'}"]`).checked = true;
  $('sens').value = Math.round(settings.sens * 100); $('sensOut').textContent = settings.sens.toFixed(2);
}
function showTab(t) {
  document.querySelectorAll('.tabs [data-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === t)));
  document.querySelectorAll('[data-pane]').forEach(p => p.hidden = p.dataset.pane !== t);
}
function openSettings(from) { setReturn = from; menuEl.hidden = true; pauseEl.hidden = true; setEl.hidden = false; $('bindNote').textContent = ''; syncSettingsUI(); showTab('controls'); $('bclose').focus({preventScroll: true}); }
function closeSettings() { rebinding = null; setEl.hidden = true; if (setReturn === 'pause') { pauseEl.hidden = false; $('bresume').focus({preventScroll: true}); } else { menuEl.hidden = false; $('b2p').focus({preventScroll: true}); } }

// ---------- HUD ----------
export function setLamp(i, on) { $('lamp' + (i + 1)).classList.toggle('lit', on); }
export function hud(S) {
  const m = S.mode;
  $('s1').textContent = m.demo ? '–' : S.scores[0]; $('s2').textContent = m.demo ? '–' : S.scores[1];
  $('n1').textContent = m.vsCPU && !m.demo ? 'Red · You' : 'Red'; $('n2').textContent = m.vsCPU && !m.demo ? 'Green · CPU ' + m.diff : 'Green';
  $('status').textContent = m.demo ? 'Exhibition bout' : `First to ${m.target} · one touch kills`;
}
export function showGameOver(S, w) {
  const names = S.mode.vsCPU ? ['You win', 'The CPU wins'] : ['Red wins', 'Green wins'];
  $('winText').textContent = names[w]; $('winText').style.color = w ? 'var(--green)' : 'var(--red)';
  $('winScore').textContent = `${S.scores[0]} – ${S.scores[1]}`;
  overEl.hidden = false; $('brematch').focus({preventScroll: true});
}
// Pause screen text depends on whether resuming needs a click to grab the mouse again.
export function setPauseHint(needsClick) { $('pauseHint').textContent = needsClick ? 'Click Resume to grab the mouse again' : 'Esc to resume'; $('pauseNote').textContent = ''; }
export function setPauseNote(t) { $('pauseNote').textContent = t; }
export const selectedDifficulty = () => { const sel = document.querySelector('input[name="diff"]:checked'); return sel ? sel.value : 'normal'; };

// Wire up all buttons. Returns the hooks input.js needs.
export function initMenus(app) {
  document.querySelectorAll('.tabs [data-tab]').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
  $('vol').addEventListener('input', e => { unlockAudio(); settings.volume = e.target.value / 100; $('volOut').textContent = e.target.value; applyVolume(); saveSettings(); });
  $('vol').addEventListener('change', () => sfx('clash', false, true));
  $('mute').addEventListener('change', e => { unlockAudio(); settings.muted = e.target.checked; applyVolume(); saveSettings(); });
  document.querySelectorAll('input[name="target"]').forEach(r => r.addEventListener('change', () => { settings.target = +r.value; saveSettings(); }));
  $('shake').addEventListener('change', e => { settings.shake = e.target.checked; saveSettings(); });
  $('gore').addEventListener('change', e => { settings.blood = e.target.checked; saveSettings(); });
  $('bresetKeys').addEventListener('click', () => { settings.binds = JSON.parse(JSON.stringify(DEFAULT_BINDS)); settings.fullscreenKey = null; saveSettings(); renderBinds(); $('bindNote').textContent = 'Controls reset.'; });
  document.querySelectorAll('input[name="mouseaim"]').forEach(r => r.addEventListener('change', () => { settings.mouseAim = r.value === 'on'; saveSettings(); }));
  document.querySelectorAll('input[name="aimind"]').forEach(r => r.addEventListener('change', () => { settings.aimIndicator = r.value; saveSettings(); }));
  $('sens').addEventListener('input', e => { settings.sens = e.target.value / 100; $('sensOut').textContent = settings.sens.toFixed(2); saveSettings(); });
  $('key-fs').addEventListener('click', () => { rebinding = {fs: true}; renderBinds(); const b = $('key-fs'); b.textContent = 'Press a key…'; b.classList.add('listening'); b.focus(); });
  $('bclearFs').addEventListener('click', () => { settings.fullscreenKey = null; saveSettings(); renderBinds(); });
  document.querySelectorAll('[data-fs]').forEach(b => b.addEventListener('click', toggleFullscreen));
  document.addEventListener('fullscreenchange', syncFullscreenButtons);
  $('bclose').addEventListener('click', closeSettings);
  $('bset1').addEventListener('click', () => openSettings('menu'));
  $('bset2').addEventListener('click', () => openSettings('pause'));
  $('b2p').addEventListener('click', () => app.startMatch(false));
  $('bcpu').addEventListener('click', () => app.startMatch(true));
  $('bresume').addEventListener('click', () => app.resume());
  $('bquit').addEventListener('click', () => app.showMenu());
  $('brematch').addEventListener('click', () => app.startMatch(app.S.mode.vsCPU));
  $('bmenu').addEventListener('click', () => app.showMenu());
  return {
    isRebinding: () => !!rebinding, finishRebind, syncSettingsUI,
    settingsOpen: () => !setEl.hidden, closeSettings,
    cancelRebind: () => { rebinding = null; },
  };
}
