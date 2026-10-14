// Tests the maps: every map is deterministic (with hazards on and off), and the map
// features work: spiked pits and their covers, spike strips, ropes, ice, jump and
// speed pads, random map choice, and the CPU can reach the player anywhere.
// Usage:  npm test   (runs with the other tests)

import {createGame, newMatch, step, snapshot} from '../src/sim/game.js';
import {drain} from '../src/sim/events.js';
import {MAP_KEYS, getMap} from '../src/sim/maps.js';
import {finishPose} from '../src/sim/fighter.js';
import {navFor} from '../src/sim/ai-nav.js';

let failed = false;
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) failed = true; };

{
  // every map, hazards on and off: CPU bouts are deterministic, and rewind-and-replay matches
  for (const map of MAP_KEYS) for (const hazards of [true, false]) {
    const bout = () => { const G = createGame(1); newMatch(G, {demo: true, seed: 21, map, hazards}); return G; };
    const runFor = (G, n) => { for (let k = 0; k < n; k++) { step(G, [null, null]); drain(); } return G; };
    const a = runFor(bout(), 6000), b = runFor(bout(), 6000);
    const mid = runFor(bout(), 3000), save = snapshot(mid), r1 = JSON.stringify(runFor(mid, 3000)), r2 = JSON.stringify(runFor(snapshot(save), 3000));
    check(JSON.stringify(a) === JSON.stringify(b) && r1 === r2 && a.map === map, `${getMap(a).name} (hazards ${hazards ? 'on' : 'off'}): deterministic, and rewinding replays identically (score ${a.scores.join('-')})`);
  }
}

const idle = {left: false, right: false, up: false, down: false, raise: false, lower: false};
const play = (map, hazards) => { const G = createGame(1); newMatch(G, {demo: false, vsCPU: false, seed: 5, map, hazards}); for (let k = 0; k < 160; k++) { step(G, [null, null].map(() => ({held: idle, presses: [], aim: null}))); drain(); } return G; };
// move Red to (x, y), standing still
const place = (G, x, y) => { const f = G.F[0]; f.x = x; f.y = y; f.vx = f.vy = 0; f.P = null; f.prevHand = null; finishPose(f); };
// Red holds keys for n ticks (Green stands still), pressing `presses` on the first tick; returns what happened
const hold = (G, held, n, presses = []) => {
  const out = {kills: 0, spiked: 0, minY: 1e9, maxSpeed: 0, rope: false};
  for (let k = 0; k < n && G.phase === 'fight'; k++) {
    step(G, [{held: {...idle, ...held}, presses: k ? [] : presses, aim: null}, {held: idle, presses: [], aim: null}]);
    for (const e of drain()) if (e.type === 'kill') { out.kills++; if (e.hit.part === 'spikes') out.spiked++; }
    const f = G.F[0]; out.minY = Math.min(out.minY, f.y); out.maxSpeed = Math.max(out.maxSpeed, Math.abs(f.vx)); if (f.rope >= 0) out.rope = true;
  }
  return out;
};

// pits and covers
let G = play('dojo', true), r = hold(G, {left: true}, 300);
check(r.spiked === 1 && G.koWho === 1, 'Dojo: running into the spiked pit is a touch for the opponent');
G = play('dojo', false); r = hold(G, {left: true}, 300);
check(r.kills === 0 && G.F[0].alive && Math.round(G.F[0].x) === 58, `Dojo, hazards off: a floor covers the pit and the corner spikes are gone (Red walked to x ${Math.round(G.F[0].x)})`);
// spike strips on surfaces: the icicles under the Frozen Lake's overhang
G = play('lake', true); place(G, 150, 620); hold(G, {up: true}, 30, ['up']); r = hold(G, {up: true}, 60, ['up']);
check(r.spiked === 1 && G.koWho === 1, 'Frozen Lake: double-jumping under the overhang into the icicles kills');
G = play('lake', false); place(G, 150, 620); hold(G, {up: true}, 30, ['up']); r = hold(G, {up: true}, 60, ['up']);
check(r.kills === 0 && G.F[0].alive, 'Frozen Lake, hazards off: no icicles');
// ropes: jump into one, climb it, jump off
G = play('dojo', true); place(G, 610, 740); hold(G, {left: true}, 1, ['up']); hold(G, {left: true}, 25); r = hold(G, {left: true}, 40, ['up']);
const f = G.F[0], grabbedY = f.y;
check(r.rope && f.rope === 0, `Dojo: jumping into the climbing rope grabs it (hanging at y ${Math.round(f.y)})`);
hold(G, {up: true}, 80);
check(f.rope === 0 && f.y < grabbedY - 100, `climbing up the rope (${Math.round(grabbedY - f.y)} px in two-thirds of a second)`);
r = hold(G, {right: true}, 150, ['up']);
check(f.rope === -1 && f.alive && f.onGround && f.x > 600, `jumping off the rope to the right lands safely (at x ${Math.round(f.x)}, y ${Math.round(f.y)})`);
// ice: run, let go, see how far you slide
const stopDist = map => { const G = play(map, true); hold(G, {left: true}, 40); const x0 = G.F[0].x; hold(G, {}, 240); return x0 - G.F[0].x; }; // run away from Green, then let go
const iceStop = stopDist('lake'), floorStop = stopDist('castle');
check(iceStop > floorStop * 8, `Frozen Lake: the ice is very slippery (${Math.round(iceStop)} px to stop vs ${Math.round(floorStop)} px on stone)`);
// pads
G = play('forge', true); place(G, 330, 780); r = hold(G, {left: true}, 150);
check(r.minY < 470 && r.kills === 0, `Forge: the jump pad launches you up to the high platforms (reached y ${Math.round(r.minY)})`);
G = play('forge', true); place(G, 600, 780); r = hold(G, {left: true}, 50);
check(r.maxSpeed >= 400, `Forge: the speed pad gives a burst of speed (${Math.round(r.maxSpeed)} px/s, normal top speed 270)`);

// the Hard CPU can reach a player standing still on any surface of any map (blade held
// down, so it can't guard the landing spot)
{
  const misses = [];
  let n = 0, worst = 0;
  for (const map of MAP_KEYS) {
    for (const node of navFor(getMap({map, mode: {hazards: true}})).nodes) {
      if (node.rope) continue;
      const G = createGame(1); newMatch(G, {vsCPU: true, diff: 'hard', seed: 4, map, target: 99});
      for (let k = 0; k < 130; k++) { step(G, [{held: {...idle, lower: true}, presses: [], aim: null}, null]); drain(); }
      place(G, (node.x0 + node.x1) / 2, node.y); n++;
      let t = 0, ok = false;
      for (; t < 120 * 15 && !ok; t++) {
        step(G, [{held: {...idle, lower: true}, presses: [], aim: null}, null]);
        if (drain().some(e => e.type === 'kill' && !(e.victim.id === 1 && e.hit.part === 'spikes'))) ok = true;
        const c = G.F[1], p = G.F[0]; if (Math.abs(c.x - p.x) < 140 && Math.abs(c.y - p.y) < 50) ok = true;
        if (!c.alive && !ok) break;
      }
      if (!ok) misses.push(`${map} ${Math.round(node.x0)}-${Math.round(node.x1)} y${node.y}`); else worst = Math.max(worst, t / 120);
    }
  }
  check(!misses.length, `the Hard CPU reaches the player on every surface of every map (${n - misses.length}/${n}, slowest ${worst.toFixed(1)} s)${misses.length ? ': missed ' + misses.join(', ') : ''}`);
}

// random maps come from the seed: same seed, same maps
{
  const maps = seed => { const G = createGame(1); newMatch(G, {demo: true, seed, map: 'round'}); const seen = [G.map]; for (let k = 0; k < 20000; k++) { step(G, [null, null]); for (const e of drain()) if (e.type === 'roundStart') seen.push(e.map); } return seen; };
  const m1 = maps(8), m2 = maps(8);
  check(JSON.stringify(m1) === JSON.stringify(m2) && new Set(m1).size >= 4 && m1.every((m, k) => k === 0 || m !== m1[k - 1]), `random map each round: same seed gives the same maps, never the same twice in a row (${new Set(m1).size} different maps in ${m1.length} rounds)`);
}

console.log(failed ? '\nSome map checks FAILED.' : '\nAll map checks passed.');
process.exit(failed ? 1 : 0);
