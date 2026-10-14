// The CPU getting around: chasing the opponent across the arena (using ai-nav.js's
// map), escaping when cornered, waiting across a pit to bait the opponent over it,
// and never walking into spikes: every few ticks it checks what its current keys
// would do a moment from now, and changes them if that ends on spikes.

import {random, rand} from './rng.js';
import {movesFor, newScript, scriptDone, drive, simulate, wouldDie} from './ai-plan.js';
import {navFor, nodeAt, nodeAtPoint, nextEdge} from './ai-nav.js';

const start = (A, me, m) => { A.script = newScript(m, me); A.edge = -1; };
const landNode = (nav, r) => r.rope >= 0 ? nav.ropeNode[r.rope] : nodeAtPoint(nav, r.x, r.y);

// Carry on with a move in progress (sets the movement keys). Returns true while it runs.
export function runScript(me, i, A, map) {
  const s = A.script; if (!s) return false;
  if (scriptDone(s, me) || s.t > 600) { A.script = null; return false; }
  drive(s, me, i, map);
  return true;
}

// Head for node `goal` (a decision, made every so often). Returns false if there's no
// known way, or we're already there.
export function chase(me, A, map, goal) {
  const nav = navFor(map), n = nodeAt(nav, me);
  if (n < 0 || goal < 0 || n === goal) { A.edge = -1; return false; }
  const best = nextEdge(nav, n, me.x, goal, A.badT > 0 ? A.bad : -1);
  if (!best || best.cost === Infinity) { A.edge = -1; return false; }
  A.edge = best.edge.id; A.goal = goal;
  return true;
}

// Every tick while chasing: walk to where the next move starts; once there, check the
// move still works from exactly here (or find another that gets closer) and do it.
export function followEdge(me, op, A, map) {
  const nav = navFor(map), e = nav.edges[A.edge], n = nodeAt(nav, me);
  if (n !== e.from) { if (n >= 0) A.edge = -1; return; } // knocked off course (or in the air)
  const dx = e.x - me.x;
  A.move = Math.abs(dx) < 4 ? 0 : Math.sign(dx);
  if (Math.abs(dx) > 14 + Math.abs(me.vx) * .04) return;
  // a move is worth doing if it lands on the planned node, or anywhere that's no slower from here
  const plan = nextEdge(nav, n, me.x, A.goal).cost;
  const score = m => {
    const r = simulate(me, map, m, op.x); if (!r || r.dead) return Infinity;
    const to = landNode(nav, r); if (to < 0 || to === n) return Infinity;
    const rest = to === A.goal ? 0 : (nextEdge(nav, to, r.x, A.goal) || {cost: Infinity}).cost; // from where it lands
    return to === e.to || r.t + rest <= plan + .2 ? r.t + rest : Infinity;
  };
  if (score(e.m) < Infinity) { start(A, me, e.m); return; }
  let bm = -1, bc = Infinity;
  for (const m of movesFor(me)) { const c = score(m); if (c < bc) { bc = c; bm = m; } }
  if (bm >= 0) start(A, me, bm);
  else { A.bad = e.id; A.badT = 1.2; A.edge = -1; } // doesn't work from here: try another way for a while
}

// Cornered: a move that lands safely past the opponent or well away from them.
export function escape(me, op, A, map) {
  let bm = -1, bt = Infinity;
  for (const m of movesFor(me)) {
    const r = simulate(me, map, m, op.x); if (!r || r.dead) continue;
    const past = Math.sign(r.x - op.x) === Math.sign(op.x - me.x) && Math.abs(r.x - op.x) > 60;
    const far = Math.abs(r.x - op.x) > 280 || Math.abs(r.y - op.y) > 150;
    if ((past || far) && r.t < bt) { bt = r.t; bm = m; }
  }
  if (bm >= 0) start(A, me, bm);
  return bm >= 0;
}

// The opponent is across a pit on the same level: sometimes wait at our edge with the
// point out, so they have to jump over it (and land on the point, or fall short).
// Returns true while waiting (A.move is set to hold the spot).
export function bait(S, me, op, A, d, map, dt) {
  const nav = navFor(map), n = nodeAt(nav, me), o = nodeAt(nav, op);
  if (n < 0 || o < 0 || n === o || nav.nodes[n].rope || nav.nodes[o].rope || nav.nodes[n].y !== nav.nodes[o].y) { A.waitT = 0; return false; }
  const toward = Math.sign(op.x - me.x) || 1, s = nav.nodes[n], edge = toward > 0 ? s.x1 : s.x0;
  if (!s.lethal[toward > 0 ? 1 : 0] || Math.abs(op.x - me.x) > 560) { A.waitT = 0; return false; }
  if (A.waitT <= 0) { if (random(S) >= d.bait) return false; A.waitT = rand(S, 1.2, 2.6); }
  A.waitT -= dt;
  const spot = edge - toward * 55;
  A.move = Math.abs(spot - me.x) < 8 ? 0 : Math.sign(spot - me.x);
  return true;
}

// Never walk, dash, slide, lunge or jump onto spikes: if the keys set for this tick would
// lead there within about 0.4 s, change them (stop, turn back, or in the air find a safe
// landing). Easy CPUs sometimes forget to check.
export function guard(S, me, op, i, A, d, map) {
  if (A.script || (S.tick + me.id) % 3 || !me.alive) return;
  if (random(S) > d.careful) return;
  const dies = () => wouldDie(me, i, map, op.x, 50);
  if (!dies()) return;
  if (me.rope >= 0) { i.buf.up = i.buf.down = i.buf.dash = 0; i.down = false; return; }
  if (me.onGround) {
    i.buf.dash = i.buf.down = i.buf.attack = i.buf.up = 0; i.up = false; A.holdUp = 0;
    if (!dies()) return;
    i.left = i.right = false; A.move = 0;
    if (!dies()) return;
    for (const dir of [1, -1]) { i.left = dir < 0; i.right = dir > 0; if (!dies()) { A.move = dir; return; } }
    return;
  }
  let bm = -1, bt = Infinity;
  for (const m of movesFor(me)) { const r = simulate(me, map, m, op.x); if (r && !r.dead && r.t < bt) { bt = r.t; bm = m; } }
  if (bm >= 0) start(A, me, bm);
}


