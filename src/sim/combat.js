// Blade-on-body hits, blade-on-blade clashes, parries and kills.

import {DT, LETHAL, TIP_LETHAL, TIP_ZONE, PUSH_MAX, PUSH_HOLDER, HITSTOP_TICKS, BEAT_SPEED, BEAT_RATIO, BEAT_KNOCK, BEAT_OPEN} from './constants.js';
import {clamp, lerp, distPtSeg, distPtSegX} from './util.js';
import {bodyParts, lungeActive} from './fighter.js';
import {emit} from './events.js';

// The blade is checked at SAMPLES+1 points, from 30% of the way along it (near the
// guard) out to the point. 12 gaps keep them closer together than a limb is thick.
const SAMPLES = 12, REACH = 1.5;
const bladePt = (hand, tip, k) => { const t = .3 + .7 * k / SAMPLES; return {x: lerp(hand.x, tip.x, t), y: lerp(hand.y, tip.y, t)}; };

// Does A's blade touch B's body this tick? Returns hit info (and whether it kills) or null.
// A contact kills if: A is thrusting; or that part of the blade moves at LETHAL speed
// relative to B (a swing); or it is the point and it's driven into B at TIP_LETHAL along
// the blade (running onto the point). A lethal contact wins over a harmless one.
export function bladeContact(A, B) {
  const PA = A.P, ps = bodyParts(B.P);
  let harmless = null;
  for (let k = 0; k <= SAMPLES; k++) {
    const p = bladePt(PA.hand, PA.tip, k), pp = bladePt(A.prevHand, A.prevTip, k);
    const mid = {x: (p.x + pp.x) / 2, y: (p.y + pp.y) / 2};
    for (const q of ps) {
      if (distPtSeg(p, q.a, q.b) < q.r + REACH || distPtSeg(mid, q.a, q.b) < q.r + REACH) {
        const vx = (p.x - pp.x) / DT - B.vx, vy = (p.y - pp.y) / DT - B.vy, sp = Math.hypot(vx, vy);
        const tip = .3 + .7 * k / SAMPLES >= 1 - TIP_ZONE, closing = vx * PA.dx + vy * PA.dy;
        const lethal = !!lungeActive(A) || (A.noLethal <= 0 && (sp >= LETHAL || (tip && closing >= TIP_LETHAL)));
        const hit = {p, vx, vy, sp, part: q.n, tip, lethal};
        if (lethal) return hit;
        harmless = harmless || hit;
        break;
      }
    }
  }
  return harmless;
}

// How much does A's blade still overlap B's body if B slides sideways by ox pixels?
function overlap(A, B, ox) {
  const ps = bodyParts(B.P); let worst = 0;
  for (let k = 0; k <= SAMPLES; k++) {
    const p = bladePt(A.P.hand, A.P.tip, k);
    for (const q of ps) worst = Math.max(worst, q.r + REACH - distPtSegX(p, q.a, q.b, ox));
  }
  return worst;
}

// Slide fighter f sideways by dx (stopping at the walls), pose included. Returns how far it moved.
function slide(f, dx, map) {
  const nx = clamp(f.x + dx, map.walls.left, map.walls.right), moved = nx - f.x;
  f.x = nx;
  for (const k in f.P) if (f.P[k] && f.P[k].x !== undefined) f.P[k].x += moved;
  return moved;
}

// A's blade touched B harmlessly: blades are solid, so shove B out of it (away from A,
// unless only the other way clears it) and push A back a little. Either side
// moving into the blade loses that speed, as if they had hit something solid.
export function bladePush(A, B, map) {
  const away = Math.sign(B.x - A.x) || A.face;
  // smallest sideways shift (in 1 px steps, up to PUSH_MAX) that clears the blade
  const clearAt = dir => { for (let s = 0; s <= PUSH_MAX; s++) if (overlap(A, B, dir * s) <= 0) return s; return Infinity; };
  const sAway = clearAt(away), sBack = clearAt(-away);
  const dir = sAway === Infinity && sBack < Infinity ? -away : away, need = Math.min(dir === away ? sAway : sBack, PUSH_MAX);
  if (need > 0) {
    const movedB = Math.abs(slide(B, dir * need * (1 - PUSH_HOLDER), map));
    slide(A, -dir * (need - movedB), map); // A takes its share, plus whatever the wall stopped B from taking
  }
  if (B.vx * dir < 0) B.vx = 0;
  if (A.vx * dir > 0) A.vx *= .5;
}

// Blades met. If only one fencer was thrusting, the other parries. If neither was
// thrusting and one blade was swinging much faster, it beats the other aside.
export function clash(S, A, B, pt) {
  S.clashCD = .14; A.noLethal = B.noLethal = .14;
  const aAct = A.lunge && A.lunge.t >= .03 && A.lunge.t < .2, bAct = B.lunge && B.lunge.t >= .03 && B.lunge.t < .2;
  const fast = A.swingSpeed >= B.swingSpeed ? A : B, slow = fast === A ? B : A;
  if (!aAct && !bAct && fast.swingSpeed >= BEAT_SPEED && slow.swingSpeed <= fast.swingSpeed * BEAT_RATIO) { beat(S, fast, slow, pt); return; }
  emit('sparks', {x: pt.x, y: pt.y, n: 16}); emit('shake', {amount: 5});
  S.hitstop = HITSTOP_TICKS;
  if (aAct && !bAct) parry(A, B, pt);
  else if (bAct && !aAct) parry(B, A, pt);
  else {
    for (const f of [A, B]) { f.lunge = null; f.vx = -f.face * 260; if (aAct && bAct) f.stunT = .15; }
    const up = A.P.tip.y < B.P.tip.y; A.deflect += up ? .55 : -.55; B.deflect += up ? -.55 : .55;
    emit('sfx', {name: 'clash'});
  }
}

// F's fast blade knocked S's slower blade wide (the way F was swinging): S can't kill
// or thrust for a moment, which is F's opening. F's own blade is only briefly harmless.
function beat(S, F, V, pt) {
  const down = F.P.tip.y > F.prevTip.y; // F was swinging downward
  V.deflect += down ? -BEAT_KNOCK : BEAT_KNOCK;
  V.noLethal = BEAT_OPEN; V.beatT = BEAT_OPEN; V.lungeCD = Math.max(V.lungeCD, BEAT_OPEN);
  if (V.lunge) V.lunge = null;
  F.noLethal = .08;
  S.hitstop = Math.ceil(HITSTOP_TICKS / 2);
  emit('beat', {x: pt.x, y: pt.y}); emit('shake', {amount: 3});
  emit('text', {x: pt.x, y: pt.y - 24, text: 'BEAT', color: F.id ? 'green' : 'red'});
  emit('sfx', {name: 'beat'});
}

// L lunged into D's blade: L is knocked back and stunned, D gets a free riposte.
function parry(L, D, pt) {
  L.lunge = null; L.lungeCD = Math.max(L.lungeCD, .3); L.stunT = .42; L.vx = -L.face * 340; L.deflect += L.P.tip.y < D.P.tip.y ? .9 : -.9;
  D.vx = -D.face * 110; D.lungeCD = 0;
  emit('text', {x: pt.x, y: pt.y - 24, text: 'PARRY', color: D.id ? 'green' : 'red'});
  emit('sfx', {name: 'parry'});
}

// v was touched. The ragdoll, blood and slow-motion are all handled outside the sim.
export function kill(v, hit) {
  v.alive = false;
  const P = {}; for (const k in v.P) if (v.P[k] && v.P[k].x !== undefined) P[k] = {x: v.P[k].x, y: v.P[k].y};
  emit('kill', {victim: {id: v.id, face: v.face, vx: v.vx, vy: v.vy, P, prevHand: {...v.prevHand}}, hit: {...hit, p: {...hit.p}}});
}
