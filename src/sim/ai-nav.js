// The CPU's map of an arena: where it can stand ("nodes": stretches of floor, ledges,
// platforms, and ropes) and how to get from one to another ("edges": a move from
// ai-plan.js, started at a spot, that lands on another node). It's worked out once per
// arena by trying every move from spots along every surface, so it always matches the
// real physics: pads, wall jumps, ropes and pits included.
//
// Arenas are fixed data, so the result is the same on every computer and is kept in a
// cache outside the game state (it never changes during a match).

import {RUN_MAX} from './constants.js';
import {mkFighter, finishPose} from './fighter.js';
import {HALF, BODY_H} from './terrain.js';
import {ropeBottom} from './rope.js';
import {MOVES, movesFor, simulate} from './ai-plan.js';

const cache = new Map();
export function navFor(map) { let n = cache.get(map); if (!n) { n = build(map); cache.set(map, n); } return n; }

// Remove the stretch a..b from a list of [from, to] stretches.
function cut(segs, a, b) {
  const out = [];
  for (const [x0, x1] of segs) { if (b <= x0 || a >= x1) { out.push([x0, x1]); continue; } if (a > x0) out.push([x0, a]); if (b < x1) out.push([b, x1]); }
  return out;
}

// Where a fencer can stand: block tops and platforms, minus anywhere a block is in the
// way (or within half a body of it) and anywhere covered by spikes.
function surfaces(map) {
  const out = [], blocked = (x0, x1, y) => {
    let segs = [[x0, x1]];
    for (const o of map.solids) if (o.y < y && o.y + o.h > y - BODY_H) segs = cut(segs, o.x - HALF, o.x + o.w + HALF);
    for (const k of map.spikes) if (k.y < y + 1 && k.y + k.h > y - BODY_H) segs = cut(segs, k.x - 7, k.x + k.w + 7);
    return segs;
  };
  for (const s of map.solids) if (s.y > 0) for (const [a, b] of blocked(s.x, s.x + s.w, s.y)) out.push({x0: a, x1: b, y: s.y, plat: false, grip: s.grip ?? 1});
  for (const p of map.platforms) for (const [a, b] of blocked(p.x, p.x + p.w, p.y)) out.push({x0: a, x1: b, y: p.y, plat: true, grip: p.grip ?? 1});
  // floor blocks that touch end to end are one stretch of floor
  out.sort((a, b) => a.y - b.y || a.x0 - b.x0);
  const merged = [];
  for (const s of out) { const l = merged[merged.length - 1]; if (l && l.y === s.y && l.plat === s.plat && s.x0 <= l.x1 + 1) l.x1 = Math.max(l.x1, s.x1); else merged.push(s); }
  return merged.filter(s => s.x1 - s.x0 >= 12);
}

// Which node is fencer f on? (-1 = in the air)
export function nodeAt(nav, f) {
  if (f.rope >= 0) return nav.ropeNode[f.rope];
  if (!f.onGround) return -1;
  return nodeAtPoint(nav, f.x, f.y);
}
export function nodeAtPoint(nav, x, y) {
  let best = -1, bd = 1e9;
  for (const n of nav.nodes) if (!n.rope && Math.abs(n.y - y) < 1) { const d = x < n.x0 ? n.x0 - x : x > n.x1 ? x - n.x1 : 0; if (d < bd && d < 12) { bd = d; best = n.id; } }
  return best;
}

function build(map) {
  const nodes = surfaces(map).map((s, id) => ({...s, id, lethal: [false, false], out: []}));
  const ropeNode = map.ropes.map((r, k) => { const id = nodes.length; nodes.push({id, rope: true, k, x0: r.x, x1: r.x, y: ropeBottom(r), lethal: [false, false], out: []}); return id; });
  const nav = {nodes, ropeNode, edges: [], dists: new Map()};
  const found = [];
  const tryFrom = (from, f) => {
    for (const m of movesFor(f)) {
      const r = simulate(f, map, m, f.x + f.face * 400);
      const M = MOVES[m];
      if (r && r.dead && M.k === 'walk' && !M.dj && !from.rope) { const end = M.d > 0 ? 1 : 0; if (Math.abs(f.x - (end ? from.x1 : from.x0)) < 10) from.lethal[end] = true; }
      if (!r || r.dead) continue;
      const to = r.rope >= 0 ? ropeNode[r.rope] : nodeAtPoint(nav, r.x, r.y);
      if (to < 0 || to === from.id) continue;
      // only keep moves that still work when started a few pixels either side (the CPU
      // never stops on exactly the right pixel)
      if (!from.rope && ![-6, 6].every(dx => {
        const g = {...f, x: f.x + dx}; if (g.x < from.x0 || g.x > from.x1) return true;
        finishPose(g); const q = simulate(g, map, m, g.x + g.face * 400);
        return q && !q.dead && (q.rope >= 0 ? ropeNode[q.rope] : nodeAtPoint(nav, q.x, q.y)) === to;
      })) continue;
      found.push({from: from.id, to, x: f.x, lx: r.x, t: r.t, m});
    }
  };
  for (const n of nodes) {
    if (n.rope) {
      const r = map.ropes[n.k];
      for (const face of [-1, 1]) {
        const f = mkFighter(0, r.x - face * 5, ropeBottom(r) - 6, face); f.rope = n.k; f.onGround = false; finishPose(f);
        tryFrom(n, f);
      }
      continue;
    }
    const xs = [n.x0 + 3, n.x1 - 3];
    for (let x = n.x0 + 90; x < n.x1 - 60; x += 90) xs.push(x);
    for (const x of xs) { const f = mkFighter(0, x, n.y, 1); f.grip = n.grip; finishPose(f); tryFrom(n, f); }
  }
  // keep the quickest few ways from each node to each other node, from different spots
  found.sort((a, b) => a.from - b.from || a.to - b.to || a.t - b.t);
  for (const e of found) {
    const out = nodes[e.from].out, same = out.map(k => nav.edges[k]).filter(o => o.to === e.to);
    if (same.length >= 4 || same.some(o => Math.abs(o.x - e.x) < 40)) continue;
    e.id = nav.edges.length; nav.edges.push(e); out.push(e.id);
  }
  return nav;
}

// Seconds needed to reach node `goal` after starting each move (edge), counting the move
// itself, a moment to get going, and the walk from where it lands to the next move's
// starting spot. Infinity = no way there. Worked out once per goal, then kept.
export function edgeCosts(nav, goal) {
  let c = nav.dists.get(goal);
  if (c) return c;
  c = nav.edges.map(e => e.to === goal ? e.t + .15 : Infinity);
  for (let changed = true, pass = 0; changed && pass < 200; pass++) {
    changed = false;
    for (const e of nav.edges) {
      if (e.to === goal) continue;
      const rest = bestFrom(nav, c, e.to, e.lx);
      if (rest + e.t + .15 < c[e.id] - 1e-9) { c[e.id] = rest + e.t + .15; changed = true; }
    }
  }
  nav.dists.set(goal, c);
  return c;
}
function bestFrom(nav, c, n, x) {
  let b = Infinity;
  for (const k of nav.nodes[n].out) { const e = nav.edges[k], v = (nav.nodes[n].rope ? 0 : Math.abs(x - e.x) / RUN_MAX) + c[k]; if (v < b) b = v; }
  return b;
}

// The best next move toward `goal` for a fencer at x on node n: {edge, cost}, or null.
// skip: a move (edge id) not to use right now.
export function nextEdge(nav, n, x, goal, skip = -1) {
  const c = edgeCosts(nav, goal), rope = nav.nodes[n].rope;
  let best = null, bc = Infinity;
  for (const k of nav.nodes[n].out) {
    const e = nav.edges[k], v = (rope ? 0 : Math.abs(x - e.x) / RUN_MAX) + c[k];
    if (v < bc && k !== skip) { bc = v; best = e; }
  }
  return best && {edge: best, cost: bc};
}

// How far fencer f is from a deadly drop behind it (dir = which way is "behind"), or Infinity.
export function dangerBehind(nav, f, dir) {
  const n = nodeAt(nav, f); if (n < 0 || nav.nodes[n].rope) return Infinity;
  const s = nav.nodes[n], end = dir > 0 ? 1 : 0;
  return s.lethal[end] ? Math.abs((end ? s.x1 : s.x0) - f.x) : Infinity;
}


