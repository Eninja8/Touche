// Menu screens: which one is showing, what Esc does on each, and keyboard
// navigation that works on every menu (arrows move, Enter picks, Esc goes back).

const $ = id => document.getElementById(id);

// Screens shown outside a match. While one is up, the scoring box is hidden and
// the fullscreen/mute icons show in the corner (body.menus in styles.css).
const SCREENS = ['menu', 'play', 'onlineMenu', 'joinScreen', 'lobby', 'settings'];
const backs = {}; // overlay id -> what Esc does there

export function onBack(id, fn) { backs[id] = fn; }

// Show one screen (hiding the others) and focus `focusId` or its first control.
export function showScreen(id, focusId) {
  for (const s of SCREENS) $(s).hidden = s !== id;
  document.body.classList.add('menus');
  const el = (focusId && $(focusId)) || focusables($(id))[0];
  if (el) el.focus({preventScroll: true});
}

// Into a match: no menu screens, scoring box back.
export function hideScreens() {
  for (const s of SCREENS) $(s).hidden = true;
  document.body.classList.remove('menus');
}

const topOverlay = () => [...document.querySelectorAll('.overlay')].reverse().find(o => !o.hidden);
const focusables = root => [...root.querySelectorAll('button:not([disabled]), input:not([type=radio]):not([type=checkbox]):not([disabled])')].filter(el => el.offsetParent !== null);
const typingIn = el => el && el.tagName === 'INPUT' && el.type === 'text';

// Called first for every key press. Returns true if a menu used the key
// (then the game ignores it).
export function menuKey(e) {
  const ov = topOverlay();
  if (!ov) return false;
  const t = document.activeElement, typing = typingIn(t);
  if (e.code === 'Escape') {
    const fn = backs[ov.id];
    if (!fn) return false;
    e.preventDefault(); if (!e.repeat) fn();
    return true;
  }
  const d = {ArrowUp: -1, ArrowDown: 1, ArrowLeft: -1, ArrowRight: 1}[e.code];
  if (!d) return typing; // typing a room code: keep letters away from the game
  const sideways = e.code === 'ArrowLeft' || e.code === 'ArrowRight';
  if (sideways && t && ov.contains(t)) {
    if (typing || t.type === 'range') return true;              // the browser moves the caret / slider
    if (t._step) { e.preventDefault(); t._step(d); return true; } // option: change its value
    if (t.closest('.tabs')) { e.preventDefault(); const tabs = [...t.closest('.tabs').querySelectorAll('button')], i = tabs.indexOf(t), n = tabs[(i + d + tabs.length) % tabs.length]; n.focus(); n.click(); return true; }
  }
  e.preventDefault();
  const list = focusables(ov), i = list.indexOf(t);
  const next = i < 0 ? list[0] : list[(i + d + list.length) % list.length];
  if (next) next.focus({preventScroll: true});
  return true;
}
