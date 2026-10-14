// Connection measurements for the network stats overlay (press N; see ui/netpanel.js).
// Purely for showing: nothing here changes the game.
//   ping:    round-trip time of our ping messages (4 a second), last value and history
//   jitter:  how unevenly the opponent's input packets arrive, in ms. Every input packet
//            carries the time it was sent; if packets sent 8 ms apart arrive 30 ms apart,
//            that's 22 ms of jitter. Smoothed like RTP's jitter (RFC 3550).
//   loss:    share of the opponent's input packets (numbered 1, 2, 3...) that never
//            arrived, over the last 3 seconds
//   rollback frames/s: how many ticks per second were re-simulated after a wrong guess
//   stalls/s: ticks per second the game had to wait for the opponent (a visible hitch)

const HISTORY = 80;     // ping samples kept for the graph (20 s at 4 a second)
const LOSS_WINDOW = 3000;

export const ns = {ping: 0, pings: [], jitter: 0, loss: 0, rbPerSec: 0, rbLongest: 0, stallsPerSec: 0, delay: 0, advantage: 0};

const got = new Map(); // packet number → when it arrived
let lastSeq = 0, lastSent = 0, lastArrived = 0;
let rbFrames = 0, rbLongest = 0, stalls = 0, windowStart = 0;

export function resetStats() {
  Object.assign(ns, {ping: 0, pings: [], jitter: 0, loss: 0, rbPerSec: 0, rbLongest: 0, stallsPerSec: 0, delay: 0, advantage: 0});
  got.clear(); lastSeq = lastSent = lastArrived = 0; rbFrames = rbLongest = stalls = 0; windowStart = 0;
}

export function onPong(rtt) {
  ns.ping = rtt; ns.pings.push(rtt);
  if (ns.pings.length > HISTORY) ns.pings.shift();
}

// An input packet from the opponent: q = its number, sentAt = their clock when sent.
export function onInputPacket(q, sentAt, now) {
  if (!q || got.has(q)) return; // (re-sent copies don't count twice)
  got.set(q, now);
  if (q > lastSeq) {
    if (lastSeq) { const d = Math.abs((now - lastArrived) - (sentAt - lastSent)); ns.jitter += (d - ns.jitter) / 16; }
    lastSeq = q; lastSent = sentAt; lastArrived = now;
  }
}

export function onRollback(frames) { rbFrames += frames; rbLongest = Math.max(rbLongest, frames); }
export function onStall() { stalls++; }

// Once a frame: turn the counters into per-second figures and work out the loss.
export function updateStats(now) {
  for (const [q, t] of got) if (now - t > LOSS_WINDOW) got.delete(q);
  if (got.size > 1) { let lo = Infinity, hi = 0; for (const q of got.keys()) { lo = Math.min(lo, q); hi = Math.max(hi, q); } ns.loss = 1 - got.size / (hi - lo + 1); }
  if (now - windowStart >= 1000) {
    const k = windowStart ? 1000 / (now - windowStart) : 0;
    ns.rbPerSec = Math.round(rbFrames * k); ns.rbLongest = rbLongest; ns.stallsPerSec = Math.round(stalls * k);
    rbFrames = rbLongest = stalls = 0; windowStart = now;
  }
}
