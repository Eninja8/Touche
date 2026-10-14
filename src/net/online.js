// Online 1v1: lobby, match flow and the rollback loop, glued to the UI.
//
// How a match runs:
//  1. Lobby: the host gets a room code; the opponent joins with it. The host is
//     Red (player 0), the joiner is Green (player 1). The host's lobby options
//     are shown to the joiner. Both click Ready (grabbing the mouse); when the
//     host then presses Start, it picks the random
//     seed and sends it with the options, so both games start identical.
//  2. Each round starts with a "ready" handshake, then runs with rollback
//     (rollback.js): only inputs are sent, both computers simulate everything.
//  3. When a touch is CONFIRMED (both players' real inputs agree it happened),
//     the round is over and inputs no longer matter. Each computer then plays
//     the KO in slow motion on its own (no network needed: same state in, same
//     result out), and both meet again with a ready handshake for the next round.
//     Until a touch is confirmed, only the ragdoll shows; the TOUCHÉ callout,
//     scoring lamp and point wait, because a rollback could still undo the touch.

import {DT} from '../sim/constants.js';
import {newMatch, step, koAnnouncements} from '../sim/game.js';
import {drain} from '../sim/events.js';
import {DEFAULT_MAP} from '../sim/maps.js';
import {RollbackSession, restore} from './rollback.js';
import {encode, decode, EMPTY} from './codec.js';
import * as transport from './transport.js';
import {settings} from '../ui/settings.js';
import {sampleOnline, setOnlinePlayer, clearKeys} from '../ui/input.js';
import {requestLock, releaseLock, isLocked, onLockChange} from '../ui/mouse.js';
import {showScreen, hideScreens, onBack} from '../ui/screens.js';
import {openLobby, lobbyValues, setLobbyValues, setLobbyStatus, setLobbyError, setStartEnabled, setReadyButton} from '../ui/lobby.js';
import {onKill, hasRagdoll, undoKill, confirmKills, updateFx} from '../view/fx.js';

const PROTOCOL = 7;          // bump when online play or gameplay changes, so mismatched versions refuse to play
const TIMEOUT_MS = 5000;     // no message for this long = disconnected
const PING_MS = 500, RESEND_MS = 300, STALL_NOTE_MS = 500;
const IDLE = [decode(EMPTY), decode(EMPTY)];
const BYE = {t: 'ctl', id: 1e9, m: {t: 'bye'}}; // 'I am leaving' (sent once, no need to confirm)
const $ = id => document.getElementById(id);

let hooks = null; // {app, dispatch, hud, showMessage}

const net = {
  phase: 'off',   // off | lobby | connected | wait | play | ko | over
  lobby: null, link: null, me: 0, matchNo: 0,
  session: null, early: [],        // inputs that arrived before our round started
  peerReady: 0, lastPacket: null,  // last input packet, re-sent while waiting (in case it was lost)
  acc: 0, slow: 0, syncWait: 0, fake: '',
  rtt: 0, lastHeard: 0, lastPing: 0, lastHud: 0, lastResend: 0,
  ctlId: 1, unacked: new Map(), seen: new Set(),
  stallSince: null, kills: {}, rematch: {me: false, peer: false}, desync: false,
  ready: {me: false, peer: false}, // lobby: who has clicked Ready
};

export const isActive = () => ['connected', 'wait', 'play', 'ko', 'over'].includes(net.phase);
export const inMatch = () => ['wait', 'play', 'ko'].includes(net.phase);
export const localPlayer = () => net.me;
export const ping = () => net.link ? Math.round(net.rtt) : null;

export function initOnline(h) {
  hooks = h;
  $('bonline').addEventListener('click', openOnlineMenu);
  $('bhost').addEventListener('click', hostMatch);
  $('bjoinOpen').addEventListener('click', openJoin);
  $('bjoin').addEventListener('click', joinMatch);
  $('joinCode').addEventListener('keydown', e => { if (e.key === 'Enter') joinMatch(); });
  $('joinCode').addEventListener('input', e => { e.target.value = transport.cleanCode(e.target.value); });
  $('bcopy').addEventListener('click', copyCode);
  const toPlay = () => { leave(); showScreen('play', 'bonline'); };
  $('bonlineBack').addEventListener('click', toPlay); onBack('onlineMenu', toPlay);
  $('bjoinBack').addEventListener('click', openOnlineMenu); onBack('joinScreen', openOnlineMenu);
  $('bnetmsgOk').addEventListener('click', () => { $('netmsg').hidden = true; hooks.app.showMenu(); });
  onBack('netmsg', () => { $('netmsg').hidden = true; hooks.app.showMenu(); });
  // closing or reloading the page: tell the opponent straight away instead of letting them time out
  addEventListener('pagehide', () => { if (net.link) net.link.send(BYE); });
  // losing the mouse in the lobby (Esc, alt-tab) un-readies you
  onLockChange(locked => { if (!locked && net.phase === 'connected' && net.ready.me && settings.mouseAim) setReady(false); });
  // with the mouse grabbed the cursor is hidden, so the host can click anywhere to Start
  $('cv').addEventListener('mousedown', () => { if (net.phase === 'connected' && net.me === 0 && isLocked() && bothReady()) hostStart(); });
}

// ---------- lobby ----------

// Online → Host / Join. (Also where Back from a lobby or the join screen lands.)
function openOnlineMenu() {
  leave(); net.phase = 'lobby';
  showScreen('onlineMenu', 'bhost');
}

function openJoin() {
  $('joinStatus').textContent = ''; $('joinError').textContent = '';
  showScreen('joinScreen', 'joinCode');
}

// Host: the lobby with the room code and editable match options. Start once both are ready.
function hostMatch() {
  openLobby('online', {code: true, onStart: hostStart, onReady: pressReady, onBack: openOnlineMenu, onChange: sendLobby});
  setStartEnabled(false); $('bready').disabled = true; setLobbyStatus('Getting code…'); $('bcopy').focus({preventScroll: true});
  net.lobby = transport.host({
    onCode: code => { $('roomCode').textContent = code; setLobbyStatus('Waiting for opponent…'); },
    onConnect: link => connected(link, 0),
    onError: msg => { setLobbyError(msg); },
  });
}

function joinMatch() {
  const code = transport.cleanCode($('joinCode').value);
  if (code.length !== transport.CODE_LENGTH) { $('joinError').textContent = `Codes have ${transport.CODE_LENGTH} letters.`; return; }
  if (net.lobby) net.lobby.cancel();
  $('joinStatus').textContent = 'Connecting…'; $('joinError').textContent = '';
  net.lobby = transport.join(code, {
    onConnect: link => connected(link, 1),
    onError: msg => { $('joinStatus').textContent = ''; $('joinError').textContent = msg; },
  });
}

function copyCode() {
  const code = $('roomCode').textContent;
  navigator.clipboard.writeText(code).then(() => { $('bcopy').textContent = 'Copied'; setTimeout(() => { $('bcopy').textContent = 'Copy'; }, 1500); }, () => {});
}

const fakeNote = link => link.faked ? ` · fake lag ${link.faked.lag}±${link.faked.jitter} ms, ${Math.round(link.faked.loss * 100)}% loss` : '';

function connected(link, me) {
  net.link = link; net.me = me; net.lobby = null; net.lastHeard = performance.now();
  net.matchNo = 0; net.peerReady = 0; net.unacked.clear(); net.seen.clear(); net.ctlId = 1; net.rtt = 0;
  setOnlinePlayer(me);
  link.onMessage(onMessage);
  link.onClose(() => disconnected('Opponent left.'));
  sendCtl({t: 'hello', v: PROTOCOL});
  net.phase = 'connected'; net.ready = {me: false, peer: false};
  if (me === 0) { $('bready').disabled = false; sendLobby(lobbyValues()); }
  // the joiner sees the host's options, read-only, until the host presses Start
  else openLobby('online', {readOnly: true, values: {...settings.lobby.online}, onReady: pressReady, onBack: openOnlineMenu});
  net.fake = fakeNote(link);
  showReady();
  $('bready').focus({preventScroll: true});
}

// Ready: both players click it (which also grabs the mouse); then the host can Start.
const bothReady = () => net.ready.me && net.ready.peer;
function pressReady() {
  if (net.phase !== 'connected') return;
  if (net.ready.me) { setReady(false); releaseLock(); return; }
  setLobbyError('');
  if (!settings.mouseAim) { setReady(true); return; }
  requestLock().then(() => setReady(true), () => setLobbyError('Click Ready again.'));
}
function setReady(on) {
  if (net.ready.me === on) return;
  net.ready.me = on; sendCtl({t: 'rdy', on}); showReady();
}
function showReady() {
  setReadyButton(net.ready.me);
  const them = net.ready.peer ? 'Opponent ready' : 'Opponent not ready';
  if (net.me === 0) {
    setStartEnabled(bothReady());
    setLobbyStatus((bothReady() ? 'Click or press Enter to start' : them) + net.fake);
    if (bothReady()) $('bstart').focus({preventScroll: true});
  } else setLobbyStatus((net.ready.me && net.ready.peer ? 'Waiting for host to start…' : them) + net.fake);
}

// Host changed a lobby option: show it to the joiner.
function sendLobby(v) { if (net.link && net.me === 0 && net.phase === 'connected') sendCtl({t: 'lobby', s: v}); }

function hostStart() {
  if (net.phase !== 'connected' || !bothReady()) return;
  if (settings.mouseAim) requestLock().catch(() => {});
  hostStartsMatch();
}

// ---------- match flow ----------

const roundKey = S => net.matchNo * 1000 + S.round; // unique per round, per match

function hostStartsMatch() {
  const o = settings.lobby.online;
  const start = {t: 'start', no: net.matchNo + 1, seed: (Math.random() * 4294967296) >>> 0, target: o.target, map: o.map || DEFAULT_MAP, hazards: o.hazards !== false};
  sendCtl(start); beginMatch(start);
}

// Both computers set up the identical match, then meet with a ready handshake.
function beginMatch(c) {
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

function tryStartRound() {
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

function requestRematch() {
  if (net.phase !== 'over' || net.rematch.me) return;
  net.rematch.me = true;
  if (settings.mouseAim) requestLock().catch(() => {});
  sendCtl({t: 'rematch'});
  $('overHint').textContent = net.rematch.peer ? 'Starting…' : 'Waiting for opponent…';
  if (net.me === 0 && net.rematch.peer) hostStartsMatch();
}
export {requestRematch};

// ---------- per-frame update (called by main.js instead of the local loop) ----------

export function frame(rdt, now) {
  pump(now);
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

// ---------- messages ----------

function onMessage(m) {
  net.lastHeard = performance.now();
  switch (m.t) {
    case 'ctl':
      net.link.send({t: 'ack', id: m.id});
      if (net.seen.has(m.id)) return;
      net.seen.add(m.id); handleCtl(m.m); return;
    case 'ack': net.unacked.delete(m.id); return;
    case 'in':
      if (net.session && m.r === net.session.round) net.session.receivePacket(m);
      else if (m.r > roundKey(hooks.app.S) && net.early.length < 300) net.early.push(m); // a round we haven't started yet
      return;
    case 'sum': if (net.session && m.r === net.session.round) net.session.addPeerSum(m.f, m.h); return;
    case 'ping': net.link.send({t: 'pong', ts: m.ts}); return;
    case 'pong': { const r = performance.now() - m.ts; net.rtt = net.rtt ? net.rtt * .8 + r * .2 : r; return; }
  }
}

function handleCtl(c) {
  switch (c.t) {
    case 'hello':
      if (c.v !== PROTOCOL) disconnected('Different game version. Both refresh the page.');
      return;
    case 'start':
      if (net.me !== 1) return;
      if (settings.mouseAim) requestLock().catch(() => {}); // may need a click (Resume) if the browser refuses
      beginMatch(c); return;
    case 'lobby': if (net.me === 1) setLobbyValues(c.s); return;
    case 'rdy': net.ready.peer = !!c.on; if (net.phase === 'connected') showReady(); return;
    case 'ready':
      net.peerReady = Math.max(net.peerReady, c.k);
      tryStartRound(); return;
    case 'rematch':
      net.rematch.peer = true;
      if (net.phase === 'over' && !net.rematch.me) $('overHint').textContent = 'Opponent wants a rematch';
      if (net.me === 0 && net.rematch.me) hostStartsMatch();
      return;
    case 'bye': disconnected('Opponent left.'); return;
  }
}

// Control messages (start, ready, rematch...) must arrive, so they are re-sent until acknowledged.
function sendCtl(m) {
  const id = net.ctlId++, pkt = {t: 'ctl', id, m};
  net.unacked.set(id, pkt); net.link.send(pkt);
}

// Housekeeping every frame: re-send, ping, timeouts, the ping display.
function pump(now) {
  if (!net.link) return;
  if (now - net.lastResend > RESEND_MS) {
    net.lastResend = now;
    for (const pkt of net.unacked.values()) net.link.send(pkt);
    // after a confirmed KO, keep our last inputs coming in case the opponent hasn't confirmed it yet
    if (net.lastPacket && (net.phase === 'ko' || net.phase === 'wait')) net.link.send(net.lastPacket);
  }
  if (now - net.lastPing > PING_MS) { net.lastPing = now; net.link.send({t: 'ping', ts: now}); }
  if (now - net.lastHeard > TIMEOUT_MS) { disconnected('Connection lost.'); return; }
  if (now - net.lastHud > 1000) { net.lastHud = now; hooks.hud(); }
}

// ---------- leaving ----------

function reset() {
  if (net.lobby) net.lobby.cancel();
  if (net.link) net.link.close();
  Object.assign(net, {phase: 'off', lobby: null, link: null, session: null, early: [], lastPacket: null, stallSince: null, kills: {}});
  net.unacked.clear(); net.seen.clear();
  setOnlinePlayer(-1); setBanner(null);
}

// We chose to leave (menu button, Back, Quit).
export function leave() {
  if (net.link) { try { net.link.send(BYE); } catch (e) {} }
  reset();
}

function disconnected(msg) {
  if (net.phase === 'off') return;
  reset(); releaseLock();
  hideScreens(); for (const id of ['over', 'pause', 'settings']) $(id).hidden = true;
  $('netmsgTitle').textContent = 'Match over'; $('netmsgText').textContent = msg; $('netmsg').hidden = false;
  $('bnetmsgOk').focus({preventScroll: true});
}

function setBanner(text, bad) {
  const b = $('netBanner'); b.hidden = !text; b.textContent = text || ''; b.classList.toggle('bad', !!bad);
}
