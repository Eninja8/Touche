// Climbable ropes, chains and ladders (map.ropes: [{x, y0, y1, look}]).
//
// Jump into one to grab it (holding down stops you grabbing). While hanging:
//   up / down          climb (letting go at the bottom)
//   jump + left/right  jump off that way;  jump at the top: jump straight up off it
//   down + left/right  let go sideways
//   dash               dash off it
// The blade works as usual while hanging, so you can fight from a rope.

import {JUMP_V} from './constants.js';
import {emit} from './events.js';

export const GRIP = 100;          // the hands hold the rope this far above the feet
export const CLIMB_UP = 240, CLIMB_DOWN = 375; // climbing speeds (px/s)
export const ROPE_JUMP_V = 700, ROPE_JUMP_X = 360, ROPE_CD = .3; // jumping off; seconds before you can grab again
const REACH = 10;                 // how close (sideways) you must pass to grab

// Highest and lowest the feet can be while hanging on rope r.
export const ropeTop = r => r.y0 + GRIP + 4;
export const ropeBottom = r => r.y1 + GRIP;

// An airborne fencer moving from prevX this tick: grab a rope if it passes one.
export function tryGrab(f, map, prevX, held) {
  if (f.rope >= 0 || f.ropeCD > 0 || f.onGround || held.down) return;
  for (let k = 0; k < map.ropes.length; k++) {
    const r = map.ropes[k];
    if (r.x < Math.min(prevX, f.x) - REACH || r.x > Math.max(prevX, f.x) + REACH) continue;
    const hands = f.y - GRIP;
    if (hands + 40 < r.y0 || hands - 20 > r.y1) continue;
    f.rope = k; f.vx = 0; f.vy = 0; f.slideT = 0; f.dashT = 0; f.airJump = true; f.airDash = true; f.wallT = 0;
    f.y = Math.min(Math.max(f.y, ropeTop(r)), ropeBottom(r)); f.x = r.x - f.face * 5;
    emit('sfx', {name: 'grab'});
    return;
  }
}

function letGo(f, vx, vy) { f.rope = -1; f.ropeCD = ROPE_CD; f.vx = vx; f.vy = vy; }

// One tick on a rope. dir = held left/right. Returns false if the fencer let go this tick
// (then the normal movement code runs).
export function hang(f, i, dir, map, dt) {
  const r = map.ropes[f.rope];
  if (i.buf.dash > 0) { letGo(f, 0, 0); return false; }            // the normal dash code takes over
  if (i.buf.up > 0 && (dir || f.y <= ropeTop(r) + 1)) {           // jump off
    i.buf.up = 0; letGo(f, dir * ROPE_JUMP_X, dir ? -ROPE_JUMP_V : -JUMP_V); f.padUp = false;
    emit('sfx', {name: 'jump'}); emit('puff', {x: f.x, y: f.y - 40, n: 3});
    return false;
  }
  if (i.buf.up > 0) i.buf.up = 0;                                 // a jump press without a direction just climbs
  if (i.buf.down > 0 && dir) { i.buf.down = 0; letGo(f, dir * 200, 0); return false; }
  const climb = (i.up ? -CLIMB_UP : 0) + (i.down ? CLIMB_DOWN : 0);
  f.y += climb * dt;
  if (f.y > ropeBottom(r)) { letGo(f, 0, 0); return false; }       // climbed off the bottom
  f.y = Math.max(f.y, ropeTop(r));
  f.x = r.x - f.face * 5; f.vx = 0; f.vy = 0;
  f.onGround = false; f.climbing = climb !== 0 && f.y > ropeTop(r);
  if (f.climbing) f.phase += dt * 11;
  return true;
}
