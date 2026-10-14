// The whole simulation: one plain object `S` holds everything that matters for
// gameplay, and `step(S, cmds)` moves it forward by exactly one tick (1/120 s).
//
// Rules for this folder (they make online rollback possible later):
//  - No Math.random (use rng.js), no clocks (Date/performance), no DOM, no settings.
//  - Everything lives in S, so `snapshot(S)` saves the game and restoring it rewinds.
//  - Same S + same commands in = same S out, on any machine.

import {DT, LEFT, RIGHT, CENTER, PX_M, PRESS_BUFFER, COUNTDOWN_READY, COUNTDOWN_GO, KO_TICKS} from './constants.js';
import {clamp, segSeg} from './util.js';
import {mkFighter, mkInput, finishPose, updateFighter} from './fighter.js';
import {bladeContact, clash, kill} from './combat.js';
import {mkAI, aiStep} from './ai.js';
import {rand} from './rng.js';
import {emit} from './events.js';

export function createGame(seed) {
  const S = {
    tick: 0, rng: seed | 0,
    mode: {demo: true, vsCPU: false, diff: 'normal', target: 5},
    phase: 'countdown', // countdown → fight → ko → (next round) … → over
    timer: 0,           // ticks spent in the current phase (countdown / ko)
    scores: [0, 0], koWho: null, clashCD: 0, hitstop: 0, demoRounds: 0,
    F: [null, null], inp: [mkInput(), mkInput()], AI: [mkAI(), mkAI()],
  };
  startRound(S);
  return S;
}

// A deep copy of the game, for rollback (and for the determinism test).
export const snapshot = S => structuredClone(S);

// Is player p controlled by the CPU? (In the menu's demo bout, both are.)
export const isAI = (S, p) => S.mode.demo || (p === 1 && S.mode.vsCPU);

// Start the menu exhibition bout, or a real match.
// opts: {demo, vsCPU, diff, target, seed}
export function newMatch(S, opts) {
  S.rng = opts.seed | 0;
  S.mode = {demo: !!opts.demo, vsCPU: !!opts.vsCPU, diff: opts.diff || 'normal', target: opts.target || 5};
  S.scores = [0, 0]; S.demoRounds = 0;
  if (S.mode.demo) { S.AI[0].diff = S.AI[1].diff = 'normal'; }
  else S.AI[1].diff = S.mode.diff;
  emit('matchStart');
  startRound(S);
}

function startRound(S) {
  S.F[0] = mkFighter(0, CENTER - 2 * PX_M, 1); S.F[1] = mkFighter(1, CENTER + 2 * PX_M, -1);
  for (const f of S.F) finishPose(f);
  for (const i of S.inp) { for (const k in i.buf) i.buf[k] = 0; }
  for (const a of S.AI) { a.t = rand(S, .2, .5); a.move = 0; a.holdUp = 0; a.targetAng = .2; }
  S.phase = 'countdown'; S.timer = 0; S.koWho = null; S.hitstop = 0;
  emit('roundStart');
}

function roundOver(S, k1, k2) {
  S.phase = 'ko'; S.timer = 0; S.koWho = k1 && k2 ? 'double' : (k1 ? 0 : 1);
  if (S.koWho === 'double') { emit('lamp', {p: 0, on: true}); emit('lamp', {p: 1, on: true}); emit('callout', {text: 'COUP DOUBLE', color: 'ink', dur: 1.6}); }
  else { emit('lamp', {p: S.koWho, on: true}); emit('callout', {text: 'TOUCHÉ', color: S.koWho ? 'green' : 'red', dur: 1.6}); }
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
function applyCommand(i, cmd) {
  if (!cmd) return;
  for (const k in cmd.held) i[k] = cmd.held[k];
  for (const a of cmd.presses) i.buf[a] = PRESS_BUFFER;
  i.aim = cmd.aim;
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

  const dt = DT, ph = S.phase, live = ph === 'fight' || ph === 'ko' || ph === 'over';
  for (let p = 0; p < 2; p++) if (isAI(S, p)) aiStep(S, p, dt);
  const [a, b] = S.F;
  if (live) { updateFighter(a, S.inp[0], b, dt); updateFighter(b, S.inp[1], a, dt); }
  else for (const f of S.F) if (f.alive) finishPose(f);

  // bodies don't overlap
  if (a.alive && b.alive) {
    const dx = b.x - a.x;
    if (Math.abs(dx) < 20 && Math.abs(a.y - b.y) < 70) { const push = (20 - Math.abs(dx)) / 2 * (Math.sign(dx) || 1); a.x = clamp(a.x - push, LEFT, RIGHT); b.x = clamp(b.x + push, LEFT, RIGHT); }
  }

  // blade against blade
  if (S.clashCD > 0) S.clashCD -= dt;
  let clashed = false;
  if (live && a.alive && b.alive && S.clashCD <= 0) { const r = segSeg(a.P.hand, a.P.tip, b.P.hand, b.P.tip); if (r.d < 5) { clash(S, a, b, r.p); clashed = true; } }

  // blade against body: a lethal touch ends the round, a harmless one nudges
  if (ph === 'fight' && !clashed && a.alive && b.alive) {
    const h1 = bladeContact(a, b), h2 = bladeContact(b, a), k1 = h1 && h1.lethal, k2 = h2 && h2.lethal;
    if (k1) kill(b, h1); if (k2) kill(a, h2);
    if (k1 || k2) roundOver(S, k1, k2);
    else { if (h1) b.x = clamp(b.x + Math.sign(b.x - a.x || 1) * .6, LEFT, RIGHT); if (h2) a.x = clamp(a.x + Math.sign(a.x - b.x || 1) * .6, LEFT, RIGHT); }
  }

  updateFlow(S);
  return true;
}
