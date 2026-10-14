// The CPU trying out moves in its head. A "move" is a short scripted input pattern:
// jump left with a double jump, wall-jump up a shaft, climb a rope then jump off...
// simulate() runs a copy of the fencer through a move, so the CPU knows where it would
// land (or whether it would die) before doing it for real. ai-nav.js uses this to map
// out each arena, and ai.js uses it while playing. Everything here is deterministic,
// and the copies emit no events.

import {DT, PRESS_BUFFER} from './constants.js';
import {mkInput, updateFighter} from './fighter.js';
import {hazardHit} from './terrain.js';
import {ropeTop} from './rope.js';
import {quietly} from './events.js';

// k: kind of move. d: direction held (-1 left, 1 right, 0 none).
//  jump: run for `run` ticks, then jump (held for full height). dj: double jump at the top.
//        wj: wall-jump off anything touched (turning around each time). stop: let go of
//        the direction once falling, to land short.
//  walk: walk (off an edge, or onto a pad). dj: double jump once falling.
//  drop: drop down through a platform.
//  rope: (hanging) climb for `climb` ticks (-1 = to the top), then jump off toward d.
//        d = 0 jumps straight up off the top, then steers toward `then`.
//  let:  (hanging) let go sideways toward d.
//  air:  (already in the air) steer toward d; dj = double jump now; wj = wall-jump.
export const MOVES = [];
for (const d of [-1, 1]) {
  for (const dj of [0, 1]) for (const stop of [0, 1]) MOVES.push({k: 'jump', d, run: 0, dj, wj: 0, stop});
  MOVES.push({k: 'jump', d, run: 0, dj: 1, wj: 1, stop: 0});
  for (const dj of [0, 1]) MOVES.push({k: 'jump', d, run: 14, dj, wj: 0, stop: 0});
  for (const dj of [0, 1]) MOVES.push({k: 'walk', d, dj});
  MOVES.push({k: 'drop', d});
  for (const climb of [0, 40, -1]) for (const dj of [0, 1]) MOVES.push({k: 'rope', d, climb, dj});
  MOVES.push({k: 'let', d});
}
for (const dj of [0, 1]) MOVES.push({k: 'jump', d: 0, run: 0, dj, wj: 0, stop: 0});
MOVES.push({k: 'drop', d: 0});
for (const then of [-1, 0, 1]) MOVES.push({k: 'rope', d: 0, climb: -1, dj: 0, then});
for (const d of [-1, 0, 1]) for (const dj of [0, 1]) for (const wj of [0, 1]) MOVES.push({k: 'air', d, dj, wj});

// Which moves make sense from where the fencer is now.
const GROUND = MOVES.map((m, k) => k).filter(k => ['jump', 'walk', 'drop'].includes(MOVES[k].k));
const ROPE = MOVES.map((m, k) => k).filter(k => ['rope', 'let'].includes(MOVES[k].k));
const AIR = MOVES.map((m, k) => k).filter(k => MOVES[k].k === 'air');
export const movesFor = f => f.rope >= 0 ? ROPE : f.onGround ? GROUND : AIR;

// The running state of a move (kept in S.AI while the CPU carries it out).
export const newScript = (m, f) => ({m, t: 0, d: MOVES[m].d, dj: false, last: -99, left: !f.onGround && f.rope < 0, air: 0});

// Has the move finished? (It left where it started, then landed or grabbed a rope.)
export function scriptDone(s, f) {
  if (!f.onGround && f.rope < 0) { if (!s.left) s.air = s.t; s.left = true; return false; }
  return s.left;
}

// Set this tick's keys for the move: held keys on i, presses in i.buf.
export function drive(s, f, i, map) {
  const m = MOVES[s.m], t = s.t++, airborne = !f.onGround && f.rope < 0;
  let up = false, down = false, press = null;
  if (m.k === 'jump') { if (t === m.run) press = 'up'; up = t >= m.run; if (m.stop && airborne && f.vy > 0) s.d = 0; }
  else if (m.k === 'drop') { if (t === 0) press = 'down'; }
  else if (m.k === 'let') { if (t === 0) press = 'down'; down = f.rope >= 0; }
  else if (m.k === 'air') { if (t === 0 && m.dj) { press = 'up'; s.dj = true; } up = true; }
  else if (m.k === 'rope' && f.rope >= 0) {
    const atTop = f.y <= ropeTop(map.ropes[f.rope]) + 1;
    if (m.climb < 0 ? !atTop : t < m.climb) { up = true; s.d = 0; }
    else { press = 'up'; up = true; s.d = m.d; }
  } else if (m.k === 'rope') { up = true; if (m.then !== undefined && t > s.air + 8) s.d = m.then; }
  // shared: double jump near the top of the jump (or once falling), wall jumps
  if (m.dj && airborne && !s.dj && t > s.air + 6 && f.vy > -60) { press = 'up'; s.dj = true; }
  if (m.wj && airborne && f.wallT > 0 && t - s.last > 8) { press = 'up'; s.d = -f.wallSide; }
  if (airborne && f.vy < 0) up = up || t - s.last < 30;
  i.left = s.d < 0; i.right = s.d > 0; i.up = up; i.down = down;
  if (press) { i.buf[press] = PRESS_BUFFER; s.last = t; }
}

// Run a copy of fencer f through move m (opX: where the opponent stands, which decides
// which way a keyboard fencer faces). Returns {dead, t} if it would touch spikes, or
// {x, y, rope, t} where it lands (t in seconds), or null if it never gets anywhere.
export function simulate(f, map, m, opX) {
  const climb = MOVES[m].k === 'rope', maxT = climb ? 600 : 260;
  return quietly(() => {
    const g = structuredClone(f), i = mkInput(), s = newScript(m, g), o = {x: opX};
    for (let t = 0; t < maxT; t++) {
      if (scriptDone(s, g)) return {x: g.x, y: g.y, rope: g.rope, t: t * DT};
      if (!s.left && t > (climb ? 420 : 75)) return null;   // still standing (or hanging) where it started
      drive(s, g, i, map);
      updateFighter(g, i, o, DT, map);
      if (hazardHit(g, map)) return {dead: true, t: t * DT};
    }
    return null;
  });
}

// Would fencer f die within `ticks` if it kept doing exactly what input i says now?
export function wouldDie(f, i, map, opX, ticks) {
  return quietly(() => {
    const g = structuredClone(f), j = structuredClone(i), o = {x: opX};
    for (let t = 0; t < ticks; t++) { updateFighter(g, j, o, DT, map); if (hazardHit(g, map)) return true; }
    return false;
  });
}
