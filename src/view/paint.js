// Drawing helpers shared by the map painters (src/view/themes/): shapes, glows,
// parallax background layers and drifting ambient particles. Purely cosmetic.

import {cam} from './camera.js';

// A fixed "random" number in 0..1 for each n (the same every frame).
export const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

export function rect(ctx, c, x, y, w, h, a = 1) { ctx.globalAlpha = a; ctx.fillStyle = c; ctx.fillRect(x, y, w, h); ctx.globalAlpha = 1; }
export function line(ctx, c, w, pts, a = 1) {
  ctx.globalAlpha = a; ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
  for (let k = 2; k < pts.length; k += 2) ctx.lineTo(pts[k], pts[k + 1]);
  ctx.stroke(); ctx.globalAlpha = 1;
}
export function poly(ctx, c, pts, a = 1) {
  ctx.globalAlpha = a; ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
  for (let k = 2; k < pts.length; k += 2) ctx.lineTo(pts[k], pts[k + 1]);
  ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
}
export function vgrad(ctx, x, y, w, h, stops) {
  const g = ctx.createLinearGradient(0, y, 0, y + h); stops.forEach((c, k) => g.addColorStop(k / (stops.length - 1), c));
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
}

// A soft round light. In dark mode lights add up ('lighter'); in light mode they just tint.
export function glow(ctx, x, y, r, color, a, dark) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save(); ctx.globalCompositeOperation = dark ? 'lighter' : 'source-over'; ctx.globalAlpha = a;
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore();
}

// Parallax layers. Each is drawn once into an off-screen canvas, then placed every frame
// shifted by how far the camera is from the map's centre, times (1 - depth): depth 1 moves
// with the arena, depth 0.2 is far away and barely moves. res < 1 draws far layers at lower
// resolution (they're meant to look soft). Only the current map's layers are kept.
let cacheKey = '', cache = new Map();
export function parallax(ctx, key, map, layer, idx) {
  if (key !== cacheKey) { cacheKey = key; cache = new Map(); }
  let c = cache.get(idx);
  const mx = Math.round(map.width * (1 - layer.depth) * .6 + 500), my = Math.round(map.height * (1 - layer.depth) * .6 + 400), res = layer.res || 1;
  if (!c) {
    c = document.createElement('canvas'); c.width = Math.ceil((map.width + mx * 2) * res); c.height = Math.ceil((map.height + my * 2) * res);
    const g = c.getContext('2d'); g.setTransform(res, 0, 0, res, mx * res, my * res);
    layer.draw(g, map, {x0: -mx, y0: -my, x1: map.width + mx, y1: map.height + my});
    cache.set(idx, c);
  }
  const k = 1 - layer.depth, sx = (cam.x - map.width / 2) * k, sy = (cam.y - map.height / 2) * k * .6;
  ctx.drawImage(c, sx - mx, sy - my, map.width + mx * 2, map.height + my * 2);
}

// Ambient particles (snow, rain, embers, dust, petals). Each layer is an endless pattern
// of fixed-size tiles laid over the world, like wallpaper: a particle's place in its tile
// comes from its index and the time (so nothing needs storing), and the pattern repeats
// wherever the camera looks. The tiles never change size, so zooming just shows more or
// fewer of them at the same density, and nothing pops in or jumps.
// The pattern shifts with the camera like a parallax layer (same rule as above): depth 1
// sits in the world, below 1 lags behind (farther away), above 1 moves ahead (nearer).
// Movement depends only on the clock, so it looks the same at any frame rate.
// o: {n (per tile), color, size, fall (px/s, negative rises), drift (sideways px/s), sway,
//     swayRate, alpha, depth, len (streaks), twinkle, life (seconds each one glows, then fades)}
const TILE_W = 1160, TILE_H = 740;
export function particles(ctx, v, t, o) {
  const k = 1 - (o.depth ?? .8), map = particleMap;
  const ox = map ? (cam.x - map.width / 2) * k : 0, oy = map ? (cam.y - map.height / 2) * k * .6 : 0;
  const m = 30 + (o.len || 0) + (o.size || 0) * 2, drift = o.drift || 0;
  ctx.fillStyle = o.color; ctx.strokeStyle = o.color; if (o.len) ctx.lineWidth = o.size;
  for (let i = 0; i < o.n; i++) {
    const sp = .6 + hash(i * 3 + 1) * .8;
    let a = o.alpha * (o.twinkle ? .5 + .5 * Math.sin(t * 3 + i) : 1);
    if (o.life) { const p = frac(t / o.life + hash(i * 5 + 3)); a *= Math.min(1, p / .15) * (1 - p); }
    if (a <= .01) continue;
    // its place in the tile, then every copy of it that's on screen
    const px = wrap(hash(i) * TILE_W + t * drift * sp + Math.sin(t * (o.swayRate || 1.3) + i) * (o.sway || 0), TILE_W) + ox;
    const py = wrap(hash(i * 7 + 2) * TILE_H + t * o.fall * sp, TILE_H) + oy;
    const x0 = px + Math.ceil((v.x0 - m - px) / TILE_W) * TILE_W, y0 = py + Math.ceil((v.y0 - m - py) / TILE_H) * TILE_H;
    ctx.globalAlpha = a;
    for (let y = y0; y < v.y1 + m; y += TILE_H) for (let x = x0; x < v.x1 + m; x += TILE_W) {
      if (o.len) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - drift * .03, y - o.len * sp); ctx.stroke(); }
      else { const s = o.size * sp; ctx.fillRect(x - s / 2, y - s / 2, s, s); }
    }
  }
  ctx.globalAlpha = 1;
}
const frac = x => x - Math.floor(x), wrap = (x, w) => ((x % w) + w) % w;
// the map being drawn (set by backdrops.js), so particles can follow the parallax rule
let particleMap = null;
export const setParticleMap = map => { particleMap = map; };
