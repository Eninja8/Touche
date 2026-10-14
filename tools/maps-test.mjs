// Tests the maps: every map is deterministic (with hazards on and off), and the map
// features work: ring-out lines, rooftop gaps and nets, ice, jump and speed pads,
// and random map choice.
// Usage:  npm test   (runs with the other tests)

import {createGame, newMatch, step, snapshot} from '../src/sim/game.js';
import {drain} from '../src/sim/events.js';
import {MAP_KEYS} from '../src/sim/maps.js';

let failed = false;
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) failed = true; };

{
  // every map, hazards on and off: CPU bouts are deterministic, and rewind-and-replay matches
  for (const map of MAP_KEYS) for (const hazards of [true, false]) {
    const bout = () => { const G = createGame(1); newMatch(G, {demo: true, seed: 21, map, hazards}); return G; };
    const runFor = (G, n) => { for (let k = 0; k < n; k++) { step(G, [null, null]); drain(); } return G; };
    const a = runFor(bout(), 6000), b = runFor(bout(), 6000);
    const mid = runFor(bout(), 3000), save = snapshot(mid), r1 = JSON.stringify(runFor(mid, 3000)), r2 = JSON.stringify(runFor(snapshot(save), 3000));
    check(JSON.stringify(a) === JSON.stringify(b) && r1 === r2 && a.map === map, `${map} (hazards ${hazards ? 'on' : 'off'}): deterministic, and rewinding replays identically (score ${a.scores.join('-')})`);
  }
  const idle = {left: false, right: false, up: false, down: false, raise: false, lower: false};
  const play = (map, hazards) => { const G = createGame(1); newMatch(G, {demo: false, vsCPU: false, seed: 5, map, hazards}); for (let k = 0; k < 160; k++) { step(G, [null, null].map(() => ({held: idle, presses: [], aim: null}))); drain(); } return G; };
  // Red holds a direction for n ticks (Green stands still); returns what happened
  const walk = (G, held, n) => {
    const out = {outs: 0, kills: 0, minY: 1e9, maxSpeed: 0};
    for (let k = 0; k < n && G.phase === 'fight'; k++) {
      step(G, [{held: {...idle, ...held}, presses: [], aim: null}, {held: idle, presses: [], aim: null}]);
      for (const e of drain()) { if (e.type === 'text' && e.text === 'OUT') out.outs++; if (e.type === 'kill') out.kills++; }
      out.minY = Math.min(out.minY, G.F[0].y); out.maxSpeed = Math.max(out.maxSpeed, Math.abs(G.F[0].vx));
    }
    return out;
  };
  let G = play('hallOpen', true), r = walk(G, {left: true}, 400);
  check(r.outs === 1 && G.koWho === 1, 'Open Hall: walking past the end line is a touch for the opponent');
  G = play('hallOpen', false); r = walk(G, {left: true}, 400);
  check(r.outs === 0 && G.F[0].alive && G.F[0].x === G.F[0].x && Math.round(G.F[0].x) === 60, 'Open Hall, hazards off: the end line is a wall');
  G = play('roofs', true); r = walk(G, {right: true}, 300);
  check(r.outs === 1 && G.koWho === 1, 'Rooftops: running into a gap is a touch for the opponent');
  G = play('roofs', false); r = walk(G, {right: true}, 60);
  check(r.outs === 0 && G.F[0].alive && G.F[0].x > 320 && G.F[0].y === 462, `Rooftops, hazards off: the net carries you over the gap (now at x ${Math.round(G.F[0].x)})`);
  G = play('roofs', true); r = walk(G, {left: true}, 300);
  check(r.outs === 1, 'Rooftops: running off the end of the roofs is out');
  // ice: run, let go, see how far you slide
  const stopDist = map => { const G = play(map, true); walk(G, {left: true}, 40); const x0 = G.F[0].x; walk(G, {}, 120); return x0 - G.F[0].x; }; // run away from Green, then let go
  const iceStop = stopDist('lake'), hallStop = stopDist('hall');
  check(iceStop > hallStop * 3, `Frozen Lake: ice takes much longer to stop on (${Math.round(iceStop)} px vs ${Math.round(hallStop)} px)`);
  G = play('forge', true); r = walk(G, {left: true}, 150);
  check(r.minY < 240 && r.outs === 0, `Forge: the jump pad launches you up to the high platforms (reached y ${Math.round(r.minY)})`);
  G = play('forge', true); r = walk(G, {left: true}, 50);
  check(r.maxSpeed >= 400, `Forge: the speed pad gives a burst of speed (${Math.round(r.maxSpeed)} px/s, normal top speed 270)`);
  // random maps come from the seed: same seed, same maps
  const maps = seed => { const G = createGame(1); newMatch(G, {demo: true, seed, map: 'round'}); const seen = [G.map]; for (let k = 0; k < 20000; k++) { step(G, [null, null]); for (const e of drain()) if (e.type === 'roundStart') seen.push(e.map); } return seen; };
  const m1 = maps(8), m2 = maps(8);
  check(JSON.stringify(m1) === JSON.stringify(m2) && new Set(m1).size >= 4 && m1.every((m, k) => k === 0 || m !== m1[k - 1]), `random map each round: same seed gives the same maps, never the same twice in a row (${new Set(m1).size} different maps in ${m1.length} rounds)`);
}

console.log(failed ? '\nSome map checks FAILED.' : '\nAll map checks passed.');
process.exit(failed ? 1 : 0);
