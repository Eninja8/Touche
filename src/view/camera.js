// The follow camera: keeps both fencers in view, zooming out as they separate and in
// as they close, within limits, and never scrolling past the map's edges when it can
// help it. Purely cosmetic: it only decides what part of the arena is drawn, so it
// never affects the game (or online play).

import {clamp} from '../sim/util.js';

// Zoom limits, relative to the old fixed view (a 960 x 540 arena filling the screen):
// at most this much closer, and at most this far out.
const ZOOM_IN = 1.12, ZOOM_OUT = .55;
// Room kept around the fencers: to the sides (blade reach and a step), above (jumps), below.
const PAD_X = 230, PAD_UP = 250, PAD_DOWN = 50;
// How quickly the camera catches up (per second): sideways, up/down, zooming out, zooming in.
const FOLLOW = 5, FOLLOW_Y = 3, OUT = 4, IN = 1.6;
// Vertical dead zone, so a normal jump (about 130 px high) doesn't bob the camera: the
// framing's top and bottom edges ignore a fencer rising by up to RISE, and the top edge
// ignores a drop of up to DROP. Bigger changes (ropes, jump pads, a lower ledge) are followed.
// Feet going lower than before are always followed at once, so they never leave the screen.
const RISE = 140, DROP = 60;
// the top and bottom of what's framed after the dead zone
const held = {y0: 0, y1: 0};

// x, y: the arena point at the centre of the screen; s: arena pixels → canvas pixels.
export const cam = {x: 480, y: 270, s: 1, ready: false};

// Jump straight to the new framing next frame (a new round or map), instead of gliding there.
export function snapCamera() { cam.ready = false; }

// pts: arena points that must stay in view (fencers, or their bodies after a touch).
export function updateCamera(map, pts, cw, ch, rdt) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of pts) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
  if (!pts.length) { x0 = x1 = map.width / 2; y0 = y1 = map.height / 2; }
  if (!cam.ready) { held.y0 = y0; held.y1 = y1; }
  else { held.y0 = clamp(held.y0, y0 - DROP, y0 + RISE); held.y1 = clamp(held.y1, y1, y1 + RISE); }
  y0 = held.y0; y1 = held.y1;
  const base = Math.min(cw / 960, ch / 540);
  const want = clamp(Math.min(cw / (x1 - x0 + PAD_X * 2), ch / (y1 - y0 + PAD_UP + PAD_DOWN)), base * ZOOM_OUT, base * ZOOM_IN);
  let tx = (x0 + x1) / 2, ty = (y0 - PAD_UP + y1 + PAD_DOWN) / 2;
  if (!cam.ready) { cam.s = want; } else {
    const k = want < cam.s ? OUT : IN;
    cam.s *= Math.exp(Math.log(want / cam.s) * (1 - Math.exp(-rdt * k)));
  }
  // keep the view inside the map (centred on it if the map is smaller than the view)
  const hw = cw / cam.s / 2, hh = ch / cam.s / 2;
  tx = hw * 2 >= map.width ? map.width / 2 : clamp(tx, hw, map.width - hw);
  ty = hh * 2 >= map.height ? map.height / 2 : clamp(ty, hh, map.height - hh);
  if (!cam.ready) { cam.x = tx; cam.y = ty; cam.ready = true; }
  else { cam.x += (tx - cam.x) * (1 - Math.exp(-rdt * FOLLOW)); cam.y += (ty - cam.y) * (1 - Math.exp(-rdt * FOLLOW_Y)); }
}

// The arena area currently on screen.
export const viewRect = (cw, ch) => ({x0: cam.x - cw / cam.s / 2, x1: cam.x + cw / cam.s / 2, y0: cam.y - ch / cam.s / 2, y1: cam.y + ch / cam.s / 2});
