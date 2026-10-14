// Draws one frame: the map, blood decals, ragdolls, fighters, particles, the map's
// foreground, then callouts and the map name. Reads the game state but never changes it.
// The arena is drawn through the follow camera (camera.js); text is drawn on top in
// screen space, so it stays the same size whatever the zoom.

import {LETHAL} from '../sim/constants.js';
import {lungeActive} from '../sim/fighter.js';
import {getMap} from '../sim/maps.js';
import {settings} from '../ui/settings.js';
import {C, isDark} from './theme.js';
import {fx, ragdolls, swords, looks, view, decals} from './fx.js';
import {drawBack, drawFront} from './backdrops.js';
import {cam, updateCamera, viewRect} from './camera.js';

const cv = document.getElementById('cv'), ctx = cv.getContext('2d'), stage = document.getElementById('stage');
function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round((stage.clientWidth || 960) * dpr); cv.height = Math.round((stage.clientHeight || 540) * dpr);
}
new ResizeObserver(resize).observe(stage); resize();

// Text is laid out on a virtual 960 x 540 screen, scaled to fit the canvas and centred.
const UI_W = 960, UI_H = 540;
function screenSpace() { const k = Math.min(cv.width / UI_W, cv.height / UI_H); ctx.setTransform(k, 0, 0, k, (cv.width - UI_W * k) / 2, (cv.height - UI_H * k) / 2); return k; }

function line(pts, w) { ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k].x, pts[k].y); ctx.stroke(); }

// The map's name: big at the start of a round, then small in the bottom-left corner for the
// rest of the round, so you always know where you are.
const spaced = t => t.toUpperCase().split('').join(String.fromCharCode(8202));
function drawMapLabel(S, map) {
  if (S.mode.demo) return;
  const l = view.mapLabel, big = l ? (l.t < .25 ? l.t / .25 : l.t > 1.9 ? Math.max(0, 1 - (l.t - 1.9) / .5) : 1) : 0;
  ctx.save(); ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  if (big > 0) {
    ctx.globalAlpha = big; ctx.textAlign = 'center'; ctx.font = '900 44px "Big Shoulders Display", Impact, sans-serif';
    ctx.lineWidth = 8; ctx.strokeStyle = C.hall; ctx.strokeText(spaced(map.name), UI_W / 2, 104); ctx.fillStyle = C.ink; ctx.fillText(spaced(map.name), UI_W / 2, 104);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0); const px = Math.max(1, cv.height / 540);
  ctx.globalAlpha = .75 * (1 - big); ctx.textAlign = 'left'; ctx.font = `700 ${Math.round(15 * px)}px "Big Shoulders Display", Impact, sans-serif`;
  const ly = cv.height - 16 * px; ctx.lineWidth = 4 * px; ctx.strokeStyle = C.hall; ctx.strokeText(spaced(map.name), 14 * px, ly); ctx.fillStyle = C.ink; ctx.fillText(spaced(map.name), 14 * px, ly);
  ctx.restore();
}

function drawBlade(P, col, hot) {
  ctx.lineCap = 'round';
  const pom = {x: P.hand.x - P.dx * 7, y: P.hand.y - P.dy * 7};
  ctx.strokeStyle = C.steel; line([pom, P.tip], 3);
  ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(P.hand.x + P.dy * 7, P.hand.y - P.dx * 7); ctx.lineTo(P.hand.x - P.dy * 7, P.hand.y + P.dx * 7); ctx.stroke();
  if (hot) { ctx.fillStyle = C.spark; ctx.beginPath(); ctx.arc(P.tip.x, P.tip.y, 3.2, 0, Math.PI * 2); ctx.fill(); }
}

// A plain stick figure (used for dash ghosts).
function drawStick(P, col, alpha) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = col;
  ctx.globalAlpha = alpha * .5; line([P.hip, P.kB, P.fB], 5); line([P.sh, P.bElbow, P.bHand], 4.5);
  ctx.globalAlpha = alpha; line([P.hip, P.kF, P.fF], 5.5); line([P.hip, P.neck], 5.5);
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(P.head.x, P.head.y, 10, 0, Math.PI * 2); ctx.fill();
  line([P.sh, P.elbow, P.hand], 5); ctx.globalAlpha = 1;
}

function drawFighter(f, look) {
  if (!f.alive) return;
  const P = f.P, col = f.id ? C.green : C.red, s = f.face;
  for (const g of look.ghosts) { drawStick(g.P, col, g.life * 1.4 * .5); }
  for (let k = 1; k < look.trail.length; k++) { const a = look.trail[k - 1], b = look.trail[k]; ctx.globalAlpha = Math.min(a.life, b.life) / .09 * .35; ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(a.mid.x, a.mid.y); ctx.lineTo(a.tip.x, a.tip.y); ctx.lineTo(b.tip.x, b.tip.y); ctx.lineTo(b.mid.x, b.mid.y); ctx.closePath(); ctx.fill(); }
  ctx.globalAlpha = 1;
  // headband tail
  ctx.strokeStyle = col; ctx.lineCap = 'round'; line([{x: P.head.x - s * 7, y: P.head.y - 4}, look.band[0], look.band[1]], 3);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = col;
  ctx.globalAlpha = .5; line([P.hip, P.kB, P.fB], 5); line([P.sh, P.bElbow, P.bHand], 4.5); ctx.globalAlpha = 1;
  line([P.hip, P.kF, P.fF], 5.5); line([P.hip, P.neck], 5.5);
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(P.head.x, P.head.y, 10, 0, Math.PI * 2); ctx.fill();
  // fencing mask mesh on the face side
  ctx.save(); ctx.beginPath(); ctx.arc(P.head.x, P.head.y, 10, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = C.ink; ctx.globalAlpha = .42; ctx.fillRect(s > 0 ? P.head.x + 1 : P.head.x - 11, P.head.y - 8, 10, 14);
  ctx.globalAlpha = .5; ctx.strokeStyle = C.hall; ctx.lineWidth = .8;
  for (let k = -6; k <= 6; k += 3) { ctx.beginPath(); ctx.moveTo(P.head.x + s * 1, P.head.y + k); ctx.lineTo(P.head.x + s * 11, P.head.y + k); ctx.stroke(); }
  ctx.restore(); ctx.globalAlpha = 1;
  // a beaten blade is drawn faded while it's knocked aside and harmless
  if (f.beatT > 0) ctx.globalAlpha = .4;
  drawBlade(P, col, lungeActive(f) || (f.tipSpeed >= LETHAL * .85 && f.noLethal <= 0 && !f.swingLock));
  ctx.globalAlpha = 1;
  ctx.strokeStyle = col; line([P.sh, P.elbow, P.hand], 5);
  // stun stars
  if (f.stunT > 0) { const t = performance.now() / 120; ctx.fillStyle = C.spark; for (let k = 0; k < 3; k++) { const a = t + k * 2.09; ctx.beginPath(); ctx.arc(P.head.x + Math.cos(a) * 14, P.head.y - 18 + Math.sin(a) * 4, 2.4, 0, Math.PI * 2); ctx.fill(); } }
}

function drawRagdoll(r) {
  const p = r.pts, col = r.id ? C.green : C.red; ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.globalAlpha = .5; line([p.hip, p.kB, p.fB], 5); line([p.neck, p.bElbow, p.bHand], 4.5); ctx.globalAlpha = 1;
  line([p.hip, p.kF, p.fF], 5.5); line([p.hip, p.neck], 5.5); line([p.neck, p.elbow, p.hand], 5);
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(p.head.x, p.head.y, 10, 0, Math.PI * 2); ctx.fill();
}

function drawSword(s) {
  const col = s.id ? C.green : C.red, dx = s.b.x - s.a.x, dy = s.b.y - s.a.y, l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l;
  ctx.strokeStyle = C.steel; ctx.lineCap = 'round'; line([{x: s.a.x - ux * 7, y: s.a.y - uy * 7}, s.b], 3);
  ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(s.a.x + uy * 7, s.a.y - ux * 7); ctx.lineTo(s.a.x - uy * 7, s.a.y + ux * 7); ctx.stroke();
}

function drawFx() {
  for (const p of fx) {
    const a = Math.max(0, p.life / p.max);
    if (p.type === 'spark') { ctx.strokeStyle = p.color || C.spark; ctx.globalAlpha = a; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * .025, p.y - p.vy * .025); ctx.stroke(); }
    else if (p.type === 'blood') { ctx.fillStyle = C.blood; ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); }
    else if (p.type === 'ring') { const k = 1 - a; ctx.strokeStyle = C.ink; ctx.globalAlpha = a * .8; ctx.lineWidth = 3 * a + 1; ctx.beginPath(); ctx.arc(p.x, p.y, 6 + 30 * k, 0, Math.PI * 2); ctx.stroke(); }
    else if (p.type === 'puff') { ctx.fillStyle = C.muted; ctx.globalAlpha = a * .35; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.6 - a * .6), 0, Math.PI * 2); ctx.fill(); }
    else if (p.type === 'text') { ctx.fillStyle = p.color; ctx.globalAlpha = Math.min(1, a * 1.6); ctx.font = '900 26px "Big Shoulders Display", Impact, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.text, p.x, p.y); }
  }
  ctx.globalAlpha = 1;
}

function drawCallout() {
  const c = view.callout; if (!c) return;
  const k = c.t / c.dur, pop = k < .15 ? 1.25 - k / .15 * .25 : 1, a = k > .75 ? 1 - (k - .75) / .25 : 1;
  ctx.save(); ctx.translate(UI_W / 2, 175); ctx.scale(pop, pop); ctx.globalAlpha = Math.max(0, a);
  ctx.font = '900 92px "Big Shoulders Display", Impact, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 10; ctx.strokeStyle = C.hall; ctx.lineJoin = 'round'; ctx.strokeText(c.text, 0, 0);
  ctx.fillStyle = c.color; ctx.fillText(c.text, 0, 0); ctx.restore(); ctx.globalAlpha = 1;
}

// Aim indicator: a small, wide, faint chevron just past the blade's reach,
// pointing where the mouse is aiming (not where the blade is right now).
const ARROW_DIST = 112, ARROW_HALF = 10, ARROW_DEPTH = 5;
function drawAimArrow(S, aim) {
  const f = S.F[aim.p], len = Math.hypot(aim.x, aim.y); if (!f.alive || len < 4) return;
  const ux = aim.x / len, uy = aim.y / len, cx = f.P.sh.x + ux * ARROW_DIST, cy = f.P.sh.y + uy * ARROW_DIST;
  ctx.strokeStyle = aim.p ? C.green : C.red; ctx.globalAlpha = .35; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - ux * ARROW_DEPTH - uy * ARROW_HALF, cy - uy * ARROW_DEPTH + ux * ARROW_HALF);
  ctx.lineTo(cx, cy);
  ctx.lineTo(cx - ux * ARROW_DEPTH + uy * ARROW_HALF, cy - uy * ARROW_DEPTH - ux * ARROW_HALF);
  ctx.stroke(); ctx.globalAlpha = 1;
}

// What the camera keeps in view: each fencer (head to feet), or their body after a touch.
function focusPoints(S) {
  const pts = [];
  for (const f of S.F) if (f && f.alive && f.P) pts.push({x: f.x, y: f.y}, {x: f.P.head.x, y: f.P.head.y - 12});
  for (const r of ragdolls) pts.push({x: r.pts.hip.x, y: r.pts.hip.y + 40}, {x: r.pts.hip.x, y: r.pts.hip.y - 60});
  return pts;
}

let lastT = performance.now();
// aim: {p, x, y} aim offset of the local mouse player, or null.
export function render(S, aim) {
  const now = performance.now(), rdt = Math.min(.1, (now - lastT) / 1000), t = now / 1000; lastT = now;
  const map = getMap(S), dark = isDark();
  updateCamera(map, focusPoints(S), cv.width, cv.height, rdt);
  const v = viewRect(cv.width, cv.height);
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = C.hall; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.setTransform(cam.s, 0, 0, cam.s, cv.width / 2 - cam.x * cam.s, cv.height / 2 - cam.y * cam.s);
  const sk = settings.shake ? view.shake : 0, sx = sk ? (Math.random() * 2 - 1) * sk : 0, sy = sk ? (Math.random() * 2 - 1) * sk : 0;
  ctx.save(); ctx.translate(sx, sy);
  drawBack(ctx, map, v, dark, t); ctx.drawImage(decals, 0, 0, map.width, map.height);
  for (const r of ragdolls) drawRagdoll(r);
  for (const s of swords) drawSword(s);
  for (let p = 0; p < 2; p++) drawFighter(S.F[p], looks[p]);
  drawFx(); if (aim && settings.aimIndicator === 'arrow') drawAimArrow(S, aim);
  drawFront(ctx, map, v, dark, t);
  ctx.restore();
  screenSpace(); drawCallout(); drawMapLabel(S, map);
}
