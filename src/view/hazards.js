// The danger look, the same on every map so you can tell at a glance what kills:
// spikes (pit spikes, spike strips, the Forge catwalk, icicles) are pale blades with dark
// outlines and glowing orange-red tips, and pits are a dark void lit from below by their
// spikes, with bright warning lips on both edges. Purely cosmetic.

import {rect, line, glow, hash} from './paint.js';
import {groundAt} from '../sim/terrain.js';

export const DANGER = '#ff4d1a';                  // the one warning colour
const GLOW = 'rgba(255,70,20,.95)';

// The inside of a pit: a dark void, glowing red-orange at the bottom when it has spikes.
export function pitVoid(ctx, p, map, dark, t) {
  const hazards = map.hazards, h = map.height + 300 - p.y; // down past the bottom of the map
  const g = ctx.createLinearGradient(0, p.y, 0, p.y + p.d);
  g.addColorStop(0, dark ? '#000000' : '#0d0b0a'); g.addColorStop(.55, dark ? '#030204' : '#141010'); g.addColorStop(1, hazards ? '#3a0d04' : '#141010');
  ctx.fillStyle = g; ctx.fillRect(p.x, p.y, p.w, p.d); rect(ctx, hazards ? '#3a0d04' : '#141010', p.x, p.y + p.d, p.w, h - p.d);
  if (!hazards) return;
  ctx.save(); ctx.beginPath(); ctx.rect(p.x, p.y, p.w, h); ctx.clip();
  glow(ctx, p.x + p.w / 2, p.y + p.d, p.w * 1.1, GLOW, .55 + .12 * Math.sin(t * 4 + p.x), true);
  ctx.restore();
}

// Warning lips on the floor at both edges of a pit, and a bright line down its walls,
// drawn after the floors so they sit on top. Skipped with Hazards off (the pit is covered).
export function pitLips(ctx, p, map, dark, t) {
  const a = .85 + .15 * Math.sin(t * 4 + p.x);
  for (const [x, d] of [[p.x, -1], [p.x + p.w, 1]]) {
    if (!groundAt(map, x + d * 10, p.y)) continue;                     // a wall, not a floor, on this side
    rect(ctx, DANGER, d < 0 ? x - 30 : x, p.y - 2, 30, 7, a);           // lip on the floor top
    line(ctx, DANGER, 4, [x - d * 2, p.y, x - d * 2, p.y + 46], a);      // down the pit wall
    for (let k = 0; k < 4; k++) {                                       // hazard stripes on the lip
      const cx = d < 0 ? x - 27 + k * 7 : x + 3 + k * 7;
      line(ctx, dark ? '#000' : '#1a0a04', 2, [cx, p.y + 4.5, cx + 4, p.y - 1.5], .55);
    }
  }
}

// Spikes fill box k, pointing k.dir ('up', 'down', 'left', 'right').
export function spikes(ctx, k, dark, t) {
  const along = k.dir === 'up' || k.dir === 'down', len = along ? k.w : k.h, size = 10;
  const n = Math.max(1, Math.round(len / size)), step = len / n;
  const body = dark ? '#e9edf2' : '#f4f6f8', edge = dark ? '#000000' : '#151515', pulse = .5 + .5 * Math.sin(t * 4 + k.x * .01);
  // a pulsing danger glow behind the whole strip
  glow(ctx, k.x + k.w / 2, k.y + k.h / 2, Math.max(k.w, k.h) * .55 + 20, GLOW, (dark ? .35 : .28) + pulse * .12, dark);
  ctx.lineJoin = 'round';
  for (let j = 0; j < n; j++) {
    const a = j * step, b = a + step, m = a + step / 2, jit = (hash(j + k.x) - .5) * 2;
    let pts;
    if (k.dir === 'up') pts = [k.x + a, k.y + k.h, k.x + m + jit, k.y, k.x + b, k.y + k.h];
    else if (k.dir === 'down') pts = [k.x + a, k.y, k.x + m + jit, k.y + k.h, k.x + b, k.y];
    else if (k.dir === 'left') pts = [k.x + k.w, k.y + a, k.x, k.y + m + jit, k.x + k.w, k.y + b];
    else pts = [k.x, k.y + a, k.x + k.w, k.y + m + jit, k.x, k.y + b];
    ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); ctx.lineTo(pts[2], pts[3]); ctx.lineTo(pts[4], pts[5]); ctx.closePath();
    ctx.fillStyle = body; ctx.fill(); ctx.strokeStyle = edge; ctx.lineWidth = 1.6; ctx.stroke();
    // the glowing tip: the outer 40% of the spike
    const tx = pts[2], ty = pts[3], f = .4;
    ctx.beginPath(); ctx.moveTo(tx, ty);
    ctx.lineTo(tx + (pts[0] - tx) * f, ty + (pts[1] - ty) * f); ctx.lineTo(tx + (pts[4] - tx) * f, ty + (pts[5] - ty) * f); ctx.closePath();
    ctx.fillStyle = DANGER; ctx.fill();
  }
  // a dark base bar with a danger stripe, so the strip reads as one hazard
  const base = {up: [k.x, k.y + k.h - 3, k.w, 3], down: [k.x, k.y, k.w, 3], left: [k.x + k.w - 3, k.y, 3, k.h], right: [k.x, k.y, 3, k.h]}[k.dir];
  rect(ctx, edge, ...base); rect(ctx, DANGER, base[0] + (along ? 0 : 1), base[1] + (along ? 1 : 0), along ? base[2] : 1, along ? 1 : base[3], .9);
}
