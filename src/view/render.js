// Draws one frame: the hall, blood decals, ragdolls, fighters, particles, callouts.
// Reads the game state but never changes it.

import {W, H, GROUND, CENTER, PX_M, PLATFORMS, LETHAL} from '../sim/constants.js';
import {lungeActive} from '../sim/fighter.js';
import {settings} from '../ui/settings.js';
import {C} from './theme.js';
import {fx, ragdolls, swords, looks, view, decals} from './fx.js';

const cv = document.getElementById('cv'), ctx = cv.getContext('2d'), stage = document.getElementById('stage');
let scale = 1;
function resize() { const dpr = Math.min(2, window.devicePixelRatio || 1); const w = stage.clientWidth || 960; cv.width = Math.round(w * dpr); cv.height = Math.round(w * 9 / 16 * dpr); scale = cv.width / W; }
new ResizeObserver(resize).observe(stage); resize();

function line(pts, w) { ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k].x, pts[k].y); ctx.stroke(); }

function drawHall() {
  const g = ctx.createLinearGradient(0, 0, 0, GROUND); g.addColorStop(0, C.hall); g.addColorStop(1, C['hall-2']);
  ctx.fillStyle = g; ctx.fillRect(-30, -30, W + 60, GROUND + 30);
  ctx.fillStyle = C.piste; ctx.fillRect(-30, GROUND, W + 60, H - GROUND + 30);
  ctx.strokeStyle = C.ink; ctx.lineCap = 'butt'; ctx.globalAlpha = .55;
  for (const x of [CENTER, CENTER - 2 * PX_M, CENTER + 2 * PX_M]) { ctx.lineWidth = x === CENTER ? 3 : 2; ctx.beginPath(); ctx.moveTo(x, GROUND); ctx.lineTo(x, GROUND + 16); ctx.stroke(); }
  ctx.globalAlpha = 1; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-30, GROUND); ctx.lineTo(W + 30, GROUND); ctx.stroke();
  ctx.fillStyle = C.muted; ctx.font = '500 10px "IBM Plex Mono", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText('CENTRE', CENTER, GROUND + 24); ctx.fillText('EN GARDE', CENTER - 2 * PX_M, GROUND + 24); ctx.fillText('EN GARDE', CENTER + 2 * PX_M, GROUND + 24);
  ctx.fillText('14 M PISTE', CENTER, GROUND + 48);
  for (const p of PLATFORMS) { ctx.fillStyle = C['piste-edge']; ctx.beginPath(); ctx.roundRect(p.x, p.y, p.w, 9, 3); ctx.fill(); ctx.strokeStyle = C.ink; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.w, p.y); ctx.stroke(); }
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
  drawBlade(P, col, lungeActive(f) || (f.tipSpeed >= LETHAL * .85 && f.noLethal <= 0));
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
    if (p.type === 'spark') { ctx.strokeStyle = C.spark; ctx.globalAlpha = a; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * .025, p.y - p.vy * .025); ctx.stroke(); }
    else if (p.type === 'blood') { ctx.fillStyle = C.blood; ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); }
    else if (p.type === 'puff') { ctx.fillStyle = C.muted; ctx.globalAlpha = a * .35; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.6 - a * .6), 0, Math.PI * 2); ctx.fill(); }
    else if (p.type === 'text') { ctx.fillStyle = p.color; ctx.globalAlpha = Math.min(1, a * 1.6); ctx.font = '900 26px "Big Shoulders Display", Impact, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.text, p.x, p.y); }
  }
  ctx.globalAlpha = 1;
}

function drawCallout() {
  const c = view.callout; if (!c) return;
  const k = c.t / c.dur, pop = k < .15 ? 1.25 - k / .15 * .25 : 1, a = k > .75 ? 1 - (k - .75) / .25 : 1;
  ctx.save(); ctx.translate(W / 2, 175); ctx.scale(pop, pop); ctx.globalAlpha = Math.max(0, a);
  ctx.font = '900 92px "Big Shoulders Display", Impact, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 10; ctx.strokeStyle = C.hall; ctx.lineJoin = 'round'; ctx.strokeText(c.text, 0, 0);
  ctx.fillStyle = c.color; ctx.fillText(c.text, 0, 0); ctx.restore(); ctx.globalAlpha = 1;
}

export function render(S) {
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const sk = settings.shake ? view.shake : 0, sx = sk ? (Math.random() * 2 - 1) * sk : 0, sy = sk ? (Math.random() * 2 - 1) * sk : 0;
  ctx.save(); ctx.translate(sx, sy);
  drawHall(); ctx.drawImage(decals, 0, 0, W, H);
  for (const r of ragdolls) drawRagdoll(r);
  for (const s of swords) drawSword(s);
  for (let p = 0; p < 2; p++) drawFighter(S.F[p], looks[p]);
  drawFx(); ctx.restore(); drawCallout();
}
