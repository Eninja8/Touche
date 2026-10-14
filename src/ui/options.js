// A menu option you cycle through, like "Map   ‹ Fencing hall ›".
// Mouse: click the left half for the previous value, the right half for the next.
// Keyboard: Left/Right arrows (see screens.js), Enter goes to the next value.

// values: [[value, label], ...]; get() returns the current value; set(v) stores a new one.
// Returns {row, show}: the element to insert, and show() to redraw after outside changes.
export function optionRow({label, values, get, set}) {
  const row = document.createElement('div'); row.className = 'opt-row';
  const name = document.createElement('span'); name.className = 'lbl'; name.textContent = label;
  const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'opt';
  const val = document.createElement('span');
  btn.append(arrow('‹'), val, arrow('›'));
  row.append(name, btn);

  const index = () => Math.max(0, values.findIndex(([v]) => v === get()));
  const show = () => { const text = values[index()][1]; val.textContent = text; btn.setAttribute('aria-label', `${label}: ${text}`); };
  const step = d => { if (btn.disabled) return; set(values[(index() + d + values.length) % values.length][0]); show(); };
  btn.addEventListener('click', e => {
    // e.detail is 0 for a keyboard "click" (Enter/Space): always go forward then
    const r = btn.getBoundingClientRect();
    step(e.detail && e.clientX < r.left + r.width / 2 ? -1 : 1);
  });
  btn._step = step; // used by the arrow keys
  show();
  return {row, show, btn};
}

function arrow(ch) { const s = document.createElement('span'); s.className = 'opt-arrow'; s.textContent = ch; s.setAttribute('aria-hidden', 'true'); return s; }

export const ON_OFF = [[true, 'On'], [false, 'Off']];
