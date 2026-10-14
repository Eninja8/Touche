// The CPU opponent. It runs inside the simulation (it reads the game state and
// writes the same input record a human would), and all its "dice rolls" use the
// seeded generator, so a CPU match replays identically from the same seed.

import {ANG_MIN, ANG_MAX, BEAT_SPEED} from './constants.js';
import {getMap} from './maps.js';
import {clamp} from './util.js';
import {random, rand} from './rng.js';

// react: seconds between decisions; block: chance to defend a thrust;
// aggro: how often it attacks; ang: blade turn speed; err: aim wobble;
// slide: chance to read an incoming slide; slideReact: how fast it notices (s);
// beat: chance to try a beat when the opponent's point is close and still;
// against wild swinging: wildBack = chance to back out of reach, wildMeet = chance to
// swing back into it (a clash, not a beat), punish = chance to thrust when the
// swinging blade is out of line or the swinger is on beat cooldown.
export const DIFF = {
  easy: {react: .24, block: .3, aggro: .4, ang: 4.2, err: .35, slide: .3, slideReact: .2, beat: 0, wildBack: .1, wildMeet: .05, punish: .2},
  normal: {react: .15, block: .55, aggro: .6, ang: 5.2, err: .2, slide: .75, slideReact: .08, beat: .06, wildBack: .3, wildMeet: .15, punish: .5},
  hard: {react: .085, block: .8, aggro: .75, ang: 6.2, err: .1, slide: .92, slideReact: .05, beat: .12, wildBack: .3, wildMeet: .15, punish: .6},
};

// slideSeen: the opponent's current slide was already noticed; slideIn: seconds until it reacts
// (-1 = not reacting); plan: how it answers that slide ('meet', 'jump', 'jumped', 'back' or null)
export const mkAI = () => ({t: 0, move: 0, crouch: false, targetAng: .2, holdUp: 0, diff: 'normal', slideSeen: false, slideIn: -1, plan: null, wild: 0});

function aimAt(me, pt) { const sh = me.P.sh; return clamp(Math.atan2(-(pt.y - sh.y), (pt.x - sh.x) * me.face), ANG_MIN, ANG_MAX); }

// Called every tick for a CPU-controlled player p: turn its plan into held keys.
export function aiStep(S, p, dt) {
  const me = S.F[p], op = S.F[1 - p], i = S.inp[p], A = S.AI[p], d = DIFF[A.diff];
  me.angSpd = d.ang;
  if (!me.alive) { i.left = i.right = i.raise = i.lower = i.up = i.down = false; return; }
  A.t -= dt; A.holdUp -= dt;
  // wild: recent seconds of the opponent swinging hard (fades over about half a second)
  A.wild = A.wild * Math.exp(-2 * dt) + (op.swingSpeed >= BEAT_SPEED ? dt : 0);
  watchSlide(S, me, op, i, A, d, dt);
  if (A.t <= 0) { A.t = d.react * rand(S, .6, 1.4); think(S, me, op, i, A, d); }
  const da = A.targetAng - me.angle; i.raise = da > .05; i.lower = da < -.05;
  i.left = A.move < 0; i.right = A.move > 0; i.down = A.crouch; i.up = A.holdUp > 0;
}

// Incoming slide: notice it (maybe), then after a short delay answer it:
//  meet: put the point on the incoming blade (blades clash) or the slider runs onto it,
//  jump: jump just before the point arrives, so it passes underneath,
//  back: dash away.
function watchSlide(S, me, op, i, A, d, dt) {
  const toward = Math.sign(me.x - op.x) || 1; // the direction that brings the slider closer
  const incoming = op.slideT > 0 && op.alive && Math.sign(op.vx) === toward;
  if (!incoming) { A.slideSeen = false; A.slideIn = -1; A.plan = null; return; }
  if (!A.slideSeen) { A.slideSeen = true; if (random(S) < d.slide) A.slideIn = d.slideReact * rand(S, .7, 1.3); }
  // seconds until the slider's point reaches my front foot
  const gap = Math.abs(op.P.tip.x - me.x) - 14, tc = Math.max(0, gap) / Math.max(1, Math.abs(op.vx));
  if (A.slideIn >= 0 && (A.slideIn -= dt) <= 0) {
    A.slideIn = -1;
    const turnTime = Math.abs(aimAt(me, op.P.tip) - me.angle) / d.ang, r = random(S);
    A.plan = turnTime < tc - .03 && r < .6 ? 'meet' : tc > .14 && r < .85 ? 'jump' : 'back';
    if (A.plan === 'back') { A.move = toward; i.buf.dash = .1; } // `toward` points from the slider to me: away from it
  }
  if (A.plan === 'meet') { A.targetAng = aimAt(me, op.P.tip); A.move = 0; A.crouch = false; }
  if (A.plan === 'jump' && tc < .17) { i.buf.up = .1; A.holdUp = .35; A.move = 0; A.plan = 'jumped'; }
  if (A.plan) A.t = Math.max(A.t, .05); // no other decisions until the slide has passed
}

// Make a new decision: defend, reposition, attack, jump...
function think(S, me, op, i, A, d) {
  A.crouch = false;
  if (!op.alive) { A.move = 0; A.targetAng = 1.1; return; }
  const dx = op.x - me.x, dist = Math.abs(dx), toward = Math.sign(dx) || 1;
  const threat = op.lunge && op.lunge.t < .2 && dist < 200;
  const opOpen = (op.lunge && op.lunge.t >= .2) || op.stunT > 0 || op.beatT > 0;
  if (threat && random(S) < d.block) {
    const r = random(S);
    if (r < .45) { A.move = -toward; i.buf.dash = .1; }
    else if (r < .8) { A.targetAng = aimAt(me, op.P.tip); A.move = 0; }
    else { i.buf.up = .1; A.holdUp = .22; A.move = toward; }
    return;
  }
  const r = random(S), tg = r < .3 ? op.P.head : r < .8 ? {x: (op.P.neck.x + op.P.hip.x) / 2, y: (op.P.neck.y + op.P.hip.y) / 2} : op.P.kF;
  A.targetAng = aimAt(me, tg) + rand(S, -d.err, d.err);
  // Against wild swinging: thrust if their blade is out of line (or they just beat and
  // can't beat again yet), otherwise back out of reach or swing back into it.
  const wild = A.wild > .15, torso = {x: (op.P.neck.x + op.P.hip.x) / 2, y: (op.P.neck.y + op.P.hip.y) / 2};
  const outOfLine = Math.abs(op.angle + op.deflect - aimAt(op, me.P.neck)) > .7;
  if (dist < 170 && me.lungeCD <= 0 && me.stunT <= 0 && ((wild && outOfLine) || op.beatCD > 0) && random(S) < d.punish) {
    A.targetAng = aimAt(me, torso); i.buf.attack = .1; A.move = toward; return;
  }
  if (wild && dist < 175) {
    const q = random(S);
    if (q < d.wildBack) { A.move = -toward; if (random(S) < .5) i.buf.dash = .1; return; }
    if (q < d.wildBack + d.wildMeet) { A.targetAng = aimAt(me, op.P.tip) + (op.swingRate > 0 ? -.6 : .6); A.move = 0; A.t = .2; return; }
  }
  // Beat: the opponent's point is within reach and nearly still, so swing hard through it.
  // (Then opOpen above makes a thrust likely while their blade is knocked aside.)
  const reach = Math.hypot(op.P.tip.x - me.P.sh.x, op.P.tip.y - me.P.sh.y);
  if (reach < 96 && op.swingSpeed < 200 && !op.lunge && op.beatT <= 0 && random(S) < d.beat) {
    const at = aimAt(me, op.P.tip); A.targetAng = at + (me.angle > at ? -.7 : .7); A.move = 0; A.t = .25;
    return;
  }
  const want = rand(S, 120, 160);
  if (dist > want + 25) A.move = toward; else if (dist < want - 35) A.move = -toward;
  else { const q = random(S); A.move = q < .35 ? toward : q < .65 ? 0 : -toward; }
  if (dist < 170 && me.lungeCD <= 0 && me.stunT <= 0 && random(S) < d.aggro * (opOpen ? 1.6 : .5)) { A.targetAng = aimAt(me, tg); i.buf.attack = .1; A.move = toward; }
  if (op.y < me.y - 60 && random(S) < .4) { i.buf.up = .1; A.holdUp = .25; A.move = toward; }
  if (me.y < op.y - 60 && me.onPlat && random(S) < .3) { A.move = 0; i.buf.down = .1; }
  if (random(S) < .05) { i.buf.up = .1; A.holdUp = rand(S, 0, .3); }
  if (random(S) < .05 && Math.abs(me.vx) > 200) i.buf.down = .1;
  const {left, right} = getMap(S).walls;
  if ((me.x < left + 50 || me.x > right - 50) && dist < 150 && random(S) < .5) { i.buf.up = .1; A.holdUp = .3; A.move = toward; }
}
