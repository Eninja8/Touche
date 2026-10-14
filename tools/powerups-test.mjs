// Tests the power-ups: they're deterministic (and rewind correctly), they appear on safe,
// mirrored spots, each one does what it says, the knife kills and can be blocked, the CPU
// uses them, and with Power-ups off nothing appears.
// Usage:  npm test   (runs with the other tests)

import {createGame, newMatch, step, snapshot} from '../src/sim/game.js';
import {drain} from '../src/sim/events.js';
import {MAP_KEYS, getMap} from '../src/sim/maps.js';
import {finishPose} from '../src/sim/fighter.js';
import {groundAt} from '../src/sim/terrain.js';
import {givePower} from '../src/sim/powerups.js';
import {RUN_MAX, BLADE, LONG_BLADE, AIR_DASHES} from '../src/sim/constants.js';

let failed = false;
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) failed = true; };
const idle = {left: false, right: false, up: false, down: false, raise: false, lower: false};
const cmd = (held = {}, presses = [], aim = null) => ({held: {...idle, ...held}, presses, aim});

// 1. CPU bouts with power-ups on every map: deterministic, rewinding replays identically,
//    and the CPU really picks them up and throws knives.
{
  let pickups = 0, throws = 0, knifeKills = 0;
  for (const map of MAP_KEYS) {
    const bout = () => { const G = createGame(1); newMatch(G, {demo: true, seed: 33, map, powerups: true}); return G; };
    const runFor = (G, n) => {
      for (let k = 0; k < n; k++) {
        step(G, [null, null]);
        for (const e of drain()) { if (e.type === 'pickup') pickups++; if (e.type === 'sfx' && e.name === 'throw') throws++; if (e.type === 'kill' && e.hit.knife) knifeKills++; }
      }
      return G;
    };
    const a = JSON.stringify(runFor(bout(), 8000)), b = JSON.stringify(runFor(bout(), 8000));
    const mid = runFor(bout(), 4000), save = snapshot(mid), r1 = JSON.stringify(runFor(mid, 4000)), r2 = JSON.stringify(runFor(snapshot(save), 4000));
    check(a === b && r1 === r2, `${getMap({map, mode: {}}).name} with power-ups: deterministic, and rewinding replays identically`);
  }
  // (each bout above ran three times, so the counts are three times what one bout saw)
  check(pickups > 30 && throws > 5, `the CPU picks up power-ups (${pickups / 3} pickups) and throws knives (${throws / 3} throws) in CPU-vs-CPU bouts`);
  console.log(`      knife kills seen: ${knifeKills / 3}`);
}

// 2. the spots: on solid ground, off spikes, in mirrored pairs
{
  const bad = [];
  for (const k of MAP_KEYS) {
    const m = getMap({map: k, mode: {hazards: true}});
    for (const s of m.items) {
      if (!groundAt(m, s.x, s.y)) bad.push(`${k} (${s.x}, ${s.y}) not on ground`);
      if (m.spikes.some(p => s.x > p.x - 30 && s.x < p.x + p.w + 30 && Math.abs(s.y - p.y - p.h) < 40)) bad.push(`${k} (${s.x}, ${s.y}) by spikes`);
      if (!m.items.some(o => o.x === m.width - s.x && o.y === s.y)) bad.push(`${k} (${s.x}, ${s.y}) has no mirror spot`);
    }
  }
  check(!bad.length, `every power-up spot is on solid ground, away from spikes, with a mirror spot${bad.length ? ': ' + bad.join(', ') : ''}`);
}

// A two-player match on the Great Hall with power-ups on; both stand still until it starts.
const play = (powerups = true) => { const G = createGame(1); newMatch(G, {seed: 5, map: 'castle', powerups}); for (let k = 0; k < 160; k++) { step(G, [cmd(), cmd()]); drain(); } return G; };
const place = (f, x, y) => { f.x = x; f.y = y; f.vx = f.vy = 0; f.P = null; f.prevHand = null; finishPose(f); };
const run = (G, n, c0 = () => cmd(), c1 = () => cmd()) => { const ev = []; for (let k = 0; k < n; k++) { step(G, [c0(k), c1(k)]); ev.push(...drain()); } return ev; };

// 3. a pickup is waiting when the round starts, on a spot; walking into it takes it, and the
//    next one comes 7 s later
{
  const G = play();
  const it = G.item;
  check(it && getMap(G).items.some(s => s.x === it.x), `a power-up is waiting when the round starts, on one of the map's spots (${it ? it.kind + ' at x ' + it.x : 'none'})`);
  if (it) {
    place(G.F[0], it.x - 40, it.y + 34);
    const ev2 = run(G, 40, () => cmd({right: true}));
    check(G.F[0].power === it.kind && !G.item && ev2.some(e => e.type === 'pickup'), `walking into it gives that power (Red has ${G.F[0].power})`);
    run(G, 7 * 120 - 60); const none = !G.item; run(G, 60); // (it was taken partway through the 40-tick walk)
    check(none && G.item, 'the next one appears 7 s after it was taken');
  }
}
{
  const G = play(false); run(G, 120 * 20);
  check(!G.item, 'with Power-ups off, nothing appears (20 s)');
}

// 4. what each power does
{
  const top = power => { const G = play(); G.item = null; if (power) givePower(G.F[0], power); place(G.F[0], 600, 790); place(G.F[1], 1500, 790); let v = 0; run(G, 90, () => cmd({right: true})); v = G.F[0].vx; return v; };
  const normal = top(null), swift = top('swift');
  check(Math.abs(normal - RUN_MAX) < 1 && swift > normal * 1.25, `Swift: top speed ${Math.round(swift)} px/s (normal ${Math.round(normal)})`);
  const G = play(); givePower(G.F[0], 'long'); run(G, 1);
  const P = G.F[0].P, len = Math.hypot(P.tip.x - P.hand.x, P.tip.y - P.hand.y);
  check(Math.abs(len - LONG_BLADE) < .5 && LONG_BLADE > BLADE, `Long Blade: the blade is ${Math.round(len)} px (normal ${BLADE})`);
  const dashes = power => {
    const G = play(); if (power) givePower(G.F[0], power); place(G.F[0], 700, 790); place(G.F[1], 1500, 790);
    let n = 0; run(G, 1, () => cmd({up: true}, ['up']));
    const ev = run(G, 70, k => cmd({up: k < 20, right: true}, k % 12 === 6 ? ['dash'] : []));
    n = ev.filter(e => e.type === 'sfx' && e.name === 'dash').length;
    return n;
  };
  const d0 = dashes(null), d1 = dashes('air');
  check(d0 === 1 && d1 === AIR_DASHES, `Air Dash: ${d1} dashes in one jump (normally ${d0})`);
}

// 5. the knife: thrown level at a fencer 300 px away it kills; a blade held in its way blocks it
{
  const G = play(); givePower(G.F[0], 'knife'); place(G.F[0], 700, 790); place(G.F[1], 1000, 790);
  const aim = {x: 100, y: 0};
  run(G, 40, () => cmd({}, [], aim), () => cmd({lower: true}));  // Red levels the blade; Green points down, out of the way
  const ev = run(G, 60, k => cmd({}, k === 0 ? ['throw'] : [], aim), () => cmd({lower: true}));
  check(!G.F[1].alive && G.koWho === 0 && !G.F[0].knife, `a thrown knife kills (Green ${G.F[1].alive ? 'survived' : 'was touched'}, Red's knife is used up)`);
  const H = play(); givePower(H.F[0], 'knife'); place(H.F[0], 700, 790); place(H.F[1], 1000, 790);
  // Green (aiming with a mouse) holds its blade down and forward, across the knife's path
  const guard = () => cmd({}, [], {x: -100, y: 55});
  run(H, 40, () => cmd({}, [], aim), guard);
  const ev2 = run(H, 60, k => cmd({}, k === 0 ? ['throw'] : [], aim), guard);
  const blocked = ev2.some(e => e.type === 'text' && e.text === 'BLOCK');
  check(H.F[1].alive && blocked, `a blade in its path blocks it (Green ${H.F[1].alive ? 'alive' : 'touched'}, ${blocked ? 'BLOCK' : 'no block'})`);
  const J = play(); place(J.F[0], 700, 790); place(J.F[1], 1000, 790);
  run(J, 60, k => cmd({}, k === 0 ? ['throw'] : [], aim), () => cmd({lower: true}));
  check(J.F[1].alive && !J.knives.length, 'without the power-up, the Throw key does nothing');
}

console.log(failed ? '\nSome power-up checks FAILED.' : '\nAll power-up checks passed.');
process.exit(failed ? 1 : 0);
