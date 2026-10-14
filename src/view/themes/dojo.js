// Dojo: a training hall. Far back, through the open middle screens: a garden with a
// pagoda, misty mountains and cherry trees (a big moon at night). Nearer: the paper
// screen wall with scrolls and a weapon rack. Paper lanterns sway under the beams,
// petals drift in. Polished plank floor, walkways with railings, bamboo-spike traps.

import {rect, line, poly, glow, hash, vgrad, particles} from '../paint.js';

const OPEN = [520, 1080]; // the screens slid open in the middle of the back wall

function blossomTree(g, x, base, h, dark) {
  const bark = dark ? '#1a1214' : '#5a3f36', pink = dark ? '#7a4a63' : '#f4b6c8';
  line(g, bark, 10, [x, base, x - 8, base - h * .5, x + 6, base - h]); line(g, bark, 5, [x - 6, base - h * .55, x - 50, base - h * .8]); line(g, bark, 5, [x + 2, base - h * .7, x + 52, base - h * .9]);
  for (let k = 0; k < 26; k++) { const a = hash(x + k) * Math.PI * 2, r = hash(x + k * 3) * h * .45; g.fillStyle = pink; g.globalAlpha = .75; g.beginPath(); g.arc(x + Math.cos(a) * r * 1.3, base - h * .85 + Math.sin(a) * r * .6, 14 + hash(k) * 12, 0, Math.PI * 2); g.fill(); }
  g.globalAlpha = 1;
}

export default {
  pitColor: dark => dark ? '#0d0906' : '#3a2a1a',
  spikes: {fill: '#c9b46a', edge: '#5a4a1f', size: 9},
  ropeColor: null,
  layers: [
    { // the garden outside
      depth: .15, res: .5,
      draw(g, map, a, dark) {
        vgrad(g, a.x0, a.y0, a.x1 - a.x0, a.y1 - a.y0, dark ? ['#0a0d1c', '#151a30', '#2a2438'] : ['#f6dfb8', '#f8ecd6', '#efe2c8']);
        if (dark) { glow(g, 800, 260, 200, 'rgba(255,240,210,.45)', 1, true); g.fillStyle = '#f4ecd8'; g.beginPath(); g.arc(800, 260, 70, 0, Math.PI * 2); g.fill(); }
        else { g.fillStyle = '#e8573f'; g.globalAlpha = .85; g.beginPath(); g.arc(800, 280, 64, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1; }
        g.fillStyle = dark ? '#151a2c' : '#d8c6ad'; g.beginPath(); g.moveTo(a.x0, 620); for (let x = a.x0; x <= a.x1; x += 120) g.lineTo(x, 470 - hash(x) * 140); g.lineTo(a.x1, 620); g.fill();
        // pagoda
        const px = 1020, pc = dark ? '#0d0f1a' : '#7a4a3a';
        for (let k = 0; k < 4; k++) { const y = 560 - k * 62, w = 90 - k * 14; rect(g, pc, px - w * .4, y - 40, w * .8, 40); poly(g, pc, [px - w, y - 40, px + w, y - 40, px + w * .6, y - 58, px - w * .6, y - 58]); }
        line(g, pc, 4, [px, 560 - 4 * 62 - 58, px, 560 - 4 * 62 - 100]);
        rect(g, dark ? '#10131f' : '#c9b490', a.x0, 600, a.x1 - a.x0, a.y1 - 600);
        for (const [x, h] of [[560, 300], [700, 240], [1220, 280], [380, 260]]) blossomTree(g, x, 640, h, dark);
      },
    },
    { // the back wall: paper screens (open in the middle), scrolls, a weapon rack
      depth: .6, res: .75,
      draw(g, map, a, dark) {
        const paper = dark ? '#2c241b' : '#f7f0e1', wood = dark ? '#3b2a1a' : '#8a6237';
        for (let x = Math.floor(a.x0 / 70) * 70; x < a.x1; x += 70) {
          if (x >= OPEN[0] && x < OPEN[1]) continue;
          rect(g, paper, x, 110, 70, 630);
          for (let y = 150; y < 740; y += 48) line(g, wood, 1.5, [x, y, x + 70, y], .5);
          line(g, wood, 1.5, [x + 35, 110, x + 35, 740], .4); line(g, wood, 4, [x, 110, x, 740], .9);
        }
        line(g, wood, 6, [OPEN[0], 110, OPEN[0], 740]); line(g, wood, 6, [OPEN[1], 110, OPEN[1], 740]);
        rect(g, wood, a.x0, 690, a.x1 - a.x0, 50); // low wall under the screens
        for (const x of [180, 1400]) { // hanging scrolls
          rect(g, dark ? '#d9cdb4' : '#fbf6ea', x - 30, 220, 60, 200); rect(g, wood, x - 36, 214, 72, 8); rect(g, wood, x - 36, 418, 72, 8);
          for (let k = 0; k < 4; k++) line(g, '#1b1410', 5, [x - 8 + hash(x + k) * 16, 250 + k * 40, x + hash(x + k * 2) * 10, 270 + k * 40, x - 6, 280 + k * 40], .85);
        }
        for (let k = 0; k < 5; k++) line(g, wood, 4, [380 + k * 22, 480, 380 + k * 22, 680]); // weapon rack
        line(g, wood, 6, [360, 520, 490, 520]); line(g, wood, 6, [360, 640, 490, 640]);
      },
    },
  ],
  back(ctx, map, col, v, dark, t) {
    for (const x of [300, 800, 1300]) { // paper lanterns under the beams
      const sway = Math.sin(t * 1.3 + x) * 4, y = 210;
      line(ctx, dark ? '#6b4c2c' : '#3b2a1a', 2, [x, 110, x + sway, y - 26]);
      glow(ctx, x + sway, y, dark ? 120 : 60, 'rgba(255,170,90,.7)', dark ? .6 : .3, dark);
      ctx.fillStyle = col.accent; ctx.beginPath(); ctx.ellipse(x + sway, y, 16, 24, 0, 0, Math.PI * 2); ctx.fill();
      for (const dy of [-12, 0, 12]) line(ctx, '#2b1d10', 1, [x + sway - 15, y + dy, x + sway + 15, y + dy], .4);
      rect(ctx, '#2b1d10', x + sway - 9, y - 27, 18, 5); rect(ctx, '#2b1d10', x + sway - 9, y + 22, 18, 5);
    }
  },
  block(ctx, s, col, dark) {
    const wood = dark ? '#4a3620' : '#c9a46b', wood2 = dark ? '#3b2a1a' : '#a8814e', dk = dark ? '#2a1d10' : '#6b4a28';
    if (s.look === 'ceiling') {
      rect(ctx, dk, s.x - 400, s.y - 400, s.w + 800, s.h + 400);
      rect(ctx, wood2, s.x, s.y + s.h - 22, s.w, 22);
      for (let x = s.x + 40; x < s.x + s.w; x += 160) rect(ctx, wood2, x, s.y, 24, s.h);
      return;
    }
    if (s.look === 'pillar') {
      rect(ctx, wood2, s.x, s.y, s.w, s.h); rect(ctx, dk, s.x, s.y, 4, s.h, .6);
      for (const y of [s.y + 40, s.y + s.h - 30]) for (let k = 0; k < 4; k++) line(ctx, '#d9c79a', 2, [s.x - 2, y + k * 4, s.x + s.w + 2, y + k * 4 + 2]);
      rect(ctx, dk, s.x - 4, s.y + s.h - 8, s.w + 8, 8);
      return;
    }
    if (s.look === 'walkway') {
      rect(ctx, wood2, s.x, s.y, s.w, s.h); rect(ctx, wood, s.x, s.y, s.w, 6);
      line(ctx, dk, 3, [s.x, s.y - 30, s.x + s.w, s.y - 30], .9);
      for (let x = s.x + 10; x < s.x + s.w; x += 30) line(ctx, dk, 3, [x, s.y, x, s.y - 30], .9);
      const bx = s.x < 400 ? s.x + s.w - 60 : s.x + 20; rect(ctx, col.accent, bx, s.y + s.h, 40, 70, .9); // banner
      line(ctx, col.line, 2.5, [s.x, s.y, s.x + s.w, s.y]);
      return;
    }
    if (s.h > 400) { rect(ctx, dk, s.x, s.y, s.w, s.h); for (let y = s.y; y < s.y + s.h; y += 120) rect(ctx, wood2, s.x, y, s.w, 10); return; } // walls
    // the floor: polished planks
    rect(ctx, wood, s.x, s.y, s.w, s.h + 300);
    for (let y = s.y + 14; y < s.y + s.h + 300; y += 14) line(ctx, wood2, 1, [s.x, y, s.x + s.w, y], .6);
    for (let k = 0; k < s.w / 70; k++) { const x = s.x + hash(k + s.x) * s.w, y = s.y + 14 * (1 + Math.floor(hash(k * 3) * 8)); line(ctx, wood2, 1.5, [x, y - 14, x, y], .7); }
    rect(ctx, '#ffffff', s.x, s.y + 2, s.w, 3, dark ? .06 : .25);
    line(ctx, col.line, 3, [s.x, s.y, s.x + s.w, s.y]);
  },
  platform(ctx, p, col, dark) {
    const wood = dark ? '#6b4c2c' : '#8a6237';
    rect(ctx, wood, p.x, p.y, p.w, 9);
    for (const x of [p.x + 14, p.x + p.w - 14]) poly(ctx, wood, [x - 5, p.y + 9, x + 5, p.y + 9, x, p.y + 28]);
    line(ctx, col.line, 2.5, [p.x, p.y, p.x + p.w, p.y]);
  },
  front(ctx, map, col, v, dark, t) {
    ctx.save();
    for (const [k, c] of [[0, dark ? '#c07a98' : '#f6a9c0'], [1, dark ? '#a8607e' : '#f08aa8']]) particles(ctx, v, t + k * 40, {n: 30, color: c, size: 4, fall: 34, drift: 30, sway: 26, swayRate: 1.7, alpha: .8, depth: .85 + k * .1});
    ctx.restore();
    particles(ctx, v, t, {n: 40, color: dark ? '#e8d7b0' : '#fff6dd', size: 1.6, fall: 4, drift: 6, sway: 10, alpha: .3, twinkle: true});
  },
};
