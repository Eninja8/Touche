// The CPU opponent. It runs inside the simulation (it reads the game state and
// writes the same input record a human would), and all its "dice rolls" use the
// seeded generator, so a CPU match replays identically from the same seed.

import {ANG_MIN, ANG_MAX} from './constants.js';
import {getMap} from './maps.js';
import {clamp} from './util.js';
import {random, rand} from './rng.js';

// react: seconds between decisions; block: chance to defend a thrust;
// aggro: how often it attacks; ang: blade turn speed; err: aim wobble.
export const DIFF = {
  easy: {react: .24, block: .3, aggro: .4, ang: 4.2, err: .35},
  normal: {react: .15, block: .55, aggro: .6, ang: 5.2, err: .2},
  hard: {react: .085, block: .8, aggro: .75, ang: 6.2, err: .1},
};

export const mkAI = () => ({t: 0, move: 0, crouch: false, targetAng: .2, holdUp: 0, diff: 'normal'});

function aimAt(me, pt) { const sh = me.P.sh; return clamp(Math.atan2(-(pt.y - sh.y), (pt.x - sh.x) * me.face), ANG_MIN, ANG_MAX); }

// Called every tick for a CPU-controlled player p: turn its plan into held keys.
export function aiStep(S, p, dt) {
  const me = S.F[p], op = S.F[1 - p], i = S.inp[p], A = S.AI[p], d = DIFF[A.diff];
  me.angSpd = d.ang;
  if (!me.alive) { i.left = i.right = i.raise = i.lower = i.up = i.down = false; return; }
  A.t -= dt; A.holdUp -= dt;
  if (A.t <= 0) { A.t = d.react * rand(S, .6, 1.4); think(S, me, op, i, A, d); }
  const da = A.targetAng - me.angle; i.raise = da > .05; i.lower = da < -.05;
  i.left = A.move < 0; i.right = A.move > 0; i.down = A.crouch; i.up = A.holdUp > 0;
}

// Make a new decision: defend, reposition, attack, jump...
function think(S, me, op, i, A, d) {
  A.crouch = false;
  if (!op.alive) { A.move = 0; A.targetAng = 1.1; return; }
  const dx = op.x - me.x, dist = Math.abs(dx), toward = Math.sign(dx) || 1;
  const threat = op.lunge && op.lunge.t < .2 && dist < 200;
  const opOpen = (op.lunge && op.lunge.t >= .2) || op.stunT > 0;
  if (threat && random(S) < d.block) {
    const r = random(S);
    if (r < .45) { A.move = -toward; i.buf.dash = .1; }
    else if (r < .8) { A.targetAng = aimAt(me, op.P.tip); A.move = 0; }
    else { i.buf.up = .1; A.holdUp = .22; A.move = toward; }
    return;
  }
  const r = random(S), tg = r < .3 ? op.P.head : r < .8 ? {x: (op.P.neck.x + op.P.hip.x) / 2, y: (op.P.neck.y + op.P.hip.y) / 2} : op.P.kF;
  A.targetAng = aimAt(me, tg) + rand(S, -d.err, d.err);
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
