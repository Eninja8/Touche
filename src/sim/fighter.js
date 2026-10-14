// One fencer: creation, body pose, and movement for a single tick.
// Pure simulation: no drawing, no sound (sounds/dust are emitted as events).

import {
  DT, GRAV, JUMP_V, DJUMP_V, RUN_MAX, CROUCH_MAX, RUN_ACC, AIR_ACC,
  GROUND_FRIC, AIR_FRIC, DASH_V, DASH_T, DASH_CD, SLIDE_T, SLIDE_V, BLADE, ARM, ANG_MIN, ANG_MAX,
  MOUSE_TURN, AIM_DEADZONE, BEAT_SPEED,
} from './constants.js';
import {clamp, lerp, ik} from './util.js';
import {emit} from './events.js';
import {collide, SPEED_MULT} from './terrain.js';
import {tryGrab, hang} from './rope.js';

export function mkFighter(id, x, y, face) {
  return {
    id, x, y, vx: 0, vy: 0, face, onGround: true, onPlat: false, crouch: false,
    slideT: 0, dashT: 0, dashCD: 0, airDash: true, airJump: true, wallSide: 0, wallT: 0, coyote: 0, dropT: 0, speedT: 0, padUp: false,
    grip: 1, rope: -1, ropeCD: 0, climbing: false, // grip of the ground underfoot (ice is low); rope: index of the rope held, or -1
    angle: .18, deflect: 0, lunge: null, lungeCD: 0, stunT: 0, noLethal: 0, beatT: 0, beatCD: 0, swingLock: false, alive: true, phase: 0,
    P: null, prevHand: null, prevTip: null, tipSpeed: 0, swingSpeed: 0, swingRate: 0, prevAng: null, angSpd: 5.2,
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
  if (f.rope >= 0) { hipH = 52; lean = .04; }
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
  if (f.rope >= 0) { const c = f.climbing ? Math.sin(f.phase) * 7 : 0; fF = {x: f.x + 7 * s, y: f.y - 4 - c}; fB = {x: f.x - 2 * s, y: f.y + c}; }
  else if (f.slideT > 0) { fF = {x: f.x + 30 * s, y: f.y}; fB = {x: f.x - 4 * s, y: f.y - 2}; }
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
  // the back hand holds the rope while hanging (the rope is 5 px in front of the body)
  const bHand = f.rope >= 0 ? {x: f.x + s * 5, y: sh.y - 22} : {x: sh.x - s * 16, y: sh.y + (thrusting ? -6 : 12)};
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
// `flipped`: a mouse player turned around this tick. Turning shifts the shoulder a
// few pixels; that jump is removed from the blade speed so only real swings count.
export function finishPose(f, flipped) {
  f.prevHand = f.P ? {x: f.P.hand.x, y: f.P.hand.y} : null;
  f.prevTip = f.P ? {x: f.P.tip.x, y: f.P.tip.y} : null;
  f.P = pose(f);
  if (!f.prevHand) { f.prevHand = {...f.P.hand}; f.prevTip = {...f.P.tip}; }
  else if (flipped) {
    const unturned = pose({...f, face: -f.face, angle: Math.PI - f.angle});
    const sx = f.P.sh.x - unturned.sh.x, sy = f.P.sh.y - unturned.sh.y;
    f.prevHand.x += sx; f.prevHand.y += sy; f.prevTip.x += sx; f.prevTip.y += sy;
  }
  f.tipSpeed = Math.hypot(f.P.tip.x - f.prevTip.x, f.P.tip.y - f.prevTip.y) / DT;
  // How fast the blade is being swung (used for beats): its turning speed times its reach.
  // Only the fencer's own aiming counts: running, sliding, crouching or being knocked by
  // a clash moves the blade but isn't a swing. A mouse player's turn mirrors the angle,
  // so the old angle is mirrored too.
  const a = f.angle;
  if (f.prevAng === null) f.prevAng = a; else if (flipped) f.prevAng = Math.PI - f.prevAng;
  f.swingRate = (a - f.prevAng) / DT; // rad/s, + = blade rising
  f.swingSpeed = Math.abs(f.swingRate) * (ARM + BLADE);
  f.prevAng = a;
  // after landing a beat the swing can't kill until it slows down (see combat.js)
  if (f.swingLock && f.swingSpeed < BEAT_SPEED) f.swingLock = false;
}

// Blade angle. Mouse: turn toward the crosshair (aim = offset from the shoulder)
// at a capped speed. After a turn the angle can be "behind" (up to π - ANG_MIN),
// and it sweeps back over the top. Keyboard: raise/lower keys.
function turnBlade(f, i, stunned, dt) {
  const spdMul = stunned ? .4 : 1;
  if (i.aim) {
    const tg = clamp(Math.atan2(-i.aim.y, i.aim.x * f.face), ANG_MIN, ANG_MAX), sp = MOUSE_TURN * spdMul;
    f.angle = clamp(f.angle + clamp(tg - f.angle, -sp * dt, sp * dt), ANG_MIN, Math.PI - ANG_MIN);
  } else { const ad = (i.raise ? 1 : 0) - (i.lower ? 1 : 0); f.angle = clamp(f.angle + ad * f.angSpd * spdMul * dt, ANG_MIN, ANG_MAX); }
  f.deflect *= Math.exp(-7 * dt);
}

const puff = (x, y, n) => emit('puff', {x, y, n});
const sfx = name => emit('sfx', {name});

// Advance fighter f by one tick. i = its input, o = the opponent, map = the arena.
export function updateFighter(f, i, o, dt, map) {
  if (!f.alive) return;
  const prevX = f.x, prevY = f.y, grip = f.grip;
  f.dashCD = Math.max(0, f.dashCD - dt); f.lungeCD = Math.max(0, f.lungeCD - dt); f.noLethal = Math.max(0, f.noLethal - dt); f.beatT = Math.max(0, f.beatT - dt); f.beatCD = Math.max(0, f.beatCD - dt);
  f.dropT = Math.max(0, f.dropT - dt); f.wallT = Math.max(0, f.wallT - dt); f.coyote = Math.max(0, f.coyote - dt); f.speedT = Math.max(0, f.speedT - dt); f.ropeCD = Math.max(0, f.ropeCD - dt);
  for (const k in i.buf) i.buf[k] = Math.max(0, i.buf[k] - dt);
  const stunned = f.stunT > 0; if (stunned) f.stunT -= dt;
  const dir = (i.right ? 1 : 0) - (i.left ? 1 : 0);

  // Facing (locked during thrust and slide).
  // Mouse players face whichever side their crosshair is on. Turning mirrors the
  // blade angle so the blade keeps pointing the same way in the world (no snap).
  // Keyboard players auto-face the opponent; their blade does flip, so it is
  // briefly made harmless to stop the flip itself counting as a lethal swing.
  let flipped = false;
  if (!f.lunge && f.slideT <= 0) {
    if (i.aim) {
      if (Math.abs(i.aim.x) >= AIM_DEADZONE) { const nf = Math.sign(i.aim.x); if (nf !== f.face) { f.face = nf; f.angle = Math.PI - f.angle; flipped = true; } }
    } else if (o) {
      const nf = o.x >= f.x ? 1 : -1;
      if (nf !== f.face && Math.abs(o.x - f.x) > 6) { f.face = nf; f.noLethal = Math.max(f.noLethal, .12); }
    }
  }

  // thrust timeline: windup .05, point live until .2, recover until .44
  if (f.lunge) {
    f.lunge.t += dt; const t = f.lunge.t;
    if (!f.lunge.fired && t >= .05) { f.lunge.fired = true; f.vx += f.face * (f.onGround ? 430 : 260); if (!f.onGround && f.angle < -.35) f.vy += 260; sfx('swish'); }
    if (t >= .44) f.lunge = null;
  }
  if (i.buf.attack > 0 && !f.lunge && f.lungeCD <= 0 && !stunned && f.slideT <= 0) { i.buf.attack = 0; f.lunge = {t: 0, fired: false}; f.lungeCD = .52; }
  const recovering = f.lunge && f.lunge.t > .2;

  // hanging on a rope: climb or let go (rope.js); the blade still works
  if (f.rope >= 0 && hang(f, i, dir, map, dt)) { turnBlade(f, i, stunned, dt); finishPose(f, flipped); return; }
  f.climbing = false;

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

  // running and friction (ice has low grip: slow to speed up, slow to stop; speed pads raise top speed)
  const mf = stunned ? .35 : (recovering ? .5 : 1), boost = f.speedT > 0 ? SPEED_MULT : 1;
  if (f.slideT > 0) { f.slideT -= dt; f.vx -= Math.sign(f.vx) * Math.min(Math.abs(f.vx), 520 * grip * dt); f.crouch = false; }
  else if (f.dashT > 0) { f.dashT -= dt; f.crouch = false; }
  else {
    f.crouch = i.down && f.onGround;
    const max = (f.crouch ? CROUCH_MAX : RUN_MAX) * mf * boost, acc = (f.onGround ? RUN_ACC * Math.sqrt(grip) : AIR_ACC) * mf * boost, fr = f.onGround ? GROUND_FRIC * grip : AIR_FRIC;
    if (dir !== 0) { let v = f.vx * dir; if (v < max) { if (v < 0) v += fr * dt; v = Math.min(v + acc * dt, max); } else v = Math.max(max, v - fr * dt); f.vx = v * dir; }
    else f.vx -= Math.sign(f.vx) * Math.min(Math.abs(f.vx), fr * dt);
  }

  turnBlade(f, i, stunned, dt);

  // gravity, short hop, wall slide
  // (letting go of jump early cuts a jump short, but not a jump-pad launch)
  if (f.vy >= 0) f.padUp = false;
  let g = GRAV; if (f.dashT > 0) g *= .25; if (!i.up && f.vy < 0 && !f.padUp) g *= 1.9;
  f.vy = Math.min(f.vy + g * dt, 1400);
  if (f.wallT > 0 && f.vy > 160 && dir === f.wallSide) f.vy = 160;
  f.x += f.vx * dt; f.y += f.vy * dt;

  // walls, floor (and gaps), platforms, ceiling, pads: see terrain.js
  const wasGround = f.onGround;
  collide(f, map, prevX, prevY, wasGround);
  if (!f.onGround) tryGrab(f, map, prevX, i);
  if (wasGround && !f.onGround && f.vy >= 0) f.coyote = .08;
  if (f.onGround) f.phase += Math.abs(f.vx) * dt * .075;
  finishPose(f, flipped);
}
