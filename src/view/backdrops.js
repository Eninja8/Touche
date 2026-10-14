// Paints each map: a themed backdrop (all drawn with code, no images), then the
// arena itself: floor (or rooftops with gaps), nets, platforms, wall pieces,
// ceiling, pads and ring-out markers. Purely cosmetic.

const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }; // fixed "random" per index

// ctx: canvas; map: the arena (hazards already applied); vis: visible area {x0,y0,x1,y1}; dark: dark mode; t: seconds
export function drawMap(ctx, map, vis, dark, t) {
  const col = map.colors[dark ? 'dark' : 'light'], F = map.floor;
  const x0 = vis.x0 - 30, x1 = vis.x1 + 30, y0 = vis.y0 - 30, y1 = vis.y1 + 30;
  const g = ctx.createLinearGradient(0, 0, 0, F); g.addColorStop(0, col.sky); g.addColorStop(1, col.skyLow);
  ctx.fillStyle = g; ctx.fillRect(x0, y0, x1 - x0, F - y0);
  (THEMES[map.theme] || THEMES.hall)(ctx, map, col, {x0, x1, y0, y1}, dark, t);
  drawArena(ctx, map, col, {x0, x1, y0, y1}, t);
}

const fillRect = (ctx, c, x, y, w, h, a = 1) => { ctx.globalAlpha = a; ctx.fillStyle = c; ctx.fillRect(x, y, w, h); ctx.globalAlpha = 1; };
const strokeLine = (ctx, c, w, pts, a = 1) => { ctx.globalAlpha = a; ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let k = 2; k < pts.length; k += 2) ctx.lineTo(pts[k], pts[k + 1]); ctx.stroke(); ctx.globalAlpha = 1; };

const THEMES = {
  // the fencing hall: plain, with the space past the map edges dimmed
  hall(ctx, map, col, v) {
    if (v.x0 < 0) fillRect(ctx, col.line, v.x0, v.y0, -v.x0, v.y1 - v.y0, .05);
    if (v.x1 > map.width) fillRect(ctx, col.line, map.width, v.y0, v.x1 - map.width, v.y1 - v.y0, .05);
  },
  // pines on the far shore, open water past the ends of the ice
  lake(ctx, map, col, v, dark) {
    const H = map.floor - 40;
    ctx.fillStyle = dark ? '#0a1626' : '#9fb7cb';
    for (let k = -4; k < 30; k++) { const x = k * 40 + hash(k) * 20, h = 40 + hash(k + 50) * 50; ctx.beginPath(); ctx.moveTo(x - 14, H); ctx.lineTo(x, H - h); ctx.lineTo(x + 14, H); ctx.fill(); }
    fillRect(ctx, dark ? '#132131' : '#eef4f9', v.x0, H, v.x1 - v.x0, 40);
    if (dark) for (let k = 0; k < 40; k++) fillRect(ctx, '#ffffff', hash(k) * 960, hash(k + 9) * 250, 1.5, 1.5, .5);
  },
  // a city skyline, then a building under every rooftop
  roofs(ctx, map, col, v, dark) {
    fillRect(ctx, dark ? '#070912' : '#4a3236', v.x0, map.floor, v.x1 - v.x0, v.y1 - map.floor); // the alleys far below
    if (dark) { for (let k = 0; k < 50; k++) fillRect(ctx, '#ffffff', hash(k) * 960, hash(k + 7) * 260, 1.5, 1.5, .6); ctx.fillStyle = '#f3efd8'; ctx.beginPath(); ctx.arc(780, 90, 26, 0, Math.PI * 2); ctx.fill(); }
    else { ctx.fillStyle = '#ffe2a8'; ctx.beginPath(); ctx.arc(760, 300, 46, 0, Math.PI * 2); ctx.fill(); }
    for (let k = -3; k < 26; k++) {
      const x = k * 44, h = 90 + hash(k) * 150, top = map.floor - 30 - h;
      fillRect(ctx, dark ? '#141a30' : '#c98a7a', x, top, 40, map.floor - top);
      for (let r = 0; r < h / 18 - 1; r++) for (let c = 0; c < 3; c++) if (hash(k * 31 + r * 7 + c) > .55) fillRect(ctx, col.accent, x + 6 + c * 11, top + 8 + r * 18, 5, 7, dark ? .55 : .25);
    }
  },
  // paper screens between the walls, wooden walls outside them
  dojo(ctx, map, col, v, dark) {
    const {left, right} = map.walls, paper = dark ? '#2c241b' : '#f7f0e1', wood = dark ? '#3b2a1a' : '#8a6237';
    fillRect(ctx, paper, left, map.ceiling, right - left, map.floor - map.ceiling);
    for (let x = left; x <= right; x += 62) strokeLine(ctx, wood, 3, [x, map.ceiling, x, map.floor], .7);
    for (let y = map.ceiling + 46; y < map.floor; y += 46) strokeLine(ctx, wood, 1.5, [left, y, right, y], .45);
    fillRect(ctx, wood, v.x0, v.y0, left - v.x0, v.y1 - v.y0); fillRect(ctx, wood, right, v.y0, v.x1 - right, v.y1 - v.y0);
    // a lantern on each wall
    for (const x of [left + 40, right - 40]) { ctx.fillStyle = col.accent; ctx.globalAlpha = .85; ctx.beginPath(); ctx.ellipse(x, map.ceiling + 70, 11, 16, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
  },
  // brick wall, a glowing furnace at the back, embers drifting up
  forge(ctx, map, col, v, dark, t) {
    const brick = dark ? '#2e1a14' : '#c7a58a';
    for (let r = 0; r * 22 < map.floor + 30; r++) for (let c = -2; c < 26; c++) { const x = c * 44 + (r % 2) * 22, y = r * 22; if (y < v.y0 - 30) continue; fillRect(ctx, brick, x + 1, y + 1, 41, 19, .35 + hash(r * 40 + c) * .25); }
    const glow = .75 + Math.sin(t * 3.1) * .08 + Math.sin(t * 7.3) * .04;
    const fg = ctx.createRadialGradient(480, map.floor - 40, 10, 480, map.floor - 40, 230); fg.addColorStop(0, col.accent); fg.addColorStop(1, 'rgba(255,120,30,0)');
    ctx.globalAlpha = glow * (dark ? .55 : .35); ctx.fillStyle = fg; ctx.fillRect(250, map.floor - 270, 460, 270); ctx.globalAlpha = 1;
    ctx.fillStyle = dark ? '#120806' : '#3a2620'; ctx.beginPath(); ctx.roundRect(420, map.floor - 110, 120, 110, [60, 60, 0, 0]); ctx.fill();
    ctx.fillStyle = col.accent; ctx.globalAlpha = glow; ctx.beginPath(); ctx.roundRect(436, map.floor - 92, 88, 92, [44, 44, 0, 0]); ctx.fill(); ctx.globalAlpha = 1;
    for (let k = 0; k < 18; k++) { const life = (t * .35 + hash(k)) % 1, x = 300 + hash(k + 3) * 360 + Math.sin(t * 2 + k) * 12, y = map.floor - 40 - life * 380; fillRect(ctx, col.accent, x, y, 2.5, 2.5, (1 - life) * .9); }
  },
};

// The playable parts, the same way on every map.
function drawArena(ctx, map, col, v, t) {
  const F = map.floor, {left, right} = map.walls;
  // floor: everywhere, or only the rooftops (each with its building below)
  const roofs = map.floors || map.drawFloors;
  if (roofs) {
    if (map.drawFloors) fillRect(ctx, col.floor, map.walls.left, F, map.walls.right - map.walls.left, 4); // nets make it all walkable
    for (const s of roofs) {
      fillRect(ctx, col.platform, s.x, F, s.w, v.y1 - F);
      fillRect(ctx, col.floor, s.x, F, s.w, 10);
      strokeLine(ctx, col.line, 3, [s.x, F, s.x + s.w, F]);
    }
  } else {
    if (map.theme === 'lake' && map.ends === 'ringout') {
      // open water past the end lines, ice between them
      fillRect(ctx, col.platform, v.x0, F, v.x1 - v.x0, v.y1 - F);
      fillRect(ctx, col.floor, left, F, right - left, v.y1 - F);
      for (let k = 0; k < 12; k++) { const x = left + 30 + hash(k) * (right - left - 90); strokeLine(ctx, col.line, 1, [x, F + 8 + hash(k + 4) * 50, x + 30 + hash(k + 8) * 40, F + 12 + hash(k + 6) * 50], .15); }
      strokeLine(ctx, col.line, 3, [left, F, right, F]);
    } else {
      fillRect(ctx, col.floor, v.x0, F, v.x1 - v.x0, v.y1 - F);
      if (map.theme === 'dojo') for (let x = map.walls.left; x < map.walls.right; x += 80) strokeLine(ctx, col.line, 1, [x, F, x, v.y1], .2);
      strokeLine(ctx, col.line, 3, [v.x0, F, v.x1, F]);
    }
  }
  // nets over the gaps when hazards are off
  for (const n of map.nets || []) {
    fillRect(ctx, col.floor, n.x, F, n.w, 4, .5);
    for (let x = n.x; x <= n.x + n.w; x += 8) strokeLine(ctx, col.line, 1, [x, F, x + 6, F + 10], .5);
    strokeLine(ctx, col.line, 2, [n.x, F, n.x + n.w, F], .8);
  }
  // solid ends on maps that are normally open: a simple railing
  if (map.ends === 'walls' && map.theme !== 'hall' && map.theme !== 'dojo' && map.theme !== 'forge') {
    for (const x of [left, right]) { strokeLine(ctx, col.line, 3, [x, F, x, F - 38], .8); strokeLine(ctx, col.line, 2, [x, F - 38, x + (x === left ? -14 : 14), F - 38], .8); }
  }
  // ring-out: a marker at each end line
  if (map.ends === 'ringout') {
    for (const x of [left, right]) {
      const out = x === left ? -1 : 1;
      fillRect(ctx, col.accent, x - 2, F - 26, 4, 26);
      ctx.fillStyle = col.accent; ctx.beginPath(); ctx.moveTo(x, F - 26); ctx.lineTo(x + out * 14, F - 21); ctx.lineTo(x, F - 16); ctx.fill();
      for (let k = 0; k < 4; k++) fillRect(ctx, col.accent, x + out * (6 + k * 10) - (out < 0 ? 6 : 0), F + 2, 6, 4, .55);
    }
  }
  if (map.ceiling != null) {
    fillRect(ctx, col.platform, v.x0, v.y0, v.x1 - v.x0, map.ceiling - v.y0);
    strokeLine(ctx, col.line, 3, [v.x0, map.ceiling, v.x1, map.ceiling]);
  }
  for (const w of map.innerWalls || []) { fillRect(ctx, col.platform, w.x - 6, w.y0, 12, w.y1 - w.y0); strokeLine(ctx, col.line, 2, [w.x - 6, w.y1, w.x + 6, w.y1]); }
  for (const p of map.platforms) {
    ctx.fillStyle = col.platform; ctx.beginPath(); ctx.roundRect(p.x, p.y, p.w, 9, 3); ctx.fill();
    strokeLine(ctx, col.line, 2.5, [p.x, p.y, p.x + p.w, p.y]);
  }
  for (const p of map.pads || []) drawPad(ctx, p, col, t);
}

// Jump pads: a glowing plate with up-chevrons. Speed pads: a plate with arrows both ways.
function drawPad(ctx, p, col, t) {
  const pulse = .6 + Math.sin(t * 6) * .25;
  ctx.fillStyle = col.accent; ctx.globalAlpha = .9; ctx.beginPath(); ctx.roundRect(p.x, p.y - 5, p.w, 6, 2); ctx.fill(); ctx.globalAlpha = 1;
  const cx = p.x + p.w / 2;
  if (p.type === 'jump') for (let k = 0; k < 3; k++) strokeLine(ctx, col.accent, 2.5, [cx - 9, p.y - 12 - k * 9, cx, p.y - 19 - k * 9, cx + 9, p.y - 12 - k * 9], pulse * (1 - k * .25));
  else for (const d of [-1, 1]) for (let k = 0; k < 2; k++) { const x = cx + d * (8 + k * 9); strokeLine(ctx, col.accent, 2.5, [x - d * 4, p.y - 15, x + d * 2, p.y - 10, x - d * 4, p.y - 5], pulse); }
}
