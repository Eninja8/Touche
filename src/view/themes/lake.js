// Frozen Lake: a winter valley. Far back: the sky (a pale sun, or stars and an aurora),
// snowy mountains, then pine forest on the far shore. Dead trees on the banks hold the
// frozen ropes over the crevasses; fishing huts stand on the ice; icicles hang under
// the rock overhangs; snow falls.

import {rect, line, poly, glow, hash, vgrad, particles} from '../paint.js';

function range(g, a, base, seed, step, minH, maxH, color, cap) {
  g.fillStyle = color; g.beginPath(); g.moveTo(a.x0, a.y1);
  const peaks = [];
  for (let x = a.x0, k = 0; x <= a.x1 + step; x += step, k++) { const y = base - minH - hash(seed + k) * (maxH - minH); g.lineTo(x, y); peaks.push([x, y]); }
  g.lineTo(a.x1, a.y1); g.closePath(); g.fill();
  if (cap) for (let k = 1; k < peaks.length - 1; k++) { const [x, y] = peaks[k]; if (y < peaks[k - 1][1] && y < peaks[k + 1][1]) poly(g, cap, [x - step * .35, y + step * .3, x, y, x + step * .35, y + step * .3, x + step * .12, y + step * .22, x - step * .1, y + step * .26]); }
}
function pine(g, x, base, h, color) { for (let k = 0; k < 3; k++) { const w = h * (.42 - k * .1), y = base - k * h * .28; poly(g, color, [x - w, y, x, y - h * .5, x + w, y]); } rect(g, color, x - 2, base, 4, 10); }

export default {
  pitColor: dark => dark ? '#06182a' : '#5d88a8',
  spikes: {fill: '#dff3ff', edge: '#7fb3d6', size: 11},
  ropeColor: null,
  layers: [
    { // sky: pale sun, or stars and an aurora
      depth: .08, res: .5,
      draw(g, map, a, dark) {
        vgrad(g, a.x0, a.y0, a.x1 - a.x0, a.y1 - a.y0, dark ? ['#03070f', '#081426', '#12233a', '#1b2f48'] : ['#a9c9e6', '#cfe1f0', '#e9f2f8', '#f4f8fb']);
        if (dark) {
          for (let k = 0; k < 170; k++) rect(g, '#ffffff', a.x0 + hash(k) * (a.x1 - a.x0), a.y0 + hash(k + 9) * 600, 1.5, 1.5, .3 + hash(k + 4) * .6);
          for (let b = 0; b < 3; b++) {
            g.globalAlpha = .16 - b * .04; g.strokeStyle = b === 1 ? '#7affc8' : '#4fe3a8'; g.lineWidth = 60 - b * 14; g.beginPath();
            for (let x = a.x0; x < a.x1; x += 40) g.lineTo(x, 150 + b * 40 + Math.sin(x / 210 + b) * 50 + Math.sin(x / 90) * 12);
            g.stroke();
          }
          g.globalAlpha = 1;
        } else { glow(g, 420, 170, 220, 'rgba(255,255,240,.9)', .9, false); g.fillStyle = '#fffdf2'; g.beginPath(); g.arc(420, 170, 40, 0, Math.PI * 2); g.fill(); }
      },
    },
    { depth: .25, res: .5, draw(g, map, a, dark) { range(g, a, 640, 3, 130, 160, 380, dark ? '#0e1a2b' : '#9db7cd', dark ? '#3a5270' : '#f6fafd'); } },
    { // near hills and pine forest on the far shore
      depth: .5, res: .75,
      draw(g, map, a, dark) {
        range(g, a, 700, 17, 90, 20, 90, dark ? '#0a1422' : '#7f9fb8', null);
        for (let x = a.x0, k = 0; x < a.x1; x += 22 + hash(k) * 20, k++) pine(g, x, 650 + hash(k + 5) * 30, 60 + hash(k + 7) * 70, dark ? '#07101b' : '#5b7d96');
        rect(g, dark ? '#1a2e45' : '#e6f0f7', a.x0, 690, a.x1 - a.x0, 20, .8); // the far shore's snow
      },
    },
  ],
  back(ctx, map, col, v, dark) {
    // dead trees on the banks, a branch out to each rope
    const bark = dark ? '#1c2533' : '#4b4740', snow = dark ? '#c9dcec' : '#ffffff';
    for (const r of map.ropes) {
      const tx = r.tree < 0 ? 250 : map.width - 250, d = -r.tree;
      line(ctx, bark, 16, [tx, 625, tx - d * 6, 420, tx + d * 4, 250]);
      line(ctx, bark, 9, [tx, 330, tx + d * 80, r.y0 - 4, r.x + d * 24, r.y0 - 2]);
      line(ctx, bark, 5, [tx - d * 4, 400, tx - d * 60, 330]); line(ctx, bark, 4, [tx + d * 4, 270, tx + d * 40, 200]);
      line(ctx, snow, 3, [tx + d * 6, 326, tx + d * 80, r.y0 - 8, r.x + d * 24, r.y0 - 6], .9);
    }
  },
  block(ctx, s, col, dark) {
    const rock = dark ? '#1b2533' : '#6f7e8c', rock2 = dark ? '#141c27' : '#5b6875', snow = dark ? '#c9dcec' : '#ffffff';
    if (s.look === 'ice') {
      const g = ctx.createLinearGradient(0, s.y, 0, s.y + s.h); g.addColorStop(0, dark ? '#3b6a8f' : '#cfe7f6'); g.addColorStop(.2, dark ? '#1f3850' : '#a9cde6'); g.addColorStop(1, dark ? '#0b1a2a' : '#6f9fc2');
      ctx.fillStyle = g; ctx.fillRect(s.x, s.y, s.w, s.h + 300);
      for (let k = 0; k < s.w / 40; k++) { const x = s.x + hash(k + s.x) * s.w; line(ctx, '#ffffff', 1, [x, s.y + 4, x + 20 + hash(k) * 30, s.y + 30 + hash(k + 2) * 60, x + 10, s.y + 90], .25); }
      for (let x = s.x + 30; x < s.x + s.w - 40; x += 90) rect(ctx, '#ffffff', x, s.y + 3, 40, 2, .5); // shine
      line(ctx, dark ? '#d8ecfa' : '#ffffff', 2.5, [s.x, s.y, s.x + s.w, s.y]); line(ctx, col.line, 1.5, [s.x, s.y + 1, s.x + s.w, s.y + 1], .4);
      return;
    }
    // rock (walls, overhangs) and snowy banks
    rect(ctx, rock, s.x, s.y, s.w, s.h + 300);
    for (let k = 0; k < s.w * s.h / 2500; k++) { const x = s.x + hash(k * 3 + s.x) * s.w, y = s.y + hash(k * 5 + s.y) * s.h; poly(ctx, rock2, [x, y, x + 26, y + 8, x + 8, y + 30], .7); }
    if (s.y > 0) { // a snow cap on any exposed top
      ctx.fillStyle = snow; ctx.beginPath(); ctx.moveTo(s.x - 4, s.y + 8);
      for (let x = s.x; x <= s.x + s.w; x += 20) ctx.lineTo(x, s.y - 4 - hash(x) * 5);
      ctx.lineTo(s.x + s.w + 4, s.y + 8); ctx.closePath(); ctx.fill();
      line(ctx, col.line, 2.5, [s.x, s.y, s.x + s.w, s.y], .7);
    }
    if (s.y === 0 && s.h < 400) { // the overhang's jagged underside
      ctx.fillStyle = rock; ctx.beginPath(); ctx.moveTo(s.x, s.y + s.h);
      for (let x = s.x; x <= s.x + s.w; x += 18) ctx.lineTo(x, s.y + s.h + (hash(x) > .5 ? 6 : 0));
      ctx.lineTo(s.x + s.w, s.y + s.h); ctx.fill();
    }
  },
  platform(ctx, p, col, dark) {
    const snow = dark ? '#c9dcec' : '#ffffff';
    if (p.look === 'hut') { // a fishing hut standing on the ice; its roof is the platform
      const wall = dark ? '#3a2a22' : '#9a5a3a', x0 = p.x + 18, x1 = p.x + p.w - 18;
      rect(ctx, wall, x0, p.y + 8, x1 - x0, 700 - p.y - 8);
      for (let x = x0; x < x1; x += 12) line(ctx, dark ? '#2a1d17' : '#7f4a30', 1.5, [x, p.y + 10, x, 700], .8);
      rect(ctx, dark ? '#1a120e' : '#5a3020', (x0 + x1) / 2 - 12, 700 - 64, 24, 64);
      rect(ctx, dark ? '#ffcf7a' : '#cfe7f6', x0 + 14, p.y + 40, 20, 16, dark ? .85 : 1);
      if (dark) glow(ctx, x0 + 24, p.y + 48, 50, 'rgba(255,190,110,.6)', .5, true);
      line(ctx, dark ? '#5a6a7a' : '#4a4a4a', 3, [x1 - 20, p.y + 8, x1 - 20, p.y - 30]); // stove pipe
    }
    rect(ctx, dark ? '#2f5470' : '#7a8a98', p.x, p.y, p.w, 10);
    ctx.fillStyle = snow; ctx.beginPath(); ctx.moveTo(p.x - 2, p.y + 4);
    for (let x = p.x; x <= p.x + p.w; x += 16) ctx.lineTo(x, p.y - 3 - hash(x + p.y) * 4);
    ctx.lineTo(p.x + p.w + 2, p.y + 4); ctx.closePath(); ctx.fill();
    line(ctx, col.line, 2, [p.x, p.y, p.x + p.w, p.y], .7);
  },
  front(ctx, map, col, v, dark, t) {
    particles(ctx, v, t, {n: 130, color: '#ffffff', size: 2.4, fall: 42, drift: 16, sway: 16, alpha: dark ? .6 : .85, depth: .85});
    particles(ctx, v, t + 30, {n: 40, color: '#ffffff', size: 4, fall: 70, drift: 24, sway: 22, alpha: dark ? .35 : .5, depth: 1.1});
  },
};
