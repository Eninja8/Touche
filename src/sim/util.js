// Small math helpers shared by the simulation (and read-only by the renderer).

export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;

// Two-bone inverse kinematics: where does the knee/elbow go so that a limb
// of lengths l1+l2 reaches from a to b? `bend` picks which way it folds.
export function ik(a, b, l1, l2, bend) {
  const dx = b.x - a.x, dy = b.y - a.y;
  let d = Math.hypot(dx, dy); d = clamp(d, .001, l1 + l2 - .001);
  const ang = Math.atan2(dy, dx);
  const c = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
  const off = Math.acos(c) * bend;
  return {x: a.x + Math.cos(ang + off) * l1, y: a.y + Math.sin(ang + off) * l1};
}

// Shortest distance from point p to the line segment a-b.
export function distPtSeg(p, a, b) {
  const vx = b.x - a.x, vy = b.y - a.y, l = vx * vx + vy * vy;
  let t = l ? ((p.x - a.x) * vx + (p.y - a.y) * vy) / l : 0; t = clamp(t, 0, 1);
  return Math.hypot(p.x - (a.x + vx * t), p.y - (a.y + vy * t));
}

// Distance between segments a-b and c-d, plus the closest point (used for blade clashes).
export function segSeg(a, b, c, d) {
  const r = {x: b.x - a.x, y: b.y - a.y}, s = {x: d.x - c.x, y: d.y - c.y}, den = r.x * s.y - r.y * s.x;
  if (Math.abs(den) > 1e-6) {
    const t = ((c.x - a.x) * s.y - (c.y - a.y) * s.x) / den, u = ((c.x - a.x) * r.y - (c.y - a.y) * r.x) / den;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return {d: 0, p: {x: a.x + r.x * t, y: a.y + r.y * t}};
  }
  const cand = [[distPtSeg(a, c, d), a], [distPtSeg(b, c, d), b], [distPtSeg(c, a, b), c], [distPtSeg(d, a, b), d]];
  cand.sort((x, y) => x[0] - y[0]);
  return {d: cand[0][0], p: cand[0][1]};
}
