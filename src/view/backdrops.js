// Paints each map: its theme's background layers (with parallax), animated background
// details, then the playable parts (arena.js); and after the fencers, the theme's
// foreground (ambient particles, light). All drawn with code, no images. Purely cosmetic.
//
// A theme (src/view/themes/) is {layers, back, front, block, platform, cover, spikes, ...}:
//   layers: [{depth, res, draw(g, map, area, dark)}] static backgrounds, back to front
//   back(ctx, map, col, v, dark, t) / front(...): drawn every frame, behind / in front of the fencers
//   block, platform, cover: how solid blocks, platforms and pit covers look (else arena.js defaults)
//   haze(dark): optional [colour, alpha] laid over the background so the arena stands out (edges.js)

import {parallax} from './paint.js';
import {drawArena} from './arena.js';
import {haze} from './edges.js';
import castle from './themes/castle.js';
import roofs from './themes/roofs.js';
import forge from './themes/forge.js';
import lake from './themes/lake.js';
import dojo from './themes/dojo.js';

const THEMES = {castle, roofs, forge, lake, dojo};

// ctx: canvas (in arena coordinates); map: the arena (hazards applied); v: visible area
// {x0, y0, x1, y1}; dark: dark mode; t: seconds
export function drawBack(ctx, map, v, dark, t) {
  const th = THEMES[map.theme] || castle, col = map.colors[dark ? 'dark' : 'light'];
  th.layers.forEach((L, k) => parallax(ctx, map.theme + (dark ? ':dark' : ':light'), map, {depth: L.depth, res: L.res, draw: (g, m, area) => L.draw(g, m, area, dark)}, k));
  if (th.back) th.back(ctx, map, col, v, dark, t);
  haze(ctx, v, col, dark, th);
  drawArena(ctx, map, th, col, v, dark, t);
}

export function drawFront(ctx, map, v, dark, t) {
  const th = THEMES[map.theme] || castle;
  if (th.front) th.front(ctx, map, map.colors[dark ? 'dark' : 'light'], v, dark, t);
}
