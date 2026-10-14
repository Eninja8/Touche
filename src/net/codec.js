// Packs one player's command for one tick into a tiny array for the network:
//   [bits]          keyboard aiming
//   [bits, ax, ay]  mouse aiming (ax, ay = whole-pixel offset from the shoulder)
// bits 0-5 = held keys (left right up down raise lower), bits 6-9 = presses
// (up down attack dash). Rounding and clamping happen here, before anything is
// simulated, so both computers always feed the simulation identical numbers.
// "|| 0" turns minus zero into plain zero: the network can't send minus zero,
// and Math.atan2 gives opposite answers for 0 and -0, which caused a desync.

import {AIM_REACH} from '../sim/constants.js';
import {clamp} from '../sim/util.js';

const HELD = ['left', 'right', 'up', 'down', 'raise', 'lower'], TAPS = ['up', 'down', 'attack', 'dash'];
const PRESS_BITS = 0b1111 << 6;

export const EMPTY = [0];

export function encode(cmd) {
  let b = 0;
  HELD.forEach((k, i) => { if (cmd.held[k]) b |= 1 << i; });
  TAPS.forEach((k, i) => { if (cmd.presses.includes(k)) b |= 1 << (6 + i); });
  if (!cmd.aim) return [b];
  const q = v => Math.round(clamp(v, -AIM_REACH, AIM_REACH)) || 0;
  return [b, q(cmd.aim.x), q(cmd.aim.y)];
}

export function decode(a) {
  const held = {}, presses = [];
  HELD.forEach((k, i) => { held[k] = !!((a[0] >> i) & 1); });
  TAPS.forEach((k, i) => { if ((a[0] >> (6 + i)) & 1) presses.push(k); });
  return {held, presses, aim: a.length > 1 ? {x: a[1], y: a[2]} : null};
}

export const same = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

// Guess the opponent's input for a tick we haven't received yet: they're
// probably still holding the same keys and aiming the same way, but a key
// *press* is a one-off, so presses are never repeated in a guess.
export const predict = last => !last ? EMPTY : last.length > 1 ? [last[0] & ~PRESS_BITS, last[1], last[2]] : [last[0] & ~PRESS_BITS];
