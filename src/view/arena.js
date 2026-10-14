// Paints the playable parts of a map, the same way on every map unless the map's
// theme (src/view/themes/) supplies its own look: pits, solid blocks, the floors that
// cover pits when hazards are off, spikes, platforms, ropes/chains/ladders, and pads.

import {rect, line, poly, glow, hash, vgrad} from './paint.js';

// th: the theme; col: the map's colours for this mode; v: visible area; t: seconds
export function drawArena(ctx, map, th, col, v, dark, t) {
  for (const p of map.pits) pitShaft(ctx, p, th, col, dark);
  for (const s of map.solids) if (s.look !== 'cover' && s.look !== 'pitFloor') (th.block || block)(ctx, s, col, dark, map, t);
  for (const s of map.covers) (th.cover || cover)(ctx, s, col, dark);
  for (const k of map.spikes) spikes(ctx, k, th.spikes || {}, col, dark, t);
  for (const p of map.platforms) (th.platform || platform)(ctx, p, col, dark, t);
  for (const r of map.ropes) rope(ctx, r, col, dark, t, th);
  for (const p of map.pads) pad(ctx, p, col, t);
}

// A pit: a dark shaft between the floors, darkest at the bottom.
function pitShaft(ctx, p, th, col, dark) {
  const deep = th.pitColor ? th.pitColor(dark) : dark ? '#050608' : '#2a2620';
  vgrad(ctx, p.x, p.y, p.w, p.d + 40, [col.floor, deep, deep]);
  rect(ctx, '#000', p.x, p.y, 6, p.d + 40, .25); rect(ctx, '#000', p.x + p.w - 6, p.y, 6, p.d + 40, .25);
}

// A plain block: filled, with an outlined top edge.
export function block(ctx, s, col, dark) {
  rect(ctx, col.platform, s.x, s.y, s.w, s.h);
  rect(ctx, col.floor, s.x, s.y, s.w, Math.min(10, s.h));
  line(ctx, col.line, 3, [s.x, s.y, s.x + s.w, s.y]);
}

// Hazards off: the floor laid over a pit (wooden boards on rope).
function cover(ctx, s, col) {
  for (let x = s.x; x < s.x + s.w; x += 14) rect(ctx, col.platform, x + 1, s.y, 12, 9);
  line(ctx, col.line, 2, [s.x, s.y, s.x + s.w, s.y], .9);
  line(ctx, col.line, 1.5, [s.x, s.y + 9, s.x + s.w, s.y + 9], .5);
}

// Spikes fill box k, pointing k.dir. o: {fill, edge, hot (glowing tips colour), size}
function spikes(ctx, k, o, col, dark, t) {
  const fill = o.fill || (dark ? '#aab3bf' : '#5f6772'), edge = o.edge || col.line, size = o.size || 10;
  const along = k.dir === 'up' || k.dir === 'down', len = along ? k.w : k.h, n = Math.max(1, Math.round(len / size)), step = len / n;
  ctx.lineJoin = 'round';
  for (let j = 0; j < n; j++) {
    const a = j * step, b = a + step, m = a + step / 2, jit = (hash(j + k.x) - .5) * 3;
    let pts;
    if (k.dir === 'up') pts = [k.x + a, k.y + k.h, k.x + m + jit, k.y, k.x + b, k.y + k.h];
    else if (k.dir === 'down') pts = [k.x + a, k.y, k.x + m + jit, k.y + k.h, k.x + b, k.y];
    else if (k.dir === 'left') pts = [k.x + k.w, k.y + a, k.x, k.y + m + jit, k.x + k.w, k.y + b];
    else pts = [k.x, k.y + a, k.x + k.w, k.y + m + jit, k.x, k.y + b];
    poly(ctx, fill, pts);
    ctx.strokeStyle = edge; ctx.lineWidth = 1.2; ctx.globalAlpha = .7; ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); ctx.lineTo(pts[2], pts[3]); ctx.lineTo(pts[4], pts[5]); ctx.stroke(); ctx.globalAlpha = 1;
    if (o.hot) glow(ctx, pts[2], pts[3], 7, o.hot, .5 + .2 * Math.sin(t * 5 + j), dark);
  }
  if (k.dir === 'up') rect(ctx, edge, k.x, k.y + k.h - 2, k.w, 2, .6);
}

// A one-way platform: a thin plank you can jump up through.
export function platform(ctx, p, col) {
  ctx.fillStyle = col.platform; ctx.beginPath(); ctx.roundRect(p.x, p.y, p.w, 9, 3); ctx.fill();
  line(ctx, col.line, 2.5, [p.x, p.y, p.x + p.w, p.y]);
}

// Ropes, chains and ladders, plus whatever hangs at the bottom (chandelier, crane hook).
function rope(ctx, r, col, dark, t, th) {
  const bottom = r.to ? r.to : r.y1 + 20;
  if (r.look === 'ladder') {
    const c = th.ladderColor || (dark ? '#8a8f9c' : '#4b4f58');
    line(ctx, c, 3, [r.x - 11, r.y0 - 6, r.x - 11, bottom]); line(ctx, c, 3, [r.x + 11, r.y0 - 6, r.x + 11, bottom]);
    for (let y = r.y0 + 6; y < bottom; y += 22) line(ctx, c, 2.5, [r.x - 11, y, r.x + 11, y]);
    return;
  }
  if (r.look === 'chain') {
    const c = th.chainColor || (dark ? '#b9b2a6' : '#3c3833');
    for (let y = r.y0, j = 0; y < r.y1 + 12; y += 9, j++) {
      ctx.strokeStyle = c; ctx.lineWidth = 2.2; ctx.beginPath();
      if (j % 2) ctx.ellipse(r.x, y + 4, 1.5, 5.5, 0, 0, Math.PI * 2); else ctx.ellipse(r.x, y + 4, 4, 5.5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else {
    const c = th.ropeColor || (dark ? '#c9a878' : '#7a5a34');
    line(ctx, c, 4, [r.x, r.y0, r.x, r.y1 + 18]);
    ctx.globalAlpha = .45; ctx.strokeStyle = dark ? '#5e4a2c' : '#4a341b'; ctx.lineWidth = 1.2;
    for (let y = r.y0 + 4; y < r.y1 + 16; y += 7) { ctx.beginPath(); ctx.moveTo(r.x - 2, y); ctx.lineTo(r.x + 2, y + 4); ctx.stroke(); }
    ctx.globalAlpha = 1;
    ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(r.x, r.y1 + 20, 4.5, 6, 0, 0, Math.PI * 2); ctx.fill(); // knot at the end
  }
  if (r.lamp === 'chandelier') chandelier(ctx, r.x, r.y1 + 12, dark, t, th);
  if (r.lamp === 'hook') {
    const c = th.chainColor || (dark ? '#b9b2a6' : '#3c3833');
    ctx.strokeStyle = c; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(r.x + 6, r.y1 + 26, 9, Math.PI, Math.PI * 2.6); ctx.stroke();
    rect(ctx, c, r.x - 5, r.y1 + 8, 10, 10);
  }
}

// An iron ring of candles, glowing (strongly at night).
function chandelier(ctx, x, y, dark, t, th) {
  const iron = th.chainColor || (dark ? '#b9b2a6' : '#3c3833'), flame = dark ? '#ffcf7a' : '#f2a33a';
  glow(ctx, x, y - 8, dark ? 170 : 90, dark ? 'rgba(255,190,110,.55)' : 'rgba(255,200,120,.5)', dark ? .55 : .35, dark);
  ctx.strokeStyle = iron; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.ellipse(x, y, 46, 9, 0, 0, Math.PI * 2); ctx.stroke();
  for (const d of [-1, 1]) line(ctx, iron, 1.5, [x, y - 30, x + d * 44, y - 1]);
  for (let k = 0; k < 7; k++) {
    const cx = x - 42 + k * 14, cy = y - 3 + Math.sin(k / 6 * Math.PI) * 6;
    rect(ctx, dark ? '#efe6d4' : '#f7f0e2', cx - 2, cy - 10, 4, 9);
    const fl = 1 + Math.sin(t * 13 + k * 2.1) * .15;
    ctx.fillStyle = flame; ctx.beginPath(); ctx.ellipse(cx, cy - 13, 2.2, 4 * fl, 0, 0, Math.PI * 2); ctx.fill();
  }
}

// Jump pads: a glowing plate with up-chevrons. Speed pads: a plate with arrows both ways.
function pad(ctx, p, col, t) {
  const pulse = .6 + Math.sin(t * 6) * .25;
  ctx.fillStyle = col.accent; ctx.globalAlpha = .9; ctx.beginPath(); ctx.roundRect(p.x, p.y - 5, p.w, 6, 2); ctx.fill(); ctx.globalAlpha = 1;
  const cx = p.x + p.w / 2;
  if (p.type === 'jump') for (let k = 0; k < 3; k++) line(ctx, col.accent, 2.5, [cx - 9, p.y - 12 - k * 9, cx, p.y - 19 - k * 9, cx + 9, p.y - 12 - k * 9], pulse * (1 - k * .25));
  else for (const d of [-1, 1]) for (let k = 0; k < 2; k++) { const x = cx + d * (8 + k * 9); line(ctx, col.accent, 2.5, [x - d * 4, p.y - 15, x + d * 2, p.y - 10, x - d * 4, p.y - 5], pulse); }
}


