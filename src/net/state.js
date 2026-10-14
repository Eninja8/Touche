// Shared state for online play (used by online.js and match.js): the connection
// and match status, the hooks into the rest of the game, and small helpers.

export const PROTOCOL = 10;   // bump when online play or gameplay changes, so mismatched versions refuse to play
export const $ = id => document.getElementById(id);

// Set by initOnline: {app, dispatch, hud}
export const hooks = {};

export const net = {
  phase: 'off',   // off | lobby | connected | wait | play | ko | over
  lobby: null, link: null, me: 0, matchNo: 0,
  session: null, early: [],        // inputs that arrived before our round started
  peerReady: 0, lastPacket: null,  // last input packet, re-sent while waiting (in case it was lost)
  acc: 0, slow: 0, syncWait: 0, fake: '', seq: 0, // seq: number of the last input packet sent
  rtt: 0, lastHeard: 0, lastPing: 0, lastHud: 0, lastResend: 0,
  ctlId: 1, unacked: new Map(), seen: new Set(),
  stallSince: null, kills: {}, rematch: {me: false, peer: false}, desync: false,
  ready: {me: false, peer: false}, // lobby: who has clicked Ready
};

// A number unique to each round of each match (the ready handshake and input packets carry it).
export const roundKey = S => net.matchNo * 1000 + S.round;

// Control messages (start, ready, rematch...) must arrive, so they are re-sent until acknowledged.
export function sendCtl(m) {
  const id = net.ctlId++, pkt = {t: 'ctl', id, m};
  net.unacked.set(id, pkt); net.link.send(pkt);
}

// The small note over the arena ("Waiting for opponent…", desync warning).
export function setBanner(text, bad) {
  const b = $('netBanner'); b.hidden = !text; b.textContent = text || ''; b.classList.toggle('bad', !!bad);
}
