// Checks that the simulation is deterministic (a requirement for online rollback).
// Usage:  npm test
//
// 1. Scans src/sim for things that would break determinism (Math.random, clocks, DOM).
// 2. Plays the same long match twice from the same seed and compares the results.
// 3. Saves the game mid-match, plays on, rewinds to the save, replays, and compares.
//    That rewind-and-replay is exactly what rollback netcode does.

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createGame, newMatch, step, snapshot} from '../src/sim/game.js';
import {drain} from '../src/sim/events.js';
import {bodyParts} from '../src/sim/fighter.js';
import {distPtSeg} from '../src/sim/util.js';
import {TIP_LETHAL} from '../src/sim/constants.js';

const simDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/sim');
let failed = false;
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) failed = true; };

// 1. forbidden things inside the simulation
const banned = [/Math\.random/, /Date\.now|new Date/, /performance\.now/, /\bdocument\./, /\bwindow\./, /localStorage/];
for (const f of fs.readdirSync(simDir)) {
  const lines = fs.readFileSync(path.join(simDir, f), 'utf8').split('\n');
  lines.forEach((l, n) => { const code = l.replace(/\/\/.*$/, ''); for (const re of banned) if (re.test(code)) check(false, `${f}:${n + 1} uses ${re}`); });
}

// A scripted "human" for player 0 so the test covers keyboard commands too.
function scripted(tick) {
  const r = Math.sin(tick * 12.9898) * 43758.5453, h = r - Math.floor(r); // fixed pseudo-random per tick
  const held = {left: h < .3, right: h > .6, up: false, down: h > .95, raise: tick % 90 < 20, lower: tick % 90 > 70};
  const presses = [];
  if (tick % 37 === 0) presses.push('attack');
  if (tick % 211 === 0) presses.push('dash');
  if (tick % 97 === 0) presses.push('up');
  // half the time keyboard aim, half the time a mouse crosshair sweeping across the body
  return [{held, presses, aim: tick % 500 < 250 ? null : {x: 150 * Math.cos(tick / 40), y: -60 + 70 * Math.sin(tick / 23)}}, null];
}

function play(seed, ticks, S0) {
  const S = S0 || createGame(1);
  if (!S0) newMatch(S, {demo: false, vsCPU: true, diff: 'hard', target: 99, seed});
  const start = S.tick;
  for (let t = start; t < start + ticks; t++) { step(S, scripted(t)); drain(); }
  return S;
}

// 2. same seed twice
const a = play(12345, 20000), b = play(12345, 20000);
check(JSON.stringify(a) === JSON.stringify(b), `same seed gives identical game after 20000 ticks (score ${a.scores.join('-')})`);
const c = play(999, 20000);
check(JSON.stringify(a) !== JSON.stringify(c), 'different seed gives a different game');

// 3. save, continue, rewind, replay
const S = play(777, 3000), save = snapshot(S);
const first = JSON.stringify(play(0, 4000, S));
const second = JSON.stringify(play(0, 4000, snapshot(save)));
check(first === second, 'rewinding to a saved state and replaying gives the identical result');

// demo bout (both CPU) also deterministic
const demo = seed => { const G = createGame(1); newMatch(G, {demo: true, seed}); for (let t = 0; t < 15000; t++) { step(G, [null, null]); drain(); } return JSON.stringify(G); };
check(demo(42) === demo(42), 'CPU-vs-CPU demo bout is deterministic');

// 4. mouse aiming feel: turning around must not snap the blade, and a swing over the top is lethal
{
  const G = createGame(1); newMatch(G, {demo: false, vsCPU: false, seed: 5});
  const idle = {left: false, right: false, up: false, down: false, raise: false, lower: false};
  const run = (aim, n) => { for (let k = 0; k < n; k++) { step(G, [{held: idle, presses: [], aim}, {held: idle, presses: [], aim: null}]); drain(); } };
  run({x: 100, y: 0}, 200); // through the countdown, blade level and forward
  const f = G.F[0], dir = () => Math.atan2(f.P.tip.y - f.P.hand.y, f.P.tip.x - f.P.hand.x);
  const before = dir(), face0 = f.face;
  run({x: -100 * face0, y: 0}, 1); // crosshair jumps behind: fencer turns this tick
  const turn = Math.abs(Math.atan2(Math.sin(dir() - before), Math.cos(dir() - before)));
  check(f.face === -face0, 'mouse player turns to face the crosshair');
  check(turn < 0.1, `blade keeps its world direction when turning (moved ${turn.toFixed(3)} rad in one tick)`);
  let maxSpeed = 0, maxTipY = 1e9; const startY = f.P.sh.y;
  for (let k = 0; k < 60; k++) { run({x: -100 * face0, y: 0}, 1); maxSpeed = Math.max(maxSpeed, f.tipSpeed); maxTipY = Math.min(maxTipY, f.P.tip.y); }
  check(maxTipY < startY - 60, 'the blade swings over the top to the new side');
  check(maxSpeed >= 600, `that swing is fast enough to be lethal (${Math.round(maxSpeed)} px/s)`);
}

// 5. the point and solid blades. Red stands still, blade level; Green keeps its blade pointed
// at the floor so only Red's blade can touch. "Inside" = Red's blade sits in Green's body.
{
  const G = createGame(1); newMatch(G, {demo: false, vsCPU: false, seed: 9});
  const keys = (o = {}) => ({held: {left: false, right: false, up: false, down: false, raise: false, lower: false, ...o}, presses: [], aim: null});
  const low = (o = {}) => keys({lower: true, ...o}); // Green's commands: blade held down
  let killed = null, inside = 0;
  const inBody = () => { const A = G.F[0], B = G.F[1]; for (let k = 0; k <= 20; k++) { const t = .3 + .7 * k / 20, p = {x: A.P.hand.x + (A.P.tip.x - A.P.hand.x) * t, y: A.P.hand.y + (A.P.tip.y - A.P.hand.y) * t}; for (const q of bodyParts(B.P)) if (distPtSeg(p, q.a, q.b) < q.r - .5) return true; } return false; };
  const run = (red, green, n) => { for (let k = 0; k < n; k++) { step(G, [red, green]); for (const e of drain()) if (e.type === 'kill') killed = killed || e; if (G.phase === 'fight' && G.F[1].alive && inBody()) inside++; } };
  run(keys(), low(), 160); // countdown, then Green's blade goes down
  const reachX = () => G.F[0].P.tip.x;
  // Green walks up and stops a few pixels short of the point, then inches in with short taps
  while (G.F[1].x - reachX() > 30) run(keys(), low({left: true}), 1);
  run(keys(), low(), 40);
  check(!killed, 'standing still near the point is safe');
  for (let tap = 0; tap < 20; tap++) { run(keys(), low({left: true}), 3); run(keys(), low(), 12); }
  check(!killed, 'inching onto the point does not kill');
  check(inside === 0, `the point never goes inside the body; it pushes Green back (Green ${Math.round(G.F[1].x - reachX())} px from the point)`);
  // a slow keyboard swing down through Green's body: harmless, and solid
  run(keys({raise: true}), low(), 60); // Red's blade up
  while (G.F[1].x - G.F[0].x > 60) run(keys(), low({left: true}), 1); // Green steps in under it
  run(keys(), low(), 20);
  const x0 = G.F[1].x;
  run(keys({lower: true}), low(), 25); // down to level, through Green
  check(!killed && inside === 0, `a slow swing (${Math.round(G.F[0].angSpd * 100)} px/s at the point) neither kills nor passes through (Green shoved ${Math.round(Math.abs(G.F[1].x - x0))} px)`);
  // Green backs off, then runs onto the point
  run(keys(), low({right: true}), 30); run(keys(), low(), 30);
  for (let k = 0; k < 120 && !killed; k++) run(keys(), low({left: true}), 1);
  check(killed && killed.victim.id === 1 && killed.hit.tip, `running onto the point kills (closing at ${killed ? Math.round(killed.hit.vx * G.F[0].P.dx + killed.hit.vy * G.F[0].P.dy) : 0} px/s, ${TIP_LETHAL} needed)`);
}

console.log(failed ? '\nSome checks FAILED.' : '\nAll checks passed.');
process.exit(failed ? 1 : 0);
