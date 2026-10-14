// Tests rollback netcode without any real network.
// Usage:  npm test   (runs after the determinism test)
//
// Two simulated players each run their own copy of the game with a
// RollbackSession, connected by a fake network that delays, jitters, drops and
// reorders packets. Then we check:
//  - both copies end in exactly the same state,
//  - that state equals a straight (no rollback) run with the same inputs,
//  - rollbacks really happened, and the fingerprint check saw no desync.

import {createGame, newMatch, step} from '../src/sim/game.js';
import {drain} from '../src/sim/events.js';
import {RollbackSession, INPUT_DELAY, hashState} from '../src/net/rollback.js';
import {encode, decode, EMPTY} from '../src/net/codec.js';

let failed = false;
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) failed = true; };

// Seeded random numbers for the fake network (so failures are reproducible).
function rng(seed) { return () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), seed | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// Scripted players: input is a pure function of (player, frame), changing often
// enough that the opponent's guesses are frequently wrong.
function script(p, f) {
  const r = Math.sin((f + 1) * 12.9898 + p * 78.233) * 43758.5453, h = r - Math.floor(r);
  const seg = Math.floor(f / 7) + p * 1000, s = Math.sin(seg * 3.1) * 1000, g = s - Math.floor(s);
  const held = {left: g < .3, right: g > .6, up: g > .9, down: g > .55 && g < .6, raise: false, lower: false};
  const presses = [];
  if (h < .03) presses.push('attack');
  if (h > .99) presses.push('dash');
  if (h > .5 && h < .52) presses.push('up');
  const aim = {x: 140 * Math.cos(f / (30 + 9 * p)), y: -50 + 80 * Math.sin(f / 17)};
  return encode({held, presses, aim});
}

const MATCH = {demo: false, vsCPU: false, online: true, target: 99, seed: 4242};

function runNetwork({ticks, delay, jitter, loss, hiccup, seed}) {
  const rand = rng(seed);
  const peers = [0, 1].map(me => {
    // Each player's game has a different history before the match (like the menu's demo bout
    // running for different lengths on each computer). newMatch must wipe all of it.
    const S = createGame(me + 7); newMatch(S, {demo: true, seed: me + 3}); for (let k = 0; k < 500 + 700 * me; k++) step(S, [null, null]);
    newMatch(S, MATCH); drain();
    return {me, S, session: new RollbackSession(S, me, S.round), inbox: []};
  });
  const final = ticks;
  let lossOn = true;
  const send = (from, packet) => {
    if (lossOn && rand() < loss) return;
    const to = peers[1 - from.me];
    to.inbox.push({at: now + delay + Math.floor(rand() * jitter), packet: JSON.parse(JSON.stringify(packet))});
  };
  let now = 0;
  const tickPeer = peer => {
    const s = peer.session;
    peer.inbox.sort((a, b) => a.at - b.at);
    while (peer.inbox.length && peer.inbox[0].at <= now) s.receivePacket(peer.inbox.shift().packet);
    s.applyRollback(); drain();
    s.scanConfirmed();
    for (const x of s.newSums.splice(0)) peers[1 - peer.me].session.addPeerSum(x.f, x.h);
    const hiccupNow = lossOn && rand() < hiccup; // this computer skipped a tick (slow frame)
    if (!hiccupNow && s.frame < final && s.canAdvance()) s.advance(script(peer.me, s.frame));
    send(peer, s.makePacket());
  };
  for (; now < 200000; now++) {
    if (now === ticks * 3) lossOn = false; // stop dropping packets so both can finish
    for (const p of peers) tickPeer(p);
    if (peers.every(p => p.session.frame === final && p.session.remoteMax >= final - 1 && p.session.rollbackFrom === Infinity)) break;
  }
  for (const p of peers) { p.session.applyRollback(); drain(); }
  return peers;
}

// The straight, no-rollback run with the same inputs.
function reference(ticks) {
  const S = createGame(1); newMatch(S, MATCH); drain();
  for (let f = 0; f < ticks; f++) {
    const inp = p => decode(f < INPUT_DELAY ? EMPTY : script(p, f - INPUT_DELAY));
    step(S, [inp(0), inp(1)]); drain();
  }
  return S;
}

for (const net of [
  {name: 'good connection (30 ms, light jitter)', ticks: 3000, delay: 4, jitter: 2, loss: 0, hiccup: 0, seed: 1},
  {name: 'bad connection (100 ms, heavy jitter, 10% loss, slow frames)', ticks: 3000, delay: 12, jitter: 10, loss: .1, hiccup: .05, seed: 2},
  {name: 'lag spike territory (200 ms: players must stall and wait)', ticks: 1500, delay: 24, jitter: 6, loss: .02, hiccup: 0, seed: 3},
]) {
  const [a, b] = runNetwork(net), ref = reference(net.ticks);
  const ha = hashState(a.S), hb = hashState(b.S), hr = hashState(ref);
  check(ha === hb && ha === hr, `${net.name}: both players and the straight run agree after ${net.ticks} ticks (score ${ref.scores.join('-')})`);
  const st = a.session.stats, st2 = b.session.stats;
  check(st.rollbacks + st2.rollbacks > 0, `  rollbacks happened (${st.rollbacks} + ${st2.rollbacks}, longest ${Math.max(st.maxRollback, st2.maxRollback)} ticks)`);
  check(a.session.desyncAt === null && b.session.desyncAt === null && a.session.mySums.size > 10, `  fingerprints compared (${a.session.mySums.size}) with no desync`);
}

console.log(failed ? '\nSome netcode checks FAILED.' : '\nAll netcode checks passed.');
process.exit(failed ? 1 : 0);
