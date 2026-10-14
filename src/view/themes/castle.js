// Great Hall: a castle hall. Far back: a masonry wall with tall pointed windows (moonlit
// at night) and a great tapestry of crossed swords. Nearer: columns and arches with
// pennants. Torches flicker on the walls, chandeliers glow (arena.js), dust drifts in
// the light. Stone floors, a vaulted ceiling, balconies with balustrades, wooden galleries.

import {rect, line, poly, glow, hash, vgrad, particles} from '../paint.js';

const WINDOWS = [250, 640, 1120, 1510];
const stone = dark => dark ? ['#191a24', '#1f1f2b', '#262532'] : ['#cfc6b6', '#c4baa8', '#b5aa96'];

// a pointed (gothic) arch shape from (x, top) w wide down to y bottom
function arch(ctx, x, top, w, bottom) {
  ctx.beginPath(); ctx.moveTo(x, bottom); ctx.lineTo(x, top + w * .55);
  ctx.quadraticCurveTo(x, top, x + w / 2, top); ctx.quadraticCurveTo(x + w, top, x + w, top + w * .55);
  ctx.lineTo(x + w, bottom); ctx.closePath();
}

function masonry(g, a, dark, rowH, colW, alpha) {
  for (let r = Math.floor(a.y0 / rowH); r * rowH < a.y1; r++) for (let c = Math.floor(a.x0 / colW) - 1; c * colW < a.x1; c++) {
    const x = c * colW + (r % 2) * colW / 2, y = r * rowH, h = hash(r * 91 + c);
    rect(g, dark ? '#000' : '#fff', x + 2, y + 2, colW - 4, rowH - 4, alpha * (.3 + h * .7));
  }
}

export default {
  chainColor: null,
  layers: [
    { // the far wall: masonry, windows, the great tapestry
      depth: .3, res: .5,
      draw(g, map, a, dark) {
        const s = stone(dark); vgrad(g, a.x0, a.y0, a.x1 - a.x0, a.y1 - a.y0, [s[0], s[1], s[2]]);
        masonry(g, a, dark, 46, 120, dark ? .25 : .12);
        for (const wx of WINDOWS) {
          arch(g, wx - 60, 120, 120, 470); g.fillStyle = dark ? '#0b1430' : '#dfe9f2'; g.fill();
          const sky = g.createLinearGradient(0, 120, 0, 470); sky.addColorStop(0, dark ? '#24386b' : '#a9c7e3'); sky.addColorStop(1, dark ? '#0b1430' : '#eef3f6');
          g.fillStyle = sky; g.globalAlpha = .9; g.fill(); g.globalAlpha = 1;
          // stained glass: a few coloured panes near the top
          for (let k = 0; k < 9; k++) { const x = wx - 44 + (k % 3) * 30, y = 190 + Math.floor(k / 3) * 34; rect(g, ['#c0392b', '#2e5aa8', '#d9a520'][Math.floor(hash(wx + k) * 3)], x, y, 26, 30, dark ? .35 : .3); }
          line(g, dark ? '#0a0b10' : '#6b6152', 5, [wx, 140, wx, 470]); line(g, dark ? '#0a0b10' : '#6b6152', 4, [wx - 60, 330, wx + 60, 330]);
          g.strokeStyle = dark ? '#3a3a48' : '#8f8571'; g.lineWidth = 10; arch(g, wx - 60, 120, 120, 470); g.stroke();
          rect(g, dark ? '#2c2c38' : '#9e937e', wx - 74, 470, 148, 14);
        }
        // the tapestry: crimson, gold trim, two crossed swords
        const tx = map.width / 2;
        rect(g, dark ? '#4a1214' : '#9b2622', tx - 110, 70, 220, 380); rect(g, dark ? '#8a6a22' : '#d4a835', tx - 110, 70, 220, 10); rect(g, dark ? '#8a6a22' : '#d4a835', tx - 110, 70, 8, 380); rect(g, dark ? '#8a6a22' : '#d4a835', tx + 102, 70, 8, 380);
        for (let k = 0; k < 11; k++) poly(g, dark ? '#4a1214' : '#9b2622', [tx - 110 + k * 20, 450, tx - 100 + k * 20, 470, tx - 90 + k * 20, 450]);
        for (const d of [-1, 1]) { line(g, dark ? '#c9c2b5' : '#efe9dc', 6, [tx - 70 * d, 380, tx + 60 * d, 150]); line(g, dark ? '#c9a54a' : '#e6c15a', 6, [tx - 82 * d, 352, tx - 48 * d, 372]); }
        g.fillStyle = dark ? '#c9a54a' : '#e6c15a'; g.beginPath(); g.arc(tx, 265, 26, 0, Math.PI * 2); g.fill();
        g.fillStyle = dark ? '#4a1214' : '#9b2622'; g.font = '900 30px "Big Shoulders Display", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('T', tx, 267);
      },
    },
    { // columns and arches in between, with pennants
      depth: .6, res: .75,
      draw(g, map, a, dark) {
        const c = dark ? '#121219' : '#a99f8c', edge = dark ? '#2a2a36' : '#c9c0ad';
        for (const x of [-60, 440, map.width / 2 - 360, map.width / 2 + 330, map.width - 470, map.width + 30]) {
          rect(g, c, x, 0, 30, map.height); rect(g, edge, x, 0, 4, map.height, .6);
          rect(g, c, x - 8, 150, 46, 18); rect(g, c, x - 8, map.height - 200, 46, 24);
        }
        g.strokeStyle = c; g.lineWidth = 22;
        for (const [x0, x1] of [[-30, 455], [455, map.width / 2 - 345], [map.width / 2 + 345, map.width - 455], [map.width - 455, map.width + 45]]) { g.beginPath(); g.moveTo(x0, 160); g.quadraticCurveTo((x0 + x1) / 2, 40, x1, 160); g.stroke(); }
        for (const x of [212, 640, 1120, 1548]) {
          poly(g, dark ? '#3a0f12' : '#a3302a', [x - 16, 60, x + 16, 60, x + 16, 230, x, 210, x - 16, 230], .9);
          rect(g, dark ? '#7a5d1e' : '#d4a835', x - 16, 60, 32, 5);
        }
      },
    },
  ],
  back(ctx, map, col, v, dark, t) {
    // wall torches
    for (const [x, y] of [[62, 400], [map.width - 62, 400], [540, 610], [1220, 610]]) {
      rect(ctx, dark ? '#3a2b1f' : '#5a4430', x - 3, y, 6, 26); rect(ctx, dark ? '#4a3a2a' : '#6b5238', x - 8, y - 4, 16, 6);
      const f = 1 + Math.sin(t * 11 + x) * .12 + Math.sin(t * 17 + x * 2) * .08;
      glow(ctx, x, y - 14, (dark ? 150 : 70) * f, dark ? 'rgba(255,150,60,.6)' : 'rgba(255,170,80,.45)', dark ? .6 : .35, dark);
      ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.ellipse(x, y - 14, 6, 12 * f, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff2c4'; ctx.beginPath(); ctx.ellipse(x, y - 11, 2.5, 6 * f, 0, 0, Math.PI * 2); ctx.fill();
    }
    // moonbeams (night) or sunbeams (day) slanting down from the windows
    ctx.save(); ctx.globalCompositeOperation = dark ? 'lighter' : 'source-over';
    for (const wx of WINDOWS) poly(ctx, dark ? '#6f8fd8' : '#fff6d8', [wx - 50, 160, wx + 50, 160, wx + 260, map.height - 150, wx + 80, map.height - 150], dark ? .05 : .16);
    ctx.restore();
  },
  block(ctx, s, col, dark) {
    const [s0, s1, s2] = stone(dark), mortar = dark ? '#0c0c12' : '#8d826e';
    if (s.look === 'ceiling') {
      rect(ctx, s0, s.x - 400, s.y - 400, s.w + 800, s.h + 400);
      for (let x = s.x; x < s.x + s.w; x += 220) { ctx.strokeStyle = s2; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(x, s.y + s.h); ctx.quadraticCurveTo(x + 110, s.y + s.h + 46, x + 220, s.y + s.h); ctx.stroke(); }
      line(ctx, col.line, 3, [s.x, s.y + s.h, s.x + s.w, s.y + s.h], .7);
      return;
    }
    if (s.look === 'balcony') {
      rect(ctx, s2, s.x, s.y, s.w, s.h); rect(ctx, s1, s.x, s.y, s.w, 6);
      for (let x = s.x + 14; x < s.x + s.w - 6; x += 18) { ctx.fillStyle = s2; ctx.beginPath(); ctx.ellipse(x, s.y - 13, 4, 11, 0, 0, Math.PI * 2); ctx.fill(); }
      rect(ctx, s1, s.x, s.y - 30, s.w, 6);
      const sx = s.x < 400 ? s.x + s.w - 30 : s.x + 30; // corbel under the open end
      poly(ctx, s2, [sx - 22, s.y + s.h, sx + 22, s.y + s.h, sx, s.y + s.h + 46]);
      line(ctx, col.line, 2.5, [s.x, s.y, s.x + s.w, s.y]);
      return;
    }
    if (s.look === 'pedestal') {
      rect(ctx, s2, s.x - 4, s.y, s.w + 8, 10); rect(ctx, s1, s.x, s.y + 10, s.w, s.h - 20); rect(ctx, s2, s.x - 6, s.y + s.h - 12, s.w + 12, 12);
      line(ctx, col.line, 2.5, [s.x - 4, s.y, s.x + s.w + 4, s.y]); line(ctx, mortar, 1, [s.x + 8, s.y + 18, s.x + 8, s.y + s.h - 16], .5);
      return;
    }
    // walls and floor: dressed stone, flagstones along the top
    const deep = s.h > 300;
    rect(ctx, deep ? s0 : s1, s.x, s.y, s.w, s.h + (deep ? 0 : 400));
    for (let y = s.y + (deep ? 0 : 14); y < s.y + (deep ? s.h : 400); y += 34) for (let x = s.x - ((y / 34) % 2) * 30; x < s.x + s.w; x += 60) {
      ctx.strokeStyle = mortar; ctx.globalAlpha = .5; ctx.lineWidth = 1.5; ctx.strokeRect(Math.max(s.x, x), y, Math.min(60, s.x + s.w - Math.max(s.x, x)), 34); ctx.globalAlpha = 1;
    }
    if (!deep) {
      rect(ctx, s2, s.x, s.y, s.w, 14);
      for (let x = s.x + 50; x < s.x + s.w; x += 50 + Math.floor(hash(x) * 30)) line(ctx, mortar, 1.5, [x, s.y + 2, x, s.y + 14], .7);
      line(ctx, col.line, 3, [s.x, s.y, s.x + s.w, s.y]);
    }
  },
  platform(ctx, p, col, dark) {
    const wood = dark ? '#3b2a1c' : '#7a5636', cloth = dark ? '#4a1214' : '#9b2622';
    rect(ctx, wood, p.x, p.y, p.w, 12);
    for (let x = p.x + 6; x < p.x + p.w; x += 26) poly(ctx, cloth, [x, p.y + 12, x + 20, p.y + 12, x + 10, p.y + 34], .9);
    rect(ctx, dark ? '#8a6a22' : '#d4a835', p.x, p.y + 10, p.w, 3);
    line(ctx, col.line, 2.5, [p.x, p.y, p.x + p.w, p.y]);
  },
  front(ctx, map, col, v, dark, t) {
    particles(ctx, v, t, {n: 70, color: dark ? '#c8d4ff' : '#fff1c9', size: 2, fall: 6, drift: 9, sway: 14, alpha: dark ? .22 : .35, twinkle: true, depth: .9});
  },
};
