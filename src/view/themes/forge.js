// Forge: a foundry hall. Far back: a brick wall with tall arched windows and great
// gears; nearer, pipes, smokestacks and a flywheel. A furnace roars behind the
// catwalk, the slag pits glow, embers drift up. Iron floor plates with hazard
// stripes, steel girders, anvils, crane chains with hooks.

import {rect, line, poly, glow, hash, vgrad, particles} from '../paint.js';

function gear(g, x, y, r, teeth, color) {
  g.fillStyle = color; g.beginPath();
  for (let k = 0; k < teeth * 2; k++) { const a = k / (teeth * 2) * Math.PI * 2, rr = k % 2 ? r : r * 1.14; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  g.closePath(); g.fill();
  g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.arc(x, y, r * .35, 0, Math.PI * 2); g.fill();
}

export default {
  chainColor: null,
  layers: [
    { // back wall: bricks, arched windows, gears
      depth: .25, res: .5,
      draw(g, map, a, dark) {
        vgrad(g, a.x0, a.y0, a.x1 - a.x0, a.y1 - a.y0, dark ? ['#120a08', '#1d0f0b', '#2b1510'] : ['#d8bfa6', '#cfa585', '#b98a6a']);
        for (let r = Math.floor(a.y0 / 22); r * 22 < a.y1; r++) for (let c = Math.floor(a.x0 / 44) - 1; c * 44 < a.x1; c++) rect(g, dark ? '#3a1d14' : '#a8775a', c * 44 + (r % 2) * 22 + 1, r * 22 + 1, 41, 19, .25 + hash(r * 40 + c) * .25);
        for (const x of [230, 650, 1050, 1470]) {
          g.fillStyle = dark ? '#2a1a2a' : '#f7d9a8'; g.beginPath(); g.moveTo(x - 70, 520); g.lineTo(x - 70, 200); g.arc(x, 200, 70, Math.PI, 0); g.lineTo(x + 70, 520); g.fill();
          for (let k = -2; k <= 2; k++) line(g, dark ? '#120a08' : '#7a5340', 4, [x + k * 28, 140, x + k * 28, 520]);
          for (let y = 220; y < 520; y += 60) line(g, dark ? '#120a08' : '#7a5340', 4, [x - 70, y, x + 70, y]);
        }
        gear(g, 420, 140, 90, 12, dark ? '#24140f' : '#9c6e52'); gear(g, 1290, 120, 70, 10, dark ? '#24140f' : '#9c6e52'); gear(g, 1390, 230, 46, 8, dark ? '#24140f' : '#9c6e52');
      },
    },
    { // machinery: pipes, stacks, flywheel
      depth: .55, res: .75,
      draw(g, map, a, dark) {
        const m = dark ? '#160c09' : '#7d5845', hi = dark ? '#3a2219' : '#a77d63';
        for (const [x, w, top] of [[120, 60, 60], [map.width - 180, 60, 90], [740, 40, 0]]) { rect(g, m, x, top, w, map.height); rect(g, hi, x + 6, top, 6, map.height, .6); for (let y = top + 40; y < map.height; y += 90) rect(g, m, x - 6, y, w + 12, 10); }
        for (const y of [190, 640]) { rect(g, m, a.x0, y, a.x1 - a.x0, 18); rect(g, hi, a.x0, y + 3, a.x1 - a.x0, 3, .6); for (let x = 0; x < map.width; x += 160) rect(g, m, x, y - 5, 14, 28); }
        g.strokeStyle = m; g.lineWidth = 14; g.beginPath(); g.arc(map.width - 380, 470, 110, 0, Math.PI * 2); g.stroke();
        for (let k = 0; k < 6; k++) { const an = k / 6 * Math.PI * 2; line(g, m, 8, [map.width - 380, 470, map.width - 380 + Math.cos(an) * 110, 470 + Math.sin(an) * 110]); }
      },
    },
  ],
  back(ctx, map, col, v, dark, t) {
    const cx = map.width / 2, F = 780, glowA = .75 + Math.sin(t * 3.1) * .08 + Math.sin(t * 7.3) * .04;
    // the great furnace behind the catwalk
    glow(ctx, cx, F - 110, 380, 'rgba(255,120,30,.8)', glowA * (dark ? .55 : .35), dark);
    ctx.fillStyle = dark ? '#120806' : '#3a2620'; ctx.beginPath(); ctx.roundRect(cx - 120, F - 260, 240, 260, [110, 110, 0, 0]); ctx.fill();
    rect(ctx, dark ? '#120806' : '#3a2620', cx - 40, 40, 80, F - 300);
    ctx.fillStyle = col.accent; ctx.globalAlpha = glowA; ctx.beginPath(); ctx.roundRect(cx - 86, F - 190, 172, 190, [86, 86, 0, 0]); ctx.fill(); ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffd27a'; ctx.globalAlpha = glowA * .8; ctx.beginPath(); ctx.roundRect(cx - 50, F - 120, 100, 120, [50, 50, 0, 0]); ctx.fill(); ctx.globalAlpha = 1;
    for (let k = -3; k <= 3; k++) line(ctx, dark ? '#120806' : '#3a2620', 5, [cx + k * 24, F - 180, cx + k * 24, F]);
    // the slag pits glow from below
    for (const p of map.pits) glow(ctx, p.x + p.w / 2, p.y + p.d, 170, 'rgba(255,110,20,.9)', (dark ? .7 : .45) * glowA, dark);
  },
  block(ctx, s, col, dark) {
    const iron = dark ? '#3a2a24' : '#6d5a4f', iron2 = dark ? '#2a1d18' : '#57463d', rivet = dark ? '#6b5249' : '#8d786b';
    if (s.look === 'anvil') {
      const x = s.x, y = s.y, w = s.w, h = s.h, c = dark ? '#2b2b30' : '#33333a';
      poly(ctx, c, [x - 16, y, x + w + 4, y, x + w, y + 12, x + w - 8, y + 16, x + 10, y + 16, x + 2, y + 12, x - 16, y + 4]);
      rect(ctx, c, x + 12, y + 16, w - 24, h - 26); rect(ctx, c, x + 2, y + h - 10, w - 4, 10);
      line(ctx, dark ? '#8a8a94' : '#9a9aa4', 2, [x - 14, y + 1, x + w + 2, y + 1]);
      return;
    }
    if (s.look === 'catwalk' || s.look === 'ceiling') {
      rect(ctx, iron2, s.x, s.y, s.w, s.h + (s.look === 'ceiling' ? 0 : 0));
      if (s.look === 'ceiling') rect(ctx, iron2, s.x - 400, s.y - 400, s.w + 800, 400);
      const y0 = s.y + s.h, d = s.look === 'ceiling' ? 30 : 24;
      line(ctx, iron2, 4, [s.x, y0 + d, s.x + s.w, y0 + d]);
      for (let x = s.x; x < s.x + s.w; x += 30) line(ctx, iron2, 2.5, [x, y0, x + 15, y0 + d, x + 30, y0]);
      if (s.look === 'catwalk') { line(ctx, col.line, 3, [s.x, s.y, s.x + s.w, s.y]); for (let x = s.x + 10; x < s.x + s.w; x += 40) rect(ctx, rivet, x, s.y + 8, 3, 3); }
      return;
    }
    // walls and floor: iron plates with rivets; hazard stripes at pit edges
    rect(ctx, s.h > 400 ? iron2 : iron, s.x, s.y, s.w, s.h + 300);
    for (let x = s.x; x < s.x + s.w; x += 80) { line(ctx, iron2, 2, [x, s.y, x, s.y + s.h + 300], .8); for (let y = s.y + 8; y < s.y + 60; y += 24) rect(ctx, rivet, x + 6, y, 3, 3); }
    if (s.h < 400) {
      rect(ctx, rivet, s.x, s.y, s.w, 4, .7);
      for (const p of [s.x, s.x + s.w - 40]) for (let k = 0; k < 4; k++) poly(ctx, '#e8b423', [p + k * 10, s.y + 4, p + k * 10 + 6, s.y + 4, p + k * 10 + 2, s.y + 12, p + k * 10 - 4, s.y + 12], .8);
      line(ctx, col.line, 3, [s.x, s.y, s.x + s.w, s.y]);
    }
  },
  platform(ctx, p, col, dark) {
    const iron = dark ? '#55403a' : '#4a3b33';
    rect(ctx, iron, p.x, p.y, p.w, 10);
    for (let x = p.x + 8; x < p.x + p.w; x += 30) rect(ctx, dark ? '#8a6c60' : '#7a685c', x, p.y + 3, 3, 3);
    for (const x of [p.x + 16, p.x + p.w - 16]) poly(ctx, iron, [x - 6, p.y + 10, x + 6, p.y + 10, x, p.y + 34]);
    line(ctx, col.line, 2.5, [p.x, p.y, p.x + p.w, p.y]);
  },
  front(ctx, map, col, v, dark, t) {
    particles(ctx, v, t, {n: 70, color: col.accent, size: 2.6, fall: -70, drift: 8, sway: 18, alpha: .85, life: 7, depth: .9});
    particles(ctx, v, t + 50, {n: 16, color: '#ffe08a', size: 1.8, fall: -160, drift: -20, sway: 30, alpha: .9, life: 2.5, depth: .95});
  },
};
