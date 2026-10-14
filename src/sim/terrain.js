// How a fencer meets the arena each tick: side walls (or open ends), floors with
// gaps, one-way platforms, free-standing wall pieces, the ceiling, and pads.
// Also: has a fencer gone out (past a ring-out line, or fallen into a gap)?
// Pure simulation: sounds and dust are emitted as events.

import {clamp} from './util.js';
import {emit} from './events.js';

const HALF = 8;        // half a fencer's width, for walls
const BODY_H = 100;    // feet to top of the head, for the ceiling
export const FALL_OUT = 60;   // fallen this far below the floor line = out
export const SPEED_T = .6, SPEED_MULT = 1.6, SPEED_KICK = 430; // speed pads: seconds, run-speed multiplier, starting push

export const solidEnds = map => map.ends === 'walls';
// Is there floor under x? (Maps without `floors` have floor everywhere.)
export const groundAt = (map, x) => !map.floors || map.floors.some(s => x >= s.x && x <= s.x + s.w);
// Keep x inside the arena when something shoves a fencer (only solid ends stop them).
export const boundX = (map, x) => solidEnds(map) ? clamp(x, map.walls.left, map.walls.right) : x;

// Out of the arena: past a ring-out line, or fallen into a gap / off a drop.
export function isOut(f, map) {
  if (map.ends === 'ringout' && (f.x < map.walls.left || f.x > map.walls.right)) return true;
  return f.y > map.floor + FALL_OUT;
}

// The gap (between two stretches of floor) that x is in, as [left edge, right edge].
function gapAround(map, x) {
  let l = -Infinity, r = Infinity;
  for (const s of map.floors) { if (s.x + s.w <= x) l = Math.max(l, s.x + s.w); if (s.x >= x) r = Math.min(r, s.x); }
  return [l, r];
}

// Resolve f against the arena after it moved from (prevX, prevY). Sets onGround/onPlat,
// wall contact (for wall jumps) and handles landings and pads.
export function collide(f, map, prevX, prevY, wasGround) {
  const {floor, platforms} = map, {left, right} = map.walls;
  f.onGround = false; f.onPlat = false;
  const touchWall = side => { f.wallSide = side; f.wallT = .12; if (f.vx * side > 0) f.vx = 0; };

  if (solidEnds(map)) {
    if (f.x <= left) { f.x = left; touchWall(-1); }
    if (f.x >= right) { f.x = right; touchWall(1); }
  }
  // free-standing wall pieces: blocked from the side you came from
  for (const w of map.innerWalls || []) {
    if (f.y <= w.y0 || f.y - BODY_H >= w.y1) continue;
    if (prevX <= w.x && f.x > w.x - HALF) { f.x = w.x - HALF; touchWall(1); }
    else if (prevX > w.x && f.x < w.x + HALF) { f.x = w.x + HALF; touchWall(-1); }
  }
  if (map.ceiling != null && f.y - BODY_H < map.ceiling) { f.y = map.ceiling + BODY_H; if (f.vy < 0) f.vy = 0; }

  const land = () => { if (!wasGround && f.vy > 520) { emit('puff', {x: f.x, y: f.y - 2, n: 4}); emit('sfx', {name: 'land'}); } f.vy = 0; f.onGround = true; f.airDash = true; f.airJump = true; f.wallT = 0; };
  if (f.y >= floor && prevY <= floor + 1 && groundAt(map, f.x)) { f.y = floor; land(); }
  else if (f.y > floor && map.floors) {
    // down in a gap: the building sides are walls (you can wall-jump back out)
    const [l, r] = gapAround(map, prevX);
    if (f.x < l + HALF) { f.x = l + HALF; touchWall(-1); }
    if (f.x > r - HALF) { f.x = r - HALF; touchWall(1); }
  } else if (f.vy >= 0 && f.dropT <= 0) {
    for (const p of platforms) { if (prevY <= p.y + 1 && f.y >= p.y && f.x > p.x - 4 && f.x < p.x + p.w + 4) { f.y = p.y; land(); f.onPlat = true; break; } }
  }
  if (f.onGround) pads(f, map);
}

function pads(f, map) {
  for (const p of map.pads || []) {
    if (f.x < p.x || f.x > p.x + p.w || Math.abs(f.y - p.y) > 1) continue;
    if (p.type === 'jump') {
      f.vy = -p.power; f.padUp = true; f.onGround = false; f.coyote = 0; f.airJump = true; f.airDash = true; f.y -= 1;
      emit('sfx', {name: 'pad'}); emit('puff', {x: f.x, y: f.y, n: 6});
    } else if (p.type === 'speed') {
      if (f.speedT <= 0 && Math.abs(f.vx) > 20) { if (Math.abs(f.vx) < SPEED_KICK) f.vx = Math.sign(f.vx) * SPEED_KICK; emit('sfx', {name: 'dash'}); }
      f.speedT = SPEED_T;
    }
  }
}
