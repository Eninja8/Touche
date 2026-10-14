// The CPU and power-ups: going for a pickup when the opponent isn't in reach, throwing
// its knife when it has a clear, lined-up shot, and dodging or blocking a knife thrown
// at it. Only used with Power-ups on. All dice rolls use the seeded generator.

import {ANG_MIN, ANG_MAX, KNIFE_V, KNIFE_GRAV} from './constants.js';
import {clamp} from './util.js';
import {random} from './rng.js';
import {insideSolid} from './terrain.js';
import {navFor, nodeAt, nodeAtPoint} from './ai-nav.js';
import {chase} from './ai-chase.js';
import {canTake} from './powerups.js';

const FLOAT = 34; // a pickup floats this far above its spot (see powerups.js)
const torso = f => ({x: (f.P.neck.x + f.P.hip.x) / 2, y: (f.P.neck.y + f.P.hip.y) / 2});
const aimAt = (me, pt) => clamp(Math.atan2(-(pt.y - me.P.sh.y), (pt.x - me.P.sh.x) * me.face), ANG_MIN, ANG_MAX);

// The nearest pickup fencer f is allowed to take, or null.
function nearestItem(S, f) {
  let best = null, bestD = Infinity;
  for (const it of S.items) { const d = Math.hypot(it.x - f.x, it.y - f.y); if (canTake(f, it) && d < bestD) { best = it; bestD = d; } }
  return best;
}

// Nothing solid on the straight line from a to b?
function clearShot(map, a, b) {
  const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 16);
  for (let k = 1; k < n; k++) if (insideSolid(map, a.x + (b.x - a.x) * k / n, a.y + (b.y - a.y) * k / n)) return false;
  return true;
}

// A decision (called from ai.js's think). Returns true if it decided what to do.
export function powerDecision(S, me, op, i, A, d, map, dist) {
  // a knife: throw when lined up, aiming where they'll be (leading them, and allowing for the drop)
  if (me.knife && dist > 130 && dist < 650 && Math.abs(op.y - me.y) < 170 && Math.sign(op.x - me.x) === me.face) {
    const t = dist / KNIFE_V, c = torso(op), at = {x: c.x + op.vx * t * d.lead, y: c.y + op.vy * t * d.lead * .5 - .5 * KNIFE_GRAV * t * t};
    if (clearShot(map, me.P.hand, at) && random(S) < d.throw) { A.targetAng = aimAt(me, at); A.throwT = .4; A.move = 0; A.t = Math.max(A.t, .25); return true; }
  }
  // a pickup: go for the nearest one we may take when the opponent isn't in reach, if we're
  // about as close to it as they are (or they can't take it: they already have one from this wave)
  const it = nearestItem(S, me);
  if (it && (dist > 210 || Math.abs(op.y - me.y) > 120) && random(S) < d.grab) {
    const mine = Math.hypot(it.x - me.x, it.y - me.y), theirs = canTake(op, it) ? Math.hypot(it.x - op.x, it.y - op.y) : Infinity;
    if (mine < theirs * 1.25 + 60) {
      const nav = navFor(map), goal = nodeAtPoint(nav, it.x, it.y + FLOAT), here = nodeAt(nav, me);
      if (goal >= 0 && here === goal) { A.move = Math.abs(it.x - me.x) < 6 ? 0 : Math.sign(it.x - me.x); A.edge = -1; return true; }
      if (chase(me, A, map, goal)) return true;
    }
  }
  return false;
}

// Every tick: let go of a thrown knife once the blade points the right way, and react to
// knives coming at us (once per knife: jump it, crouch under it, or put the blade in its way).
export function powerTick(S, me, i, A, d, dt) {
  if (A.throwT > 0) {
    A.throwT -= dt;
    if (!me.knife) A.throwT = 0;
    else if (Math.abs(me.angle - A.targetAng) < .1) { i.buf.throw = .1; A.throwT = 0; }
  }
  A.dodgeT -= dt;
  if (A.dodgeT > 0) return;
  for (const k of S.knives) {
    if (k.owner === me.id) continue;
    const dx = me.x - k.x, t = dx / k.vx;
    if (t < 0 || t > .32 || Math.abs(dx) > 340) continue; // not heading our way, or not soon
    A.dodgeT = .5;
    if (random(S) >= d.dodge) return;
    const yAt = k.y + k.vy * t + .5 * KNIFE_GRAV * t * t, r = random(S);
    if (r < .45) A.targetAng = aimAt(me, {x: k.x + k.vx * t * .7, y: yAt}); // block it
    else if (yAt < me.y - 55 && me.onGround) A.crouch = true;           // high: duck
    else { i.buf.up = .1; A.holdUp = .3; }                               // low: jump
    A.t = Math.max(A.t, .2);
    return;
  }
}
