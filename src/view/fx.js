// Cosmetic effects: particles, ragdolls, dropped swords, blood decals, blade
// trails, dash ghosts, the headband tail, screen shake and big callout text.
//
// None of this affects gameplay, so it lives outside the simulation and may use
// Math.random. It reacts to events from the sim and is updated once per tick.

import {DT, GRAV} from '../sim/constants.js';
import {getMap} from '../sim/maps.js';
import {lerp} from '../sim/util.js';
import {lungeActive} from '../sim/fighter.js';
import {settings} from '../ui/settings.js';
import {C} from './theme.js';

const rnd = (a, b) => a + Math.random() * (b - a);

export const fx = [], ragdolls = [], swords = [];
export const looks = [mkLook(), mkLook()]; // per-fighter: trail, ghosts, headband
export const view = {shake: 0, callout: null, mapLabel: null};

function mkLook() { return {trail: [], ghosts: [], ghostT: 0, band: null}; }

// Blood that lands is painted onto this off-screen canvas (1.5 times the map size for sharpness).
const DECAL = 1.5;
export const decals = document.createElement('canvas'); decals.width = 1920; decals.height = 1080;
const dctx = decals.getContext('2d');
// (Also drops blood still in the air, so it doesn't land on a new map.)
export function clearDecals(map) { decals.width = map.width * DECAL; decals.height = map.height * DECAL; for (let j = fx.length - 1; j >= 0; j--) if (fx[j].type === 'blood') fx.splice(j, 1); }
// side: a splash on a wall is drawn upright instead of flat
function splat(x, y, r, side) { dctx.fillStyle = C.blood; dctx.globalAlpha = .85; dctx.beginPath(); dctx.ellipse(x * DECAL, y * DECAL, r * (side ? 1.1 : 3.2) * DECAL / 2, r * (side ? 2.4 : 1.1) * DECAL / 2, 0, 0, Math.PI * 2); dctx.fill(); dctx.globalAlpha = 1; }

export function sparks(x, y, n, tag, color) { for (let k = 0; k < n; k++) { const a = rnd(0, Math.PI * 2), s = rnd(150, 620); fx.push({type: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 120, life: rnd(.15, .32), max: .32, tag, color}); } }
// A beat: a quick ring plus pale streaks, so it reads differently from a normal clash.
// A power-up taken: a gold burst.
export function pickupFx(x, y) { for (let k = 0; k < 3; k++) fx.push({type: 'ring', x, y, life: .2 + k * .08, max: .2 + k * .08}); sparks(x, y, 14, undefined, '#ffd84a'); }
export function beatFx(x, y) { fx.push({type: 'ring', x, y, life: .22, max: .22}); sparks(x, y, 10, undefined, C.ink); }
function blood(x, y, vx, vy, n, tag) { const sp = Math.hypot(vx, vy) || 1; for (let k = 0; k < n; k++) { const s = rnd(.15, .65); fx.push({type: 'blood', x, y, vx: vx / sp * Math.min(sp, 900) * s + rnd(-160, 160), vy: vy / sp * Math.min(sp, 900) * s + rnd(-320, 60), life: 3, max: 3, size: rnd(1.6, 4), tag}); } }
export function puff(x, y, n) { for (let k = 0; k < n; k++) fx.push({type: 'puff', x: x + rnd(-8, 8), y, vx: rnd(-90, 90), vy: rnd(-50, -10), life: rnd(.25, .4), max: .4, size: rnd(3, 6)}); }
export function callout(text, color, dur) { view.callout = {text, color, t: 0, dur}; }
export function showMapName(text) { view.mapLabel = {text, t: 0}; }

// New round: clear bodies and effects (blood on the floor stays), reset the headbands.
export function resetRound(S) {
  ragdolls.length = 0; swords.length = 0;
  for (let j = fx.length - 1; j >= 0; j--) if (fx[j].type !== 'blood') fx.splice(j, 1);
  for (let p = 0; p < 2; p++) { looks[p] = mkLook(); updateBand(S.F[p], looks[p]); }
}

// ---------- ragdolls ----------
const RAG_LINKS = [['head', 'neck'], ['neck', 'hip'], ['hip', 'kF'], ['kF', 'fF'], ['hip', 'kB'], ['kB', 'fB'], ['neck', 'elbow'], ['elbow', 'hand'], ['neck', 'bElbow'], ['bElbow', 'bHand']];

// Turn a killed fighter into a floppy body plus a loose sword, then add blood.
// provisional (online only): the touch might still be undone by a rollback, so
// its blood can't stain the floor yet; see confirmKills() and undoKill().
export function onKill(f, hit, provisional) {
  const tag = provisional ? {victim: f.id} : undefined;
  const P = f.P, pts = {}, n = Math.hypot(hit.vx, hit.vy) || 1, mag = Math.min(hit.sp, 1100) * .55, ix = hit.vx / n * mag, iy = hit.vy / n * mag - 140;
  for (const k of ['head', 'neck', 'hip', 'kF', 'fF', 'kB', 'fB', 'elbow', 'hand', 'bElbow', 'bHand']) {
    const d = Math.hypot(P[k].x - hit.p.x, P[k].y - hit.p.y), w = Math.max(.25, 1 - d / 90);
    const vx = f.vx * .8 + ix * w, vy = f.vy * .8 + iy * w; pts[k] = {x: P[k].x, y: P[k].y, px: P[k].x - vx * DT, py: P[k].y - vy * DT};
  }
  const decap = hit.part === 'head' && hit.sp > 820 && Math.random() < .6;
  const cons = RAG_LINKS.filter((l, j) => !(decap && j === 0)).map(([a, b]) => ({a, b, len: Math.hypot(pts[a].x - pts[b].x, pts[a].y - pts[b].y)}));
  ragdolls.push({pts, cons, id: f.id, face: f.face, tag});
  const hv = {x: (P.hand.x - f.prevHand.x) / DT, y: (P.hand.y - f.prevHand.y) / DT};
  swords.push({a: {x: P.hand.x, y: P.hand.y, px: P.hand.x - (hv.x + rnd(-150, 150)) * DT, py: P.hand.y - (hv.y - 200) * DT}, b: {x: P.tip.x, y: P.tip.y, px: P.tip.x - (hv.x + rnd(-400, 400)) * DT, py: P.tip.y - (hv.y - rnd(100, 400)) * DT}, len: Math.hypot(P.tip.x - P.hand.x, P.tip.y - P.hand.y), id: f.id, tag});
  if (settings.blood) blood(hit.p.x, hit.p.y, hit.vx, hit.vy, 28, tag); else sparks(hit.p.x, hit.p.y, 30, tag);
  view.shake = Math.max(view.shake, 13);
}

// Online: is there a body on the floor for fighter p?
export const hasRagdoll = p => ragdolls.some(r => r.id === p);

// Online: a rollback undid fighter p's death. Remove its body, sword and blood.
export function undoKill(p) {
  const mine = o => o.id === p || (o.tag && o.tag.victim === p);
  for (const list of [ragdolls, swords, fx]) for (let j = list.length - 1; j >= 0; j--) if (mine(list[j]) && (list !== fx || list[j].tag)) list.splice(j, 1);
}

// Online: the touch is confirmed, so its blood may now stain the floor.
export function confirmKills() { for (const list of [ragdolls, swords, fx]) for (const o of list) o.tag = undefined; }

function verletPoint(p, dt) { const vx = (p.x - p.px) * .995, vy = (p.y - p.py) * .995; p.px = p.x; p.py = p.y; p.x += vx; p.y += vy + GRAV * .8 * dt * dt; }
// The solid block point p (radius r) is inside, if any.
const solidAt = (map, x, y, r) => map.solids.find(s => x > s.x - r && x < s.x + s.w + r && y > s.y - r && y < s.y + s.h + r);
// Ragdoll points: pushed out of blocks the shortest way (landing on top has friction), platforms.
function collidePoint(p, r, map) {
  const {platforms} = map, s = solidAt(map, p.x, p.y, r);
  if (s) {
    const up = p.y - (s.y - r), down = s.y + s.h + r - p.y, left = p.x - (s.x - r), right = s.x + s.w + r - p.x, m = Math.min(up, down, left, right);
    if (m === up) { const vy = p.y - p.py; p.y = s.y - r; p.py = p.y + vy * .3; p.px = p.x - (p.x - p.px) * .7; }
    else if (m === down) { p.y = s.y + s.h + r; p.py = p.y; }
    else if (m === left) { p.x = s.x - r; p.px = p.x + (p.x - p.px) * .4; }
    else { p.x = s.x + s.w + r; p.px = p.x + (p.x - p.px) * .4; }
  }
  for (const pl of platforms) { if (p.py <= pl.y - r + 1 && p.y > pl.y - r && p.x > pl.x && p.x < pl.x + pl.w) { const vy = p.y - p.py; p.y = pl.y - r; p.py = p.y + vy * .3; p.px = p.x - (p.x - p.px) * .7; } }
}
function satisfy(a, b, len) { const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || .001, k = (d - len) / d * .5; a.x += dx * k; a.y += dy * k; b.x -= dx * k; b.y -= dy * k; }

// ---------- per-fighter looks ----------
function updateBand(f, look) {
  const s = f.face, anc = {x: f.P.head.x - s * 8, y: f.P.head.y - 4};
  if (!look.band) look.band = [{...anc}, {...anc}];
  const t1 = {x: anc.x - s * 9 - f.vx * .025, y: anc.y + 3 - f.vy * .012}, b = look.band;
  b[0].x = lerp(b[0].x, t1.x, .35); b[0].y = lerp(b[0].y, t1.y, .35);
  const t2 = {x: b[0].x - s * 8 - f.vx * .02, y: b[0].y + 4 - f.vy * .01};
  b[1].x = lerp(b[1].x, t2.x, .25); b[1].y = lerp(b[1].y, t2.y, .25);
}
function clonePose(P) { const c = {}; for (const k in P) if (P[k] && P[k].x !== undefined) c[k] = {x: P[k].x, y: P[k].y}; return c; }

// Called after every simulation tick that actually moved (not during freeze-frames).
export function updateFx(S, dt) {
  const map = getMap(S), {platforms} = map;
  const live = S.phase !== 'countdown';
  for (let p = 0; p < 2; p++) {
    const f = S.F[p], L = looks[p];
    if (f.alive) {
      updateBand(f, L);
      if (live) {
        if (f.tipSpeed > 380 || lungeActive(f)) L.trail.push({tip: {...f.P.tip}, mid: {x: lerp(f.P.hand.x, f.P.tip.x, .5), y: lerp(f.P.hand.y, f.P.tip.y, .5)}, life: .09});
        if (f.dashT > 0 || f.slideT > 0) { L.ghostT -= dt; if (L.ghostT <= 0) { L.ghostT = .03; L.ghosts.push({P: clonePose(f.P), life: .18}); } }
      }
    }
    for (const t of L.trail) t.life -= dt; L.trail = L.trail.filter(t => t.life > 0);
    for (const g of L.ghosts) g.life -= dt; L.ghosts = L.ghosts.filter(g => g.life > 0);
  }
  for (const r of ragdolls) {
    for (const k in r.pts) verletPoint(r.pts[k], dt);
    for (let it = 0; it < 5; it++) { for (const c of r.cons) satisfy(r.pts[c.a], r.pts[c.b], c.len); for (const k in r.pts) collidePoint(r.pts[k], k === 'head' ? 10 : 2.5, map); }
  }
  for (const s of swords) { verletPoint(s.a, dt); verletPoint(s.b, dt); for (let it = 0; it < 4; it++) { satisfy(s.a, s.b, s.len); collidePoint(s.a, 2, map); collidePoint(s.b, 1.5, map); } }
  for (let j = fx.length - 1; j >= 0; j--) {
    const p = fx[j]; p.life -= dt;
    if (p.type === 'spark') { p.vy += 900 * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    else if (p.type === 'blood') {
      p.vy += 1600 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      // a drop that enters a block sticks to the face it came through (a top, or a wall's side)
      const s = solidAt(map, p.x, p.y, 0);
      let hit = !!s, side = false;
      if (s) { const px = p.x - p.vx * dt, py = p.y - p.vy * dt; if (py <= s.y) p.y = s.y + 1; else if (px <= s.x) { p.x = s.x + 1; side = true; } else if (px >= s.x + s.w) { p.x = s.x + s.w - 1; side = true; } else p.y = s.y + s.h - 1; }
      for (const pl of platforms) if (!hit && p.vy > 0 && p.y >= pl.y && p.y < pl.y + 10 && p.x > pl.x && p.x < pl.x + pl.w) { hit = true; p.y = pl.y + 1; }
      // provisional blood waits on the floor (not painted) until the touch is confirmed
      if (hit && p.tag) { p.vx = p.vy = 0; p.life = Math.max(p.life, .5); }
      else if (hit) { splat(p.x, p.y, p.size, side); p.life = 0; }
    }
    else if (p.type === 'puff') { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .92; p.vy *= .92; }
    else if (p.type === 'text') { p.y += p.vy * dt; }
    if (p.life <= 0) fx.splice(j, 1);
  }
}

// Called once per screen frame with real elapsed time (not game time).
export function updateRealtime(rdt) {
  view.shake = Math.max(0, view.shake - rdt * 40);
  if (view.callout) { view.callout.t += rdt; if (view.callout.t > view.callout.dur) view.callout = null; }
  if (view.mapLabel) { view.mapLabel.t += rdt; if (view.mapLabel.t > 2.4) view.mapLabel = null; }
}
