// How a fencer meets the arena each tick: solid blocks (floors, walls, ledges and
// ceilings; every side of a block can be wall-jumped), one-way platforms and pads.
// Also the hazards: touching spikes kills, and so does falling out of the world.
// Pure simulation: sounds and dust are emitted as events.

import {emit} from './events.js';

export const HALF = 8;        // half a fencer's width
export const BODY_H = 100;    // feet to the top of the head
export const SPEED_T = .6, SPEED_MULT = 1.6, SPEED_KICK = 430; // speed pads: seconds, run-speed multiplier, starting push
const EPS = .01;

// Does block s overlap the box from x l..r, y t..b? (Touching edges don't count.)
const overlaps = (s, l, r, t, b) => l < s.x + s.w && r > s.x && t < s.y + s.h && b > s.y;

// Is there solid ground (a block top or a platform) right under x at height y?
export function groundAt(map, x, y) {
  for (const s of map.solids) if (x >= s.x && x <= s.x + s.w && Math.abs(s.y - y) < 1) return true;
  for (const p of map.platforms) if (x >= p.x && x <= p.x + p.w && Math.abs(p.y - y) < 1) return true;
  return false;
}

// Is the point (x, y) inside a solid block? (Used to keep a shoved fencer out of walls.)
export const insideSolid = (map, x, y) => map.solids.some(s => x > s.x && x < s.x + s.w && y > s.y && y < s.y + s.h);

// Move fencer f sideways by dx, stopping at blocks. Returns the new x.
export function pushX(f, map, dx) {
  let x = f.x + dx;
  for (const s of map.solids) {
    if (!overlaps(s, x - HALF, x + HALF, f.y - BODY_H, f.y)) continue;
    if (f.x + HALF <= s.x + EPS) x = Math.min(x, s.x - HALF);
    else if (f.x - HALF >= s.x + s.w - EPS) x = Math.max(x, s.x + s.w + HALF);
  }
  return x;
}

// Resolve f against the arena after it moved from (prevX, prevY): first sideways (at the
// old height), then up and down. Sets onGround/onPlat, the grip of what it stands on,
// wall contact (for wall jumps), and handles landings and pads.
export function collide(f, map, prevX, prevY, wasGround) {
  f.onGround = false; f.onPlat = false;
  const touchWall = side => { f.wallSide = side; f.wallT = .12; if (f.vx * side > 0) f.vx = 0; };

  // sideways: blocks stop you, and touching one (even without pushing) lets you wall-jump
  for (const s of map.solids) {
    if (!overlaps(s, f.x - HALF - 1, f.x + HALF + 1, prevY - BODY_H, prevY)) continue;
    const pushing = overlaps(s, f.x - HALF, f.x + HALF, prevY - BODY_H, prevY);
    if (prevX + HALF <= s.x + EPS) { if (pushing) f.x = s.x - HALF; touchWall(1); }
    else if (prevX - HALF >= s.x + s.w - EPS) { if (pushing) f.x = s.x + s.w + HALF; touchWall(-1); }
  }

  const land = grip => {
    if (!wasGround && f.vy > 520) { emit('puff', {x: f.x, y: f.y - 2, n: 4}); emit('sfx', {name: 'land'}); }
    f.vy = 0; f.onGround = true; f.airDash = true; f.airDashN = 0; f.airJump = true; f.wallT = 0; f.grip = grip;
  };
  // up and down: land on top of a block, or bump your head on its underside
  for (const s of map.solids) {
    if (!overlaps(s, f.x - HALF + .5, f.x + HALF - .5, f.y - BODY_H, f.y)) continue;
    if (prevY <= s.y + EPS) { f.y = s.y; land(s.grip ?? 1); }
    else if (prevY - BODY_H >= s.y + s.h - EPS) { f.y = s.y + s.h + BODY_H; if (f.vy < 0) f.vy = 0; }
  }
  // one-way platforms: land on them from above (unless dropping through)
  if (!f.onGround && f.vy >= 0 && f.dropT <= 0) {
    for (const p of map.platforms) { if (prevY <= p.y + 1 && f.y >= p.y && f.x > p.x - 4 && f.x < p.x + p.w + 4) { f.y = p.y; land(p.grip ?? 1); f.onPlat = true; break; } }
  }
  if (f.onGround) pads(f, map);
}

function pads(f, map) {
  for (const p of map.pads) {
    if (f.x < p.x || f.x > p.x + p.w || Math.abs(f.y - p.y) > 1) continue;
    if (p.type === 'jump') {
      f.vy = -p.power; f.padUp = true; f.onGround = false; f.coyote = 0; f.airJump = true; f.airDash = true; f.airDashN = 0; f.y -= 1;
      emit('sfx', {name: 'pad'}); emit('puff', {x: f.x, y: f.y, n: 6});
    } else if (p.type === 'speed') {
      if (f.speedT <= 0 && Math.abs(f.vx) > 20) { if (Math.abs(f.vx) < SPEED_KICK) f.vx = Math.sign(f.vx) * SPEED_KICK; emit('sfx', {name: 'dash'}); }
      f.speedT = SPEED_T;
    }
  }
}

// Has fencer f touched spikes (or fallen out of the world)? Returns where, or null.
export const FALL_OUT = 150;
export function hazardHit(f, map) {
  for (const s of map.spikes) if (overlaps(s, f.x - 6, f.x + 6, f.y - BODY_H + 6, f.y + .5)) return {x: f.x, y: Math.min(f.y, s.y + s.h / 2)};
  if (f.y > map.height + FALL_OUT) return {x: f.x, y: f.y};
  return null;
}
