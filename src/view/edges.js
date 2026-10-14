// Readability: makes everything you can stand on or bump into stand out from the
// background. The background gets a haze (darker at night, paler by day) so it falls
// back, and every solid block gets a rim along the edges that face open air: a strong
// outline, plus a highlight just inside the top so floors and ledges read at a glance.
// Platforms get the same top edge. Purely cosmetic.

import {rect, line} from './paint.js';

// Laid over the background layers before the arena is drawn.
export function haze(ctx, v, col, dark, th) {
  const h = th.haze ? th.haze(dark) : null;
  rect(ctx, h ? h[0] : dark ? '#000000' : col.sky, v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0, h ? h[1] : dark ? .42 : .4);
}

// The parts of block s's outline that face open air: not against another block and not
// along the map's border. Returns [{x0, y0, x1, y1, side}] with side 'top' | 'bottom' | 'left' | 'right'.
// Maps never change during a match, so the answer is kept per map.
const cache = new WeakMap();
function openEdges(map, s) {
  let m = cache.get(map); if (!m) cache.set(map, m = new Map());
  if (m.has(s)) return m.get(s);
  const near = (a, b) => Math.abs(a - b) < .5, out = [];
  // cut [lo, hi] wherever another block's span [a, b] covers it
  const cut = (segs, a, b) => segs.flatMap(([u, w]) => b <= u || a >= w ? [[u, w]] : [[u, a], [b, w]].filter(([p, q]) => q - p > 1));
  const run = (side, fixed, lo, hi, border, touching, span) => {
    if (border) return;
    let segs = [[lo, hi]];
    for (const o of others) if (o !== s && touching(o)) segs = cut(segs, ...span(o));
    for (const [a, b] of segs) out.push(side === 'top' || side === 'bottom' ? {x0: a, x1: b, y0: fixed, y1: fixed, side} : {x0: fixed, x1: fixed, y0: a, y1: b, side});
  };
  // with Hazards off a pit is filled in, so it counts as solid (no outline down its walls)
  const others = map.solids.filter(o => o.look !== 'pitFloor').concat(map.hazards ? [] : map.pits.map(p => ({x: p.x, y: p.y, w: p.w, h: map.height - p.y})));
  const x0 = Math.max(0, s.x), x1 = Math.min(map.width, s.x + s.w), y0 = Math.max(0, s.y), y1 = Math.min(map.height, s.y + s.h);
  const hspan = o => [o.x, o.x + o.w], vspan = o => [o.y, o.y + o.h];
  run('top', s.y, x0, x1, s.y <= 0, o => near(o.y + o.h, s.y), hspan);
  if (s.look === 'cover') { m.set(s, out); return out; } // only the top of a pit cover shows
  run('bottom', s.y + s.h, x0, x1, s.y + s.h >= map.height, o => near(o.y, s.y + s.h), hspan);
  run('left', s.x, y0, y1, s.x <= 0, o => near(o.x + o.w, s.x), vspan);
  run('right', s.x + s.w, y0, y1, s.x + s.w >= map.width, o => near(o.x, s.x + s.w), vspan);
  m.set(s, out);
  return out;
}

// The rim on block s: outline on every open edge; on top, a thicker edge and a highlight.
export function rim(ctx, map, s, col, dark) {
  const hi = dark ? 'rgba(255,255,255,.55)' : 'rgba(255,255,255,.7)';
  ctx.lineCap = 'square';
  for (const e of openEdges(map, s)) {
    if (e.side === 'top') {
      line(ctx, col.line, 3.5, [e.x0, e.y0 + 1, e.x1, e.y1 + 1]);
      if (s.h > 8) line(ctx, hi, 2, [e.x0 + 2, e.y0 + 4.5, e.x1 - 2, e.y1 + 4.5]);
    } else {
      // walls and undersides: the outline sits just inside the block, so it never covers open air
      const ox = e.side === 'left' ? 1.25 : e.side === 'right' ? -1.25 : 0, oy = e.side === 'bottom' ? -1.25 : 0;
      line(ctx, col.line, 2.5, [e.x0 + ox, e.y0 + oy, e.x1 + ox, e.y1 + oy], .9);
    }
  }
  ctx.lineCap = 'butt';
}

// A one-way platform's top edge, matching the blocks' rim, with a soft shadow under it.
export function platformRim(ctx, p, col, dark) {
  rect(ctx, '#000000', p.x, p.y + 9, p.w, 5, dark ? .35 : .18);
  line(ctx, col.line, 3.5, [p.x, p.y + 1, p.x + p.w, p.y + 1]);
  line(ctx, dark ? 'rgba(255,255,255,.5)' : 'rgba(255,255,255,.65)', 1.5, [p.x + 2, p.y + 4, p.x + p.w - 2, p.y + 4]);
  for (const x of [p.x, p.x + p.w]) line(ctx, col.line, 2, [x, p.y, x, p.y + 8], .9);
}
