// Rooftops: a city at sunset (light) or on a rainy night (dark). Far back: the sky with
// the sun or moon, then two layers of skyline (water towers, antennas, lit windows).
// A construction crane's jib runs across the top with chains hanging from it. Brick
// buildings with parapets, chimneys with spikes, fire escapes, and a neon billboard.

import {rect, line, poly, glow, hash, vgrad, particles} from '../paint.js';

function skyline(g, a, base, seed, minH, maxH, color, win, winA, detail) {
  for (let x = a.x0, k = 0; x < a.x1; k++) {
    const w = 46 + hash(seed + k) * 60, h = minH + hash(seed + k * 3) * (maxH - minH), top = base - h;
    rect(g, color, x, top, w - 4, a.y1 - top);
    if (detail && hash(seed + k * 5) > .6) { // water tower
      const cx = x + w / 2; rect(g, color, cx - 14, top - 34, 28, 22); poly(g, color, [cx - 16, top - 34, cx, top - 46, cx + 16, top - 34]);
      line(g, color, 2, [cx - 10, top - 12, cx - 12, top, cx + 10, top - 12, cx + 12, top]);
    } else if (detail && hash(seed + k * 7) > .7) line(g, color, 2, [x + w / 2, top, x + w / 2, top - 40]);
    for (let r = top + 10; r < base - 10; r += 16) for (let c = x + 6; c < x + w - 12; c += 11) if (hash(r * 13 + c * 7 + seed) > .62) rect(g, win, c, r, 5, 7, winA);
    x += w;
  }
}

export default {
  pitColor: dark => dark ? '#04050b' : '#3b2930',
  spikes: {fill: null, edge: null, size: 9},
  chainColor: null,
  layers: [
    { // sky, sun or moon, stars
      depth: .08, res: .5,
      draw(g, map, a, dark) {
        vgrad(g, a.x0, a.y0, a.x1 - a.x0, a.y1 - a.y0, dark ? ['#05070f', '#0b0f22', '#1b1f3a', '#2a2440'] : ['#f6d3a6', '#f4b48c', '#e48f7a', '#b7657a']);
        if (dark) {
          for (let k = 0; k < 160; k++) rect(g, '#ffffff', a.x0 + hash(k) * (a.x1 - a.x0), a.y0 + hash(k + 9) * 700, 1.6, 1.6, .3 + hash(k + 3) * .5);
          glow(g, 1320, 170, 160, 'rgba(200,210,255,.35)', 1, true);
          g.fillStyle = '#eef0f8'; g.beginPath(); g.arc(1320, 170, 38, 0, Math.PI * 2); g.fill();
          for (const [dx, dy, r] of [[-10, -8, 7], [12, 6, 5], [-4, 14, 4]]) { g.fillStyle = '#d4d8e6'; g.beginPath(); g.arc(1320 + dx, 170 + dy, r, 0, Math.PI * 2); g.fill(); }
        } else {
          glow(g, 1150, 560, 420, 'rgba(255,230,170,.7)', 1, false);
          g.fillStyle = '#ffe2a8'; g.beginPath(); g.arc(1150, 560, 90, 0, Math.PI * 2); g.fill();
          for (let k = 0; k < 5; k++) rect(g, '#f7c99a', a.x0, 200 + k * 46 + hash(k) * 20, a.x1 - a.x0, 6 + hash(k + 2) * 6, .35); // thin clouds
        }
      },
    },
    { depth: .25, res: .5, draw(g, map, a, dark) { skyline(g, a, 760, 11, 120, 330, dark ? '#10142a' : '#d89a88', dark ? '#ffd36b' : '#fff1d0', dark ? .35 : .3, false); } },
    { depth: .5, res: .75, draw(g, map, a, dark) { skyline(g, a, 860, 37, 120, 300, dark ? '#0b0e1f' : '#a9606c', dark ? '#ffd36b' : '#ffe6b0', dark ? .55 : .35, true); } },
  ],
  back(ctx, map, col, v, dark, t) {
    // the crane jib across the top: a lattice girder
    const c = dark ? '#3c4258' : '#4d3b3e', y = 0;
    rect(ctx, c, 260, y, map.width - 520, 5); rect(ctx, c, 260, y + 24, map.width - 520, 5);
    for (let x = 260; x < map.width - 270; x += 24) line(ctx, c, 2, [x, y + 5, x + 12, y + 24, x + 24, y + 5]);
    rect(ctx, '#f2a541', 400, y + 30, 60, 8, .8); rect(ctx, '#f2a541', map.width - 460, y + 30, 60, 8, .8); // trolleys over the chains
  },
  block(ctx, s, col, dark, map, t) {
    const brick = dark ? '#262b40' : '#8c5a52', brick2 = dark ? '#1d2133' : '#7a4b45', cap = dark ? '#454c66' : '#5c616c', win = dark ? '#ffd36b' : '#ffe6b0';
    if (s.look === 'chimney') {
      rect(ctx, brick, s.x, s.y, s.w, s.h);
      for (let y = s.y + 6; y < s.y + s.h; y += 10) line(ctx, brick2, 1, [s.x, y, s.x + s.w, y], .8);
      rect(ctx, cap, s.x - 5, s.y - 2, s.w + 10, 8);
      return;
    }
    const tower = s.look === 'tower';
    rect(ctx, brick, s.x, s.y, s.w, s.h + 300);
    for (let y = s.y + 14; y < s.y + s.h + 300; y += 12) line(ctx, brick2, 1, [s.x, y, s.x + s.w, y], .5);
    // windows (some lit)
    for (let r = s.y + (tower ? 40 : 34); r < s.y + s.h + 300; r += 52) for (let x = s.x + 18; x < s.x + s.w - 30; x += 46) {
      const lit = hash(r * 3 + x) > .55;
      rect(ctx, dark ? '#0a0c16' : '#4a2f33', x, r, 24, 30); if (lit) rect(ctx, win, x + 2, r + 2, 20, 26, dark ? .7 : .45);
      line(ctx, cap, 3, [x - 3, r + 32, x + 27, r + 32]);
    }
    // parapet cap along the top
    rect(ctx, cap, s.x - 6, s.y, s.w + 12, 10); line(ctx, col.line, 3, [s.x - 6, s.y, s.x + s.w + 6, s.y]);
    if (tower) { // antenna with a blinking light
      const ax = s.x + s.w / 2; line(ctx, cap, 3, [ax, s.y, ax, s.y - 90]); line(ctx, cap, 2, [ax - 16, s.y - 60, ax + 16, s.y - 60]);
      if (Math.sin(t * 3 + s.x) > .3) { glow(ctx, ax, s.y - 92, 26, 'rgba(255,60,50,.9)', .8, dark); rect(ctx, '#ff4b3e', ax - 3, s.y - 95, 6, 6); }
    }
  },
  platform(ctx, p, col, dark, t) {
    const metal = dark ? '#5a6280' : '#3e3a44';
    if (p.look === 'billboard') {
      const x0 = p.x + 20, x1 = p.x + p.w - 20, top = p.y - 175, bot = p.y - 30;
      for (const x of [x0 + 40, x1 - 40]) line(ctx, metal, 5, [x, bot, x, p.y]);
      rect(ctx, dark ? '#141826' : '#d9bfa6', x0, top, x1 - x0, bot - top); ctx.strokeStyle = metal; ctx.lineWidth = 5; ctx.strokeRect(x0, top, x1 - x0, bot - top);
      const on = !(Math.sin(t * 7) > .93 && Math.sin(t * 2.3) > .2); // the neon flickers now and then
      ctx.font = '900 52px "Big Shoulders Display", Impact, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const cx = (x0 + x1) / 2, cy = (top + bot) / 2, ink = on && dark ? '#ff7a6e' : dark ? '#5a2a2a' : '#a8463e';
      ctx.save(); if (on && dark) { ctx.shadowColor = '#ff5b50'; ctx.shadowBlur = 24; }
      ctx.fillStyle = ink; ctx.globalAlpha = dark ? 1 : .8; ctx.fillText('ESCRIME', cx + 30, cy + 4);
      ctx.strokeStyle = ink; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x0 + 40, cy + 26); ctx.lineTo(x0 + 120, cy - 26); ctx.moveTo(x0 + 36, cy + 8); ctx.lineTo(x0 + 56, cy + 30); ctx.stroke(); // a sword
      ctx.restore();
    }
    // a steel grating walkway with a railing
    rect(ctx, metal, p.x, p.y, p.w, 6);
    for (let x = p.x + 4; x < p.x + p.w; x += 8) line(ctx, dark ? '#2b3044' : '#26222a', 1, [x, p.y + 1, x, p.y + 6]);
    line(ctx, metal, 2, [p.x, p.y - 26, p.x + p.w, p.y - 26], .7);
    for (let x = p.x; x <= p.x + p.w; x += 32) line(ctx, metal, 2, [x, p.y, x, p.y - 26], .7);
    if (p.look === 'fire') line(ctx, metal, 3, [p.x + 10, p.y + 6, p.x + p.w - 10, p.y + 120], .8); // stairs down
    line(ctx, col.line, 2.5, [p.x, p.y, p.x + p.w, p.y]);
  },
  front(ctx, map, col, v, dark, t) {
    if (dark) particles(ctx, v, t, {n: 170, color: '#a9b8e8', size: 1.3, fall: 950, drift: -140, len: 16, alpha: .28, depth: .7});
    else particles(ctx, v, t, {n: 45, color: '#fff3d6', size: 2.2, fall: -8, drift: 22, sway: 20, alpha: .4, depth: .8});
  },
};
