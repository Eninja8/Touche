// Draws one frame: the map, blood decals, ragdolls, fighters, particles, callouts.
// Reads the game state but never changes it.

import {LETHAL} from '../sim/constants.js';
import {lungeActive} from '../sim/fighter.js';
import {getMap} from '../sim/maps.js';
import {settings} from '../ui/settings.js';
import {C, isDark} from './theme.js';
import {fx, ragdolls, swords, looks, view, decals} from './fx.js';
import {drawMap} from './backdrops.js';

const cv = document.getElementById('cv'), ctx = cv.getContext('2d'), stage = document.getElementById('stage');
function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round((stage.clientWidth || 960) * dpr); cv.height = Math.round((stage.clientHeight || 540) * dpr);
}
new ResizeObserver(resize).observe(stage); resize();

// The map is a fixed size in arena pixels (the same for every player, which
// keeps online play fair). It's scaled to fit the window and centred; the
// visible area beyond it (vis) is painted as more of the map, so there are no black bars.
let scale = 1, ox = 0, oy = 0;
const vis = {x0: 0, y0: 0, x1: 0, y1: 0};
function fit(map) {
  scale = Math.min(cv.width / map.width, cv.height / map.height); ox = (cv.width - map.width * scale) / 2; oy = (cv.height - map.height * scale) / 2;
  vis.x0 = -ox / scale; vis.y0 = -oy / scale; vis.x1 = (cv.width - ox) / scale; vis.y1 = (cv.height - oy) / scale;
}

function line(pts, w) { ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k].x, pts[k].y); ctx.stroke(); }

// The map itself (backdrop, floor, platforms, pads...) is painted by backdrops.js.

// The map's name, shown briefly at the start of a round, just under the scoring box.
function drawMapLabel(map) {
  const l = view.mapLabel; if (!l) return;
  const a = l.t < .2 ? l.t / .2 : l.t > 1.3 ? Math.max(0, 1 - (l.t - 1.3) / .4) : 1;
  ctx.save(); ctx.globalAlpha = a; ctx.font = '700 24px "Big Shoulders Display", Impact, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 6; ctx.strokeStyle = C.hall; ctx.lineJoin = 'round'; const s = l.text.toUpperCase().split('').join(String.fromCharCode(8202));
  ctx.strokeText(s, map.width / 2, 104); ctx.fillStyle = C.ink; ctx.fillText(s, map.width / 2, 104); ctx.restore();
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

function drawCallout(map) {
  const c = view.callout; if (!c) return;
  const k = c.t / c.dur, pop = k < .15 ? 1.25 - k / .15 * .25 : 1, a = k > .75 ? 1 - (k - .75) / .25 : 1;
  ctx.save(); ctx.translate(map.width / 2, 175); ctx.scale(pop, pop); ctx.globalAlpha = Math.max(0, a);
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

// aim: {p, x, y} aim offset of the local mouse player, or null.
export function render(S, aim) {
  const map = getMap(S); fit(map);
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = C.hall; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.setTransform(scale, 0, 0, scale, ox, oy);
  const sk = settings.shake ? view.shake : 0, sx = sk ? (Math.random() * 2 - 1) * sk : 0, sy = sk ? (Math.random() * 2 - 1) * sk : 0;
  ctx.save(); ctx.translate(sx, sy);
  drawMap(ctx, map, vis, isDark(), performance.now() / 1000); ctx.drawImage(decals, 0, 0, map.width, map.height);
  for (const r of ragdolls) drawRagdoll(r);
  for (const s of swords) drawSword(s);
  for (let p = 0; p < 2; p++) drawFighter(S.F[p], looks[p]);
  drawFx(); if (aim && settings.aimIndicator === 'arrow') drawAimArrow(S, aim); ctx.restore(); drawCallout(map); drawMapLabel(map);
}
