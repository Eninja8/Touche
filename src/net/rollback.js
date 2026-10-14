// Rollback netcode for one round of online play.
//
// Both computers run the full game. Each tick ("frame"), they swap only their
// inputs. Your own input is scheduled a few frames ahead (the input delay), which gives it
// time to reach the opponent. When the opponent's input for a frame hasn't
// arrived yet, we guess it (see codec.predict) and keep going. When the real
// input arrives and the guess was wrong, we rewind to that frame (restore a
// saved copy of the game) and quickly re-play the frames since, with the
// correct input. That's the "rollback".
//
// This file only talks to the simulation. Sending packets, sounds and drawing
// are handled by online.js, so this can be tested without a browser.

import {step, snapshot} from '../sim/game.js';
import {drain} from '../sim/events.js';
import {DT} from '../sim/constants.js';
import {EMPTY, decode, same, predict} from './codec.js';

// INPUT_DELAY is the smallest delay (ticks; 2 = 17 ms) and what both computers assume for the
// first frames of a round. Each computer may use a longer delay of its own for a round
// (`delay` below; ?delay=N in the page address): its inputs are simply scheduled later, and
// the frame numbers in the packets keep both games in step either way.
export const INPUT_DELAY = 2;
export const MAX_PREDICT = 12; // never guess more than this many ticks (100 ms) past the opponent's real inputs
export const SUM_EVERY = 60;   // compare game "fingerprints" with the opponent twice a second

// Replace the contents of S with a copy of a saved state (S itself stays the same object).
export function restore(S, saved) {
  const copy = snapshot(saved);
  for (const k of Object.keys(S)) delete S[k];
  Object.assign(S, copy);
}

// A short fingerprint of the whole game state (FNV-1a hash of its JSON).
export function hashState(S) {
  const s = JSON.stringify(S); let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16);
}

export class RollbackSession {
  // S: the game state (already at the start of the round). me: 0 = Red (host), 1 = Green.
  // delay: our own input delay for this round (INPUT_DELAY or more).
  constructor(S, me, round, delay = INPUT_DELAY) {
    this.S = S; this.me = me; this.round = round; this.delay = Math.max(INPUT_DELAY, delay | 0);
    this.frame = 0;          // the next frame to simulate
    this.local = [];         // our inputs, by frame (encoded)
    this.remote = [];        // opponent's real inputs, by frame
    this.used = [];          // the opponent input we actually simulated each frame with (real or guessed)
    this.states = [];        // saved game state at the start of each recent frame
    for (let f = 0; f < this.delay; f++) this.local[f] = EMPTY;
    for (let f = 0; f < INPUT_DELAY; f++) this.remote[f] = EMPTY;
    this.remoteMax = INPUT_DELAY - 1;    // we have ALL opponent inputs up to this frame
    this.remoteLatest = INPUT_DELAY - 1; // highest opponent frame received (there may be gaps before it)
    this.ackedByRemote = INPUT_DELAY - 1; // the opponent has all our inputs up to this frame
    this.remoteFrame = 0;    // the opponent's own frame counter, from their last packet (for time sync)
    this.rollbackFrom = Infinity;
    this.scanned = 0;        // confirmed frames already checked for a KO / fingerprinted
    this.mySums = new Map(); this.peerSums = new Map(); this.newSums = []; this.desyncAt = null;
    this.stats = {rollbacks: 0, maxRollback: 0, lastRollback: 0}; // lastRollback: frames re-simulated by the latest one
  }

  // May we simulate another frame, or are we too far ahead of the opponent's real inputs?
  canAdvance() { return this.frame - this.remoteMax <= MAX_PREDICT; }

  // Simulate one new frame with our input for (frame + delay).
  // Returns {events, moved} for this fresh frame.
  advance(localInput) {
    this.local[this.frame + this.delay] = localInput;
    const out = this.simulate(this.frame);
    this.frame++;
    this.prune();
    return out;
  }

  simulate(f) {
    this.states[f] = snapshot(this.S);
    const r = this.remote[f] || predict(this.lastRemoteBefore(f));
    this.used[f] = r;
    const mine = decode(this.local[f]), theirs = decode(r);
    const moved = step(this.S, this.me === 0 ? [mine, theirs] : [theirs, mine]);
    return {events: drain(), moved};
  }

  lastRemoteBefore(f) {
    for (let g = Math.min(f, this.remoteLatest); g >= 0; g--) if (this.remote[g]) return this.remote[g];
    return EMPTY;
  }

  // Store opponent inputs (start = frame of the first one). Mark a rollback if a guess was wrong.
  receiveInputs(start, inputs) {
    for (let k = 0; k < inputs.length; k++) {
      const f = start + k;
      if (f <= this.remoteMax || this.remote[f]) continue;
      this.remote[f] = inputs[k];
      if (f > this.remoteLatest) this.remoteLatest = f;
      if (f < this.frame && !same(inputs[k], this.used[f])) this.rollbackFrom = Math.min(this.rollbackFrom, f);
    }
    while (this.remote[this.remoteMax + 1]) this.remoteMax++;
  }

  // If a guess was wrong: rewind and re-simulate up to the present.
  // Returns the events from the re-simulated frames (null if no rollback was needed).
  // Online play ignores those events except kills (a corrected timeline may kill someone else).
  applyRollback() {
    const f0 = this.rollbackFrom; this.rollbackFrom = Infinity;
    if (f0 >= this.frame) return null;
    restore(this.S, this.states[f0]);
    const events = [];
    for (let f = f0; f < this.frame; f++) events.push(...this.simulate(f).events);
    this.stats.rollbacks++; this.stats.lastRollback = this.frame - f0; this.stats.maxRollback = Math.max(this.stats.maxRollback, this.frame - f0);
    return events;
  }

  // The game state at the start of frame f (must still be saved).
  stateAt(f) { return f === this.frame ? this.S : this.states[f]; }

  // Frames whose state is final: everything before this used real inputs from both players.
  confirmedFrame() { return Math.min(this.remoteMax + 1, this.frame); }

  // Walk newly confirmed frames: fingerprint some, and report the first frame where
  // the round is over (a touch that no rollback can undo). Call after applyRollback().
  scanConfirmed() {
    const c = this.confirmedFrame();
    for (let f = this.scanned + 1; f <= c; f++) {
      const st = this.stateAt(f);
      this.scanned = f;
      if (f % SUM_EVERY === 0) { const h = hashState(st); this.mySums.set(f, h); this.newSums.push({f, h}); this.compareSum(f); }
      if (st.phase !== 'countdown' && st.phase !== 'fight') return f;
    }
    return null;
  }

  addPeerSum(f, h) { this.peerSums.set(f, h); this.compareSum(f); }
  compareSum(f) {
    const a = this.mySums.get(f), b = this.peerSums.get(f);
    if (a && b && a !== b && this.desyncAt === null) this.desyncAt = f;
  }

  // Forget saved states nobody can roll back to any more.
  prune() {
    const keep = Math.min(this.remoteMax, this.frame, this.scanned) - 2;
    for (let f = keep; f >= 0 && this.states[f]; f--) { this.states[f] = undefined; this.used[f] = undefined; }
  }

  // ---------- packets ----------

  // Everything the opponent might still be missing: our unacknowledged inputs,
  // what we have received from them (ack), and our frame number (for time sync).
  makePacket() {
    const last = this.frame - 1 + this.delay, from = Math.max(this.ackedByRemote + 1, last - 119);
    const inputs = []; for (let f = from; f <= last; f++) inputs.push(this.local[f]);
    return {t: 'in', r: this.round, s: from, i: inputs, a: this.remoteMax, f: this.frame};
  }

  receivePacket(p) {
    if (p.r !== this.round) return;
    this.receiveInputs(p.s, p.i);
    if (p.a > this.ackedByRemote) this.ackedByRemote = p.a;
    if (p.f > this.remoteFrame) this.remoteFrame = p.f;
  }

  // How many frames we are ahead of the opponent (positive = we should slow down a little).
  frameAdvantage(rttMs) { return this.frame - (this.remoteFrame + rttMs / 2 / (DT * 1000)); }
}
