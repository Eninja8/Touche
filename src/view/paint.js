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

// Ambient particles (snow, rain, embers, dust, petals) filling the visible area. Each
// particle's position comes from its index and the time, so nothing needs storing.
// o: {n, color, size, fall (px/s, negative rises), drift (sideways px/s), sway, alpha, depth, len (streaks)}
export function particles(ctx, v, t, o) {
  const w = v.x1 - v.x0 + 200, h = v.y1 - v.y0 + 200, depth = o.depth ?? .8;
  // anchored to the screen with a little parallax, so they don't jump when the camera moves
  const ax = v.x0 * depth, ay = v.y0 * depth;
  ctx.fillStyle = o.color; ctx.strokeStyle = o.color;
  for (let k = 0; k < o.n; k++) {
    const sp = .6 + hash(k * 3 + 1) * .8;
    let x = hash(k) * w + t * (o.drift || 0) * sp + Math.sin(t * (o.swayRate || 1.3) + k) * (o.sway || 0);
    let y = hash(k * 7 + 2) * h + t * o.fall * sp;
    x = ((x - ax) % w + w) % w + v.x0 - 100; y = ((y - ay) % h + h) % h + v.y0 - 100;
    const a = o.alpha * (o.twinkle ? .5 + .5 * Math.sin(t * 3 + k) : 1) * (o.life ? lifeFade(y, v, o.life) : 1);
    if (a <= 0) continue;
    ctx.globalAlpha = a;
    if (o.len) { ctx.lineWidth = o.size; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - (o.drift || 0) * .03, y - o.len * sp); ctx.stroke(); }
    else { const s = o.size * sp; ctx.fillRect(x - s / 2, y - s / 2, s, s); }
  }
  ctx.globalAlpha = 1;
}
// rising particles (embers) fade out toward the top of the view
const lifeFade = (y, v, life) => Math.max(0, Math.min(1, (y - v.y0) / ((v.y1 - v.y0) * life)));
