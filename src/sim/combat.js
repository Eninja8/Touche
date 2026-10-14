// Blade-on-body hits, blade-on-blade clashes, parries and kills.

import {DT, LETHAL, HITSTOP_TICKS} from './constants.js';
import {lerp, distPtSeg} from './util.js';
import {bodyParts, lungeActive} from './fighter.js';
import {emit} from './events.js';

// Does A's blade touch B's body this tick? Returns hit info (and whether it kills) or null.
export function bladeContact(A, B) {
  const PA = A.P, ps = bodyParts(B.P);
  for (let k = 0; k <= 8; k++) {
    const t = .3 + .7 * k / 8;
    const p = {x: lerp(PA.hand.x, PA.tip.x, t), y: lerp(PA.hand.y, PA.tip.y, t)};
    const pp = {x: lerp(A.prevHand.x, A.prevTip.x, t), y: lerp(A.prevHand.y, A.prevTip.y, t)};
    const mid = {x: (p.x + pp.x) / 2, y: (p.y + pp.y) / 2};
    for (const q of ps) {
      if (distPtSeg(p, q.a, q.b) < q.r + 1.5 || distPtSeg(mid, q.a, q.b) < q.r + 1.5) {
        const vx = (p.x - pp.x) / DT - B.vx, vy = (p.y - pp.y) / DT - B.vy, sp = Math.hypot(vx, vy);
        return {p, vx, vy, sp, part: q.n, lethal: lungeActive(A) || (sp >= LETHAL && A.noLethal <= 0)};
      }
    }
  }
  return null;
}

// Blades met. If only one fencer was thrusting, the other parries.
export function clash(S, A, B, pt) {
  S.clashCD = .14; A.noLethal = B.noLethal = .14;
  const aAct = A.lunge && A.lunge.t >= .03 && A.lunge.t < .2, bAct = B.lunge && B.lunge.t >= .03 && B.lunge.t < .2;
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
