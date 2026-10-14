// An online match once both players are connected: starting it, the per-round
// ready handshake, the rollback loop, confirmed KOs (then the local slow-motion
// replay) and rematches. See online.js for the overview.

import {DT} from '../sim/constants.js';
import {newMatch, step, koAnnouncements} from '../sim/game.js';
import {drain} from '../sim/events.js';
import {DEFAULT_MAP} from '../sim/maps.js';
import {RollbackSession, restore} from './rollback.js';
import {encode, decode, EMPTY} from './codec.js';
import {settings} from '../ui/settings.js';
import {sampleOnline, clearKeys} from '../ui/input.js';
import {requestLock} from '../ui/mouse.js';
import {hideScreens} from '../ui/screens.js';
import {setLobbyStatus, setStartEnabled} from '../ui/lobby.js';
import {onKill, hasRagdoll, undoKill, confirmKills, updateFx} from '../view/fx.js';
import {net, hooks, $, sendCtl, setBanner, roundKey} from './state.js';

const STALL_NOTE_MS = 500;
const IDLE = [decode(EMPTY), decode(EMPTY)];

// Host: pick the seed and send the match settings; both computers then set up the same match.
export function hostStartsMatch() {
  const o = settings.lobby.online;
  const start = {t: 'start', no: net.matchNo + 1, seed: (Math.random() * 4294967296) >>> 0, target: o.target, map: o.map || DEFAULT_MAP, hazards: o.hazards !== false};
  sendCtl(start); beginMatch(start);
}

// Both computers set up the identical match, then meet with a ready handshake.
export function beginMatch(c) {
  const S = hooks.app.S;
  net.matchNo = c.no; net.rematch = {me: false, peer: false}; net.kills = {}; net.desync = false;
  newMatch(S, {online: true, seed: c.seed, target: c.target, map: c.map, hazards: c.hazards});
  hooks.dispatch(drain());
  $('over').hidden = true; setStartEnabled(false); setLobbyStatus('Starting…');
  sendReady();
}

function sendReady() {
  net.phase = 'wait';
  sendCtl({t: 'ready', k: roundKey(hooks.app.S)});
  tryStartRound();
}

// Start the round once the opponent is ready for it too.
export function tryStartRound() {
  const S = hooks.app.S;
  if (net.phase !== 'wait' || net.peerReady < roundKey(S)) return;
  const key = roundKey(S);
  net.session = new RollbackSession(S, net.me, key);
  for (const p of net.early) if (p.r === key) net.session.receivePacket(p);
  net.early = []; net.kills = {}; net.acc = 0; net.stallSince = null; net.lastPacket = null;
  net.phase = 'play';
  hideScreens(); $('over').hidden = true;
  clearKeys(); drain();
  setBanner(null);
}

// A touch has been confirmed at frame koFrame: rewind to exactly that moment
// (the confirmed state), make sure the right body is on the floor, announce it,
// and play the rest of the round locally in slow motion.
function enterKO(koFrame) {
  const S = hooks.app.S, s = net.session, st = s.stateAt(koFrame);
  net.lastPacket = s.makePacket();
  if (st !== S) restore(S, st);
  net.session = null; net.phase = 'ko'; drain();
  reconcileKills([]); confirmKills();
  hooks.dispatch(koAnnouncements(S));
  net.slow = .8; net.acc = 0; setBanner(null);
}

// After a rewind, the corrected timeline may have killed someone else (or nobody).
function reconcileKills(events) {
  const S = hooks.app.S;
  for (const e of events) if (e.type === 'kill') net.kills[e.victim.id] = e;
  for (let p = 0; p < 2; p++) {
    const dead = !S.F[p].alive, body = hasRagdoll(p);
    if (dead && !body && net.kills[p]) onKill(net.kills[p].victim, net.kills[p].hit, true);
    else if (!dead && body) { undoKill(p); delete net.kills[p]; }
  }
}

export function requestRematch() {
  if (net.phase !== 'over' || net.rematch.me) return;
  net.rematch.me = true;
  if (settings.mouseAim) requestLock().catch(() => {});
  sendCtl({t: 'rematch'});
  $('overHint').textContent = net.rematch.peer ? 'Starting…' : 'Waiting for opponent…';
  if (net.me === 0 && net.rematch.peer) hostStartsMatch();
}

// Per screen frame: run rollback ticks while playing, plain local ticks during the KO replay.
export function matchFrame(rdt, now) {
  if (net.phase === 'play') {
    const s = net.session;
    net.acc += rdt;
    // Time sync: if we're running ahead of the opponent, hold back a tick now and then.
    if (s.frameAdvantage(net.rtt) > 1.5 && --net.syncWait <= 0) { net.acc -= DT; net.syncWait = 6; }
    let n = 0;
    while (net.acc >= DT && n < 12 && net.phase === 'play') { tickPlay(now); net.acc -= DT; n++; }
    if (n >= 12) net.acc = 0;
  } else if (net.phase === 'ko' || net.phase === 'over') {
    let ts = 1;
    if (net.slow > 0) { net.slow -= rdt; const k = Math.max(0, net.slow) / .8; ts = 1 - .8 * Math.pow(k, .6); }
    net.acc += rdt * ts;
    let n = 0;
    while (net.acc >= DT && n < 12 && (net.phase === 'ko' || net.phase === 'over')) { tickLocal(); net.acc -= DT; n++; }
    if (n >= 12) net.acc = 0;
  }
}

function tickPlay(now) {
  const S = hooks.app.S, s = net.session;
  const re = s.applyRollback(); if (re) reconcileKills(re);
  const ko = s.scanConfirmed();
  for (const x of s.newSums.splice(0)) net.link.send({t: 'sum', r: s.round, f: x.f, h: x.h});
  if (s.desyncAt !== null && !net.desync) {
    net.desync = true;
    console.error(`[Touché] Desync: the two games disagreed at frame ${s.desyncAt} of round ${S.round}.`);
    setBanner('Desync detected. Please report this.', true);
  }
  if (ko !== null) { enterKO(ko); return; }
  if (!s.canAdvance()) {
    net.stallSince ??= now;
    if (now - net.stallSince > STALL_NOTE_MS && !net.desync) setBanner('Waiting for opponent…');
    net.link.send(s.makePacket());
    return;
  }
  if (net.stallSince !== null) { net.stallSince = null; if (!net.desync) setBanner(null); }
  const {events, moved} = s.advance(encode(sampleOnline(S)));
  for (const e of events) if (e.type === 'kill') net.kills[e.victim.id] = e;
  hooks.dispatch(events, true);
  if (moved) updateFx(S, DT);
  net.link.send(s.makePacket());
}

// KO replay and game-over: plain local ticks with no inputs (identical on both computers).
function tickLocal() {
  const S = hooks.app.S;
  const moved = step(S, IDLE);
  hooks.dispatch(drain());
  if (moved) updateFx(S, DT);
  if (net.phase === 'ko') {
    if (S.phase === 'countdown') sendReady();             // next round is set up: meet the opponent
    else if (S.phase === 'over') { net.phase = 'over'; $('overHint').textContent = ''; }
  }
}
