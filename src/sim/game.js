// The whole simulation: one plain object `S` holds everything that matters for
// gameplay, and `step(S, cmds)` moves it forward by exactly one tick (1/120 s).
//
// Rules for this folder (they make online rollback possible later):
//  - No Math.random (use rng.js), no clocks (Date/performance), no DOM, no settings.
//  - Everything lives in S, so `snapshot(S)` saves the game and restoring it rewinds.
//  - Same S + same commands in = same S out, on any machine.

import {DT, PRESS_BUFFER, AIM_REACH, COUNTDOWN_READY, COUNTDOWN_GO, KO_TICKS} from './constants.js';
import {clamp, segSeg} from './util.js';
import {mkFighter, mkInput, finishPose, updateFighter} from './fighter.js';
import {bladeContact, bladePush, clash, kill} from './combat.js';
import {mkAI, aiStep, resetAI} from './ai.js';
import {rand, random} from './rng.js';
import {getMap, MAPS, MAP_KEYS, DEFAULT_MAP} from './maps.js';
import {hazardHit, pushX} from './terrain.js';
import {emit} from './events.js';

// A brand-new game state with nothing carried over.
function freshState(seed) {
  return {
    tick: 0, rng: seed | 0, map: DEFAULT_MAP,
    mode: {demo: true, vsCPU: false, online: false, diff: 'normal', target: 5, hazards: true, mapPick: null},
    phase: 'countdown', // countdown → fight → ko → (next round) … → over
    timer: 0,           // ticks spent in the current phase (countdown / ko)
    round: 0,           // round number within the current match (online play uses it to stay in step)
    scores: [0, 0], koWho: null, clashCD: 0, hitstop: 0, demoRounds: 0,
    F: [null, null], inp: [mkInput(), mkInput()], AI: [mkAI(), mkAI()],
  };
}

export function createGame(seed) {
  const S = freshState(seed);
  startRound(S);
  return S;
}

// A deep copy of the game, for rollback (and for the determinism test).
export const snapshot = S => structuredClone(S);

// Is player p controlled by the CPU? (In the menu's demo bout, both are.)
export const isAI = (S, p) => S.mode.demo || (p === 1 && S.mode.vsCPU);

// Start the menu exhibition bout, or a real match.
// opts: {demo, vsCPU, online, diff, target, seed, map, hazards}
// map: a map name, or 'match' (a random map for the whole match) or 'round' (a new random
// map every round). The random picks use the match seed, so online both computers agree.
export function newMatch(S, opts) {
  // Wipe everything from before (such as the menu's demo bout) so that two
  // computers starting the same online match start from identical states.
  for (const k of Object.keys(S)) delete S[k];
  Object.assign(S, freshState(opts.seed));
  const pick = opts.map === 'match' || opts.map === 'round' ? opts.map : null;
  S.mode = {demo: !!opts.demo, vsCPU: !!opts.vsCPU, online: !!opts.online, diff: opts.diff || 'normal', target: opts.target || 5, hazards: opts.hazards !== false, mapPick: pick};
  S.map = pick ? pickMap(S) : MAPS[opts.map] ? opts.map : DEFAULT_MAP;
  if (S.mode.demo) { S.AI[0].diff = S.AI[1].diff = 'normal'; }
  else S.AI[1].diff = S.mode.diff;
  emit('matchStart');
  startRound(S);
}

// A random map, different from the current one.
function pickMap(S) {
  const others = MAP_KEYS.filter(k => k !== S.map);
  return others[Math.floor(random(S) * others.length)];
}

function startRound(S) {
  if (S.mode.mapPick === 'round' && S.round > 0) S.map = pickMap(S);
  const m = getMap(S);
  for (let p = 0; p < 2; p++) { const sp = m.spawns[p]; S.F[p] = mkFighter(p, sp.x, sp.y, sp.face); }
  for (const f of S.F) finishPose(f);
  for (const i of S.inp) { for (const k in i.buf) i.buf[k] = 0; }
  for (const a of S.AI) { resetAI(a); a.t = rand(S, .2, .5); }
  S.phase = 'countdown'; S.timer = 0; S.koWho = null; S.hitstop = 0; S.round++;
  emit('roundStart', {map: S.map, name: m.name});
}

// The lamp and callout events are tagged 'ko' so online play can hold them back
// until both players' real inputs confirm the touch (see src/net/online.js).
function roundOver(S, k1, k2) {
  S.phase = 'ko'; S.timer = 0; S.koWho = k1 && k2 ? 'double' : (k1 ? 0 : 1);
  for (const e of koAnnouncements(S)) emit(e.type, {...e, ko: true});
}

// What to show when a round ends: scoring lamp(s) and the big callout.
export function koAnnouncements(S) {
  if (S.koWho === 'double') return [{type: 'lamp', p: 0, on: true}, {type: 'lamp', p: 1, on: true}, {type: 'callout', text: 'COUP DOUBLE', color: 'ink', dur: 1.6}];
  return [{type: 'lamp', p: S.koWho, on: true}, {type: 'callout', text: 'TOUCHÉ', color: S.koWho ? 'green' : 'red', dur: 1.6}];
}

function endRound(S) {
  if (S.mode.demo) { if (++S.demoRounds % 6 === 0) emit('clearDecals'); startRound(S); return; }
  if (S.koWho === 0 || S.koWho === 1) S.scores[S.koWho]++;
  emit('score');
  const w = S.scores[0] >= S.mode.target ? 0 : S.scores[1] >= S.mode.target ? 1 : -1;
  if (w >= 0) { S.phase = 'over'; emit('matchOver', {winner: w}); }
  else startRound(S);
}

// Copy a human's command for this tick into their input record.
// cmd = {held: {left,right,up,down,raise,lower}, presses: ['attack', ...], aim: {x,y} | null}
// aim is the mouse crosshair's offset from the shoulder. It is rounded to whole
// pixels here, so every machine sees exactly the same value ("|| 0" turns minus
// zero into plain zero; see codec.js).
function applyCommand(i, cmd) {
  if (!cmd) return;
  for (const k in cmd.held) i[k] = cmd.held[k];
  for (const a of cmd.presses) i.buf[a] = PRESS_BUFFER;
  const q = v => Math.round(clamp(v, -AIM_REACH, AIM_REACH)) || 0;
  i.aim = cmd.aim ? {x: q(cmd.aim.x), y: q(cmd.aim.y)} : null;
}

// Spikes (or a fall out of the world) kill like a blade does.
function spiked(f, at) {
  emit('sfx', {name: 'spike'});
  kill(f, {p: at, vx: f.vx * .3, vy: Math.min(f.vy, 200) * .3, sp: 120, part: 'spikes', tip: false, lethal: true});
}

// Countdown calls and the pause after a touch.
function updateFlow(S) {
  if (S.phase === 'countdown') {
    if (S.timer === 0) { emit('callout', {text: 'EN GARDE', color: 'ink', dur: .55}); emit('sfx', {name: 'ready'}); }
    S.timer++;
    if (S.timer === COUNTDOWN_READY) { emit('callout', {text: 'PRÊTS ?', color: 'ink', dur: .45}); emit('sfx', {name: 'ready'}); }
    if (S.timer === COUNTDOWN_GO) { emit('callout', {text: 'ALLEZ !', color: 'spark', dur: .55}); emit('sfx', {name: 'allez'}); S.phase = 'fight'; }
  } else if (S.phase === 'ko') {
    if (++S.timer > KO_TICKS) endRound(S);
  }
}

// Advance one tick. cmds = [player0Command, player1Command] (ignored for CPU players).
// Returns false during clash freeze-frames (nothing moved), true otherwise.
export function step(S, cmds) {
  S.tick++;
  for (let p = 0; p < 2; p++) if (!isAI(S, p)) applyCommand(S.inp[p], cmds[p]);
  if (S.hitstop > 0) { S.hitstop--; return false; }

  const dt = DT, map = getMap(S), ph = S.phase, live = ph === 'fight' || ph === 'ko' || ph === 'over';
  for (let p = 0; p < 2; p++) if (isAI(S, p)) aiStep(S, p, dt);
  const [a, b] = S.F;
  if (live) { updateFighter(a, S.inp[0], b, dt, map); updateFighter(b, S.inp[1], a, dt, map); }
  else for (const f of S.F) if (f.alive) finishPose(f);

  // bodies don't overlap
  if (a.alive && b.alive) {
    const dx = b.x - a.x;
    if (Math.abs(dx) < 20 && Math.abs(a.y - b.y) < 70) { const push = (20 - Math.abs(dx)) / 2 * (Math.sign(dx) || 1); a.x = pushX(a, map, -push); b.x = pushX(b, map, push); }
  }

  // blade against blade
  if (S.clashCD > 0) S.clashCD -= dt;
  let clashed = false;
  if (live && a.alive && b.alive && S.clashCD <= 0) { const r = segSeg(a.P.hand, a.P.tip, b.P.hand, b.P.tip); if (r.d < 5) { clash(S, a, b, r.p); clashed = true; } }

  // blade against body: a lethal touch ends the round, a harmless one is solid (combat.js).
  // After a clash nothing kills this tick, but blades still can't sit inside bodies.
  if (ph === 'fight' && a.alive && b.alive) {
    const h1 = bladeContact(a, b), h2 = bladeContact(b, a), k1 = !clashed && h1 && h1.lethal, k2 = !clashed && h2 && h2.lethal;
    if (k1) kill(b, h1); if (k2) kill(a, h2);
    if (k1 || k2) roundOver(S, k1, k2);
    else { if (h1) bladePush(a, b, map); if (h2) bladePush(b, a, map); }
  }

  // spikes: a touch for the opponent; both at once = coup double
  if (S.phase === 'fight' && a.alive && b.alive) {
    const hA = hazardHit(a, map), hB = hazardHit(b, map);
    if (hA) spiked(a, hA); if (hB) spiked(b, hB);
    if (hA || hB) roundOver(S, !!hB, !!hA);
  }

  updateFlow(S);
  return true;
}
