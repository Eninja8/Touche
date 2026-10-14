// The connection between two players, using PeerJS (WebRTC).
//
// PeerJS's free public server only introduces the two browsers to each other
// (using the room code). After that, messages go directly between the players
// (or through PeerJS's free relay if a network blocks direct connections).
//
// Everything else talks to a simple "link": {send(msg), onMessage(fn), onClose(fn), close()}.
// Swapping PeerJS for Steam networking later only means writing another link.
//
// Testing tip: add ?lag=100&jitter=20&loss=5 to the page address to fake a bad
// connection (milliseconds of delay each way, random extra delay, % of packets lost).

const PEERJS_URL = 'src/vendor/peerjs-1.5.5.min.js';
const ID_PREFIX = 'touche-v1-';                      // keeps our room codes apart from other PeerJS apps
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I, which are easy to mix up
export const CODE_LENGTH = 4;

export const makeCode = () => Array.from({length: CODE_LENGTH}, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');
export const cleanCode = s => (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH);

// Load the PeerJS library the first time online play is used.
let loading = null;
function loadPeerJS() {
  if (window.Peer) return Promise.resolve();
  loading ||= new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = PEERJS_URL;
    s.onload = res; s.onerror = () => { loading = null; rej(new Error('Online play failed to load.')); };
    document.head.appendChild(s);
  });
  return loading;
}

// Plain-language messages for PeerJS errors.
function explain(err) {
  switch (err && err.type) {
    case 'peer-unavailable': return 'No match with that code.';
    case 'network': case 'server-error': case 'socket-error': case 'socket-closed':
      return 'Can\'t reach the server.';
    case 'browser-incompatible': return 'Browser not supported.';
    default: return 'Connection failed' + (err && err.type ? ` (${err.type})` : '') + '.';
  }
}

// Fake-bad-internet settings from the page address (all zero normally).
const q = new URLSearchParams(location.search);
const FAKE = {lag: +q.get('lag') || 0, jitter: +q.get('jitter') || 0, loss: (+q.get('loss') || 0) / 100};

function makeLink(conn, peer) {
  const msgFns = [], closeFns = [];
  let closed = false;
  const fireClose = reason => { if (closed) return; closed = true; for (const fn of closeFns) fn(reason); };
  conn.on('data', d => { for (const fn of msgFns) fn(d); });
  conn.on('close', () => fireClose('closed'));
  conn.on('error', () => fireClose('error'));
  const rawSend = msg => { if (conn.open) { try { conn.send(msg); } catch (e) {} } };
  return {
    send(msg) {
      if (closed) return;
      if (!FAKE.lag && !FAKE.jitter && !FAKE.loss) { rawSend(msg); return; }
      if (Math.random() < FAKE.loss) return;
      setTimeout(() => rawSend(msg), FAKE.lag + Math.random() * FAKE.jitter);
    },
    onMessage: fn => msgFns.push(fn),
    onClose: fn => closeFns.push(fn),
    close() { closed = true; try { conn.close(); } catch (e) {} try { peer.destroy(); } catch (e) {} },
    faked: FAKE.lag || FAKE.jitter || FAKE.loss ? FAKE : null,
  };
}

// Host a match. h = {onCode(code), onConnect(link), onError(message)}. Returns {cancel()}.
export function host(h) {
  let peer = null, cancelled = false, tries = 0, conn = null;
  const start = () => {
    const code = makeCode();
    peer = new window.Peer(ID_PREFIX + code, {debug: 1});
    peer.on('open', () => { if (!cancelled) h.onCode(code); });
    peer.on('connection', c => {
      if (conn) { c.on('open', () => c.close()); return; } // only one opponent per room
      conn = c;
      c.on('open', () => { if (!cancelled) h.onConnect(makeLink(c, peer)); });
    });
    peer.on('error', e => {
      if (cancelled) return;
      if (e.type === 'unavailable-id' && tries++ < 5) { peer.destroy(); start(); return; } // code taken: pick another
      if (!conn) h.onError(explain(e));
    });
  };
  loadPeerJS().then(() => { if (!cancelled) start(); }, e => h.onError(e.message));
  return {cancel() { cancelled = true; if (peer && !conn) peer.destroy(); }};
}

// Join a match by code. h = {onConnect(link), onError(message)}. Returns {cancel()}.
export function join(code, h) {
  let peer = null, cancelled = false, done = false;
  const fail = msg => { if (cancelled || done) return; done = true; h.onError(msg); try { peer.destroy(); } catch (e) {} };
  loadPeerJS().then(() => {
    if (cancelled) return;
    peer = new window.Peer({debug: 1});
    peer.on('error', e => fail(explain(e)));
    peer.on('open', () => {
      const c = peer.connect(ID_PREFIX + code, {reliable: false, serialization: 'json'});
      const timer = setTimeout(() => fail('Couldn\'t connect. Try another network.'), 15000);
      c.on('open', () => { clearTimeout(timer); if (cancelled || done) return; done = true; h.onConnect(makeLink(c, peer)); });
    });
  }, e => fail(e.message));
  return {cancel() { cancelled = true; if (peer && !done) peer.destroy(); }};
}
