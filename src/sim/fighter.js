// One fencer: creation, body pose, and movement for a single tick.
// Pure simulation: no drawing, no sound (sounds/dust are emitted as events).

import {
  DT, GROUND, LEFT, RIGHT, GRAV, JUMP_V, DJUMP_V, RUN_MAX, CROUCH_MAX, RUN_ACC, AIR_ACC,
  GROUND_FRIC, AIR_FRIC, DASH_V, DASH_T, DASH_CD, SLIDE_T, SLIDE_V, BLADE, ARM, ANG_MIN, ANG_MAX, PLATFORMS,
} from './constants.js';
import {clamp, lerp, ik} from './util.js';
import {emit} from './events.js';

export function mkFighter(id, x, face) {
  return {
    id, x, y: GROUND, vx: 0, vy: 0, face, onGround: true, onPlat: false, crouch: false,
    slideT: 0, dashT: 0, dashCD: 0, airDash: true, airJump: true, wallSide: 0, wallT: 0, coyote: 0, dropT: 0,
    angle: .18, deflect: 0, lunge: null, lungeCD: 0, stunT: 0, noLethal: 0, alive: true, phase: 0,
    P: null, prevHand: null, prevTip: null, tipSpeed: 0, angSpd: 5.2,
  };
}

// The per-player input record the simulation reads. Held keys are true/false;
// `buf` remembers recent presses for a short time; `aim` is a mouse target or null.
export const mkInput = () => ({left: false, right: false, up: false, down: false, raise: false, lower: false, aim: null, buf: {up: 0, down: 0, attack: 0, dash: 0}});

// Work out every joint position from the fighter's state.
export function pose(f) {
  const s = f.face, L = f.lunge; let armLen = ARM, lean = .06, hipH = 46;
  if (f.slideT > 0) { hipH = 18; lean = -.5; }
  else if (f.crouch) { hipH = 28; lean = .35; }
  if (!f.onGround && f.slideT <= 0) { hipH = 48; lean = .1 + clamp(f.vx * s / 1500, -.2, .2); }
  if (L) {
    const t = L.t;
    if (t < .05) { armLen = ARM - 8; lean -= .05; }
    else if (t < .2) { armLen = ARM + 20; lean += .32; }
    else { const k = Math.min(1, (t - .2) / .24); armLen = ARM + 20 * (1 - k); lean += .32 * (1 - k); }
  }
  if (f.stunT > 0) lean -= .25;
  const hip = {x: f.x, y: f.y - hipH}, TOR = 34;
  const neck = {x: hip.x + Math.sin(lean) * s * TOR, y: hip.y - Math.cos(lean) * TOR};
  const head = {x: neck.x + Math.sin(lean) * s * 12, y: neck.y - Math.cos(lean) * 12};
  const sh = {x: lerp(hip.x, neck.x, .9), y: lerp(hip.y, neck.y, .9)};
  let fF, fB;
  if (f.slideT > 0) { fF = {x: f.x + 30 * s, y: f.y}; fB = {x: f.x - 4 * s, y: f.y - 2}; }
  else if (!f.onGround) { const tk = f.vy < 0 ? 14 : 6; fF = {x: f.x + 10 * s, y: f.y - tk}; fB = {x: f.x - 10 * s, y: f.y - tk + 4}; }
  else if (Math.abs(f.vx) > 30) {
    const st = Math.min(1, Math.abs(f.vx) / RUN_MAX) * 16 + 4, ph = f.phase, sg = Math.sign(f.vx);
    fF = {x: f.x + sg * Math.sin(ph) * st, y: f.y - Math.max(0, Math.cos(ph)) * 9};
    fB = {x: f.x + sg * Math.sin(ph + Math.PI) * st, y: f.y - Math.max(0, Math.cos(ph + Math.PI)) * 9};
  }
  else { const w = f.crouch ? 17 : 13; fF = {x: f.x + w * s, y: f.y}; fB = {x: f.x - w * s, y: f.y}; }
  const kF = ik(hip, fF, 23, 23, -s), kB = ik(hip, fB, 23, 23, -s);
  const a = f.angle + f.deflect, dx = Math.cos(a) * s, dy = -Math.sin(a);
  const hand = {x: sh.x + dx * armLen, y: sh.y + dy * armLen};
  const elbow = ik(sh, hand, 15, 15, s);
  const tip = {x: hand.x + dx * BLADE, y: hand.y + dy * BLADE};
  const thrusting = L && L.t > .05 && L.t < .2;
  const bHand = {x: sh.x - s * 16, y: sh.y + (thrusting ? -6 : 12)};
  const bElbow = ik(sh, bHand, 13, 13, -s);
  return {hip, neck, head, sh, fF, fB, kF, kB, hand, elbow, tip, bHand, bElbow, dx, dy};
}

// Hit capsules (segment + radius) for the body.
export const bodyParts = P => [
  {a: P.head, b: P.head, r: 10.5, n: 'head'}, {a: P.neck, b: P.hip, r: 6.5, n: 'torso'},
  {a: P.hip, b: P.kF, r: 4.5, n: 'leg'}, {a: P.kF, b: P.fF, r: 4.5, n: 'leg'},
  {a: P.hip, b: P.kB, r: 4.5, n: 'leg'}, {a: P.kB, b: P.fB, r: 4.5, n: 'leg'},
];

// A thrust's point is "live" (always lethal) during this window.
export const lungeActive = f => f.lunge && f.lunge.t >= .05 && f.lunge.t < .2;

// Recompute the pose and remember last tick's blade so we know how fast it moved.
export function finishPose(f) {
  f.prevHand = f.P ? {x: f.P.hand.x, y: f.P.hand.y} : null;
  f.prevTip = f.P ? {x: f.P.tip.x, y: f.P.tip.y} : null;
  f.P = pose(f);
  if (!f.prevHand) { f.prevHand = {...f.P.hand}; f.prevTip = {...f.P.tip}; }
  f.tipSpeed = Math.hypot(f.P.tip.x - f.prevTip.x, f.P.tip.y - f.prevTip.y) / DT;
}

const puff = (x, y, n) => emit('puff', {x, y, n});
const sfx = name => emit('sfx', {name});

// Advance fighter f by one tick. i = its input, o = the opponent.
export function updateFighter(f, i, o, dt) {
  if (!f.alive) return;
  const prevY = f.y;
  f.dashCD = Math.max(0, f.dashCD - dt); f.lungeCD = Math.max(0, f.lungeCD - dt); f.noLethal = Math.max(0, f.noLethal - dt);
  f.dropT = Math.max(0, f.dropT - dt); f.wallT = Math.max(0, f.wallT - dt); f.coyote = Math.max(0, f.coyote - dt);
  for (const k in i.buf) i.buf[k] = Math.max(0, i.buf[k] - dt);
  const stunned = f.stunT > 0; if (stunned) f.stunT -= dt;
  const dir = (i.right ? 1 : 0) - (i.left ? 1 : 0);

  // face the opponent (locked during thrust and slide)
  if (!f.lunge && f.slideT <= 0 && o) {
    const nf = o.x >= f.x ? 1 : -1;
    if (nf !== f.face && Math.abs(o.x - f.x) > 6) { f.face = nf; f.noLethal = Math.max(f.noLethal, .12); }
  }

  // thrust timeline: windup .05, point live until .2, recover until .44
  if (f.lunge) {
    f.lunge.t += dt; const t = f.lunge.t;
    if (!f.lunge.fired && t >= .05) { f.lunge.fired = true; f.vx += f.face * (f.onGround ? 430 : 260); if (!f.onGround && f.angle < -.35) f.vy += 260; sfx('swish'); }
    if (t >= .44) f.lunge = null;
  }
  if (i.buf.attack > 0 && !f.lunge && f.lungeCD <= 0 && !stunned && f.slideT <= 0) { i.buf.attack = 0; f.lunge = {t: 0, fired: false}; f.lungeCD = .52; }
  const recovering = f.lunge && f.lunge.t > .2;

  // dash (no direction held = backstep)
  if (i.buf.dash > 0 && f.dashCD <= 0 && !stunned && (f.onGround || f.airDash)) {
    i.buf.dash = 0; const d = dir || -f.face; f.vx = d * DASH_V;
    if (!f.onGround) { f.airDash = false; f.vy = Math.min(f.vy, 0) * .25; }
    f.dashT = DASH_T; f.dashCD = DASH_CD; f.slideT = 0; sfx('dash'); puff(f.x, f.y - 4, 5);
  }

  // down: slide when running fast, otherwise drop through a platform
  if (i.buf.down > 0 && f.onGround) {
    if (Math.abs(f.vx) > 170 && f.slideT <= 0 && !f.lunge) { i.buf.down = 0; f.slideT = SLIDE_T; f.vx = Math.sign(f.vx) * Math.max(Math.abs(f.vx), SLIDE_V); sfx('slide'); puff(f.x, f.y - 3, 4); }
    else if (f.onPlat) { i.buf.down = 0; f.dropT = .25; f.onGround = false; f.y += 2; }
  }

  // jump, wall jump, double jump
  if (i.buf.up > 0 && !stunned) {
    if (f.onGround || f.coyote > 0) { i.buf.up = 0; f.vy = -JUMP_V; f.onGround = false; f.coyote = 0; if (f.slideT > 0) { f.vx *= 1.12; f.slideT = 0; } sfx('jump'); puff(f.x, f.y - 3, 3); }
    else if (f.wallT > 0) { i.buf.up = 0; f.vy = -720; f.vx = -f.wallSide * 440; f.wallT = 0; f.airDash = true; sfx('jump'); puff(f.x, f.y - 30, 3); }
    else if (f.airJump) { i.buf.up = 0; f.airJump = false; f.vy = -DJUMP_V; sfx('jump'); puff(f.x, f.y, 3); }
  }

  // running and friction
  const mf = stunned ? .35 : (recovering ? .5 : 1);
  if (f.slideT > 0) { f.slideT -= dt; f.vx -= Math.sign(f.vx) * Math.min(Math.abs(f.vx), 520 * dt); f.crouch = false; }
  else if (f.dashT > 0) { f.dashT -= dt; f.crouch = false; }
  else {
    f.crouch = i.down && f.onGround;
    const max = (f.crouch ? CROUCH_MAX : RUN_MAX) * mf, acc = (f.onGround ? RUN_ACC : AIR_ACC) * mf, fr = f.onGround ? GROUND_FRIC : AIR_FRIC;
    if (dir !== 0) { let v = f.vx * dir; if (v < max) { if (v < 0) v += fr * dt; v = Math.min(v + acc * dt, max); } else v = Math.max(max, v - fr * dt); f.vx = v * dir; }
    else f.vx -= Math.sign(f.vx) * Math.min(Math.abs(f.vx), fr * dt);
  }

  // blade angle: follow the mouse target if there is one, otherwise raise/lower keys
  const spdMul = stunned ? .4 : 1;
  if (i.aim && f.P) {
    const sh = f.P.sh, tg = clamp(Math.atan2(-(i.aim.y - sh.y), (i.aim.x - sh.x) * f.face), ANG_MIN, ANG_MAX), sp = 9.5 * spdMul;
    f.angle += clamp(tg - f.angle, -sp * dt, sp * dt);
  } else { const ad = (i.raise ? 1 : 0) - (i.lower ? 1 : 0); f.angle = clamp(f.angle + ad * f.angSpd * spdMul * dt, ANG_MIN, ANG_MAX); }
  f.deflect *= Math.exp(-7 * dt);

  // gravity, short hop, wall slide
  let g = GRAV; if (f.dashT > 0) g *= .25; if (!i.up && f.vy < 0) g *= 1.9;
  f.vy = Math.min(f.vy + g * dt, 1400);
  if (f.wallT > 0 && f.vy > 160 && dir === f.wallSide) f.vy = 160;
  f.x += f.vx * dt; f.y += f.vy * dt;

  // walls, floor, platforms
  const wasGround = f.onGround; f.onGround = false; f.onPlat = false;
  if (f.x <= LEFT) { f.x = LEFT; if (f.vx < 0) f.vx = 0; f.wallSide = -1; f.wallT = .12; }
  if (f.x >= RIGHT) { f.x = RIGHT; if (f.vx > 0) f.vx = 0; f.wallSide = 1; f.wallT = .12; }
  const land = () => { if (!wasGround && f.vy > 520) { puff(f.x, f.y - 2, 4); sfx('land'); } f.vy = 0; f.onGround = true; f.airDash = true; f.airJump = true; f.wallT = 0; };
  if (f.y >= GROUND) { f.y = GROUND; land(); }
  else if (f.vy >= 0 && f.dropT <= 0) {
    for (const p of PLATFORMS) { if (prevY <= p.y + 1 && f.y >= p.y && f.x > p.x - 4 && f.x < p.x + p.w + 4) { f.y = p.y; land(); f.onPlat = true; break; } }
  }
  if (wasGround && !f.onGround && f.vy >= 0) f.coyote = .08;
  if (f.onGround) f.phase += Math.abs(f.vx) * dt * .075;
  finishPose(f);
}
