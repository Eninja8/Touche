// Draws the power-ups: the pickups waiting on the map (a glowing gold token with an icon),
// a small icon over the head of whoever holds one, and knives in flight. The pickup is
// gold so it never looks like the orange-red danger colour of hazards. Purely cosmetic.

import {glow} from './paint.js';
import {C} from './theme.js';

const GOLD = '#ffd84a', INK = '#16120a';

// The icon for each power, centred on (x, y), about 2s wide, drawn in colour c.
export function icon(ctx, kind, x, y, s, c) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s / 10, s / 10);
  ctx.strokeStyle = c; ctx.fillStyle = c; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  if (kind === 'swift') { // a lightning bolt
    ctx.moveTo(2, -9); ctx.lineTo(-5, 1); ctx.lineTo(0, 1); ctx.lineTo(-2, 9); ctx.lineTo(5, -2); ctx.lineTo(0, -2); ctx.closePath(); ctx.fill();
  } else if (kind === 'long') { // a long sword, point up
    ctx.moveTo(-6, 8); ctx.lineTo(7, -8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-7, 3); ctx.lineTo(-1, 9); ctx.stroke();
  } else if (kind === 'air') { // a wing
    for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(-7, -5 + k * 5); ctx.quadraticCurveTo(0, -9 + k * 5, 8 - k * 3, -6 + k * 6); ctx.stroke(); }
  } else if (kind === 'knife') { // a dagger, point up
    ctx.moveTo(0, -9); ctx.lineTo(3, -1); ctx.lineTo(-3, -1); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(5, 0); ctx.moveTo(0, 0); ctx.lineTo(0, 8); ctx.stroke();
  }
  ctx.restore();
}

// The pickups waiting on the map: bobbing, glowing, with a slowly turning ring of sparkles.
export function drawItems(ctx, S, dark, t) { for (const it of S.items || []) drawItem(ctx, it, dark, t); }

function drawItem(ctx, it, dark, t) {
  const y = it.y + Math.sin(t * 3) * 4, pulse = .5 + .5 * Math.sin(t * 5);
  glow(ctx, it.x, y, 46, 'rgba(255,216,74,.9)', (dark ? .45 : .35) + pulse * .15, dark);
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(it.x, y, 15, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = GOLD; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(it.x, y, 15, 0, Math.PI * 2); ctx.stroke();
  icon(ctx, it.kind, it.x, y, 9, GOLD);
  ctx.fillStyle = GOLD;
  for (let k = 0; k < 4; k++) { const a = t * 1.6 + k * Math.PI / 2; ctx.globalAlpha = .55 + .45 * Math.sin(t * 4 + k); ctx.fillRect(it.x + Math.cos(a) * 22 - 1.5, y + Math.sin(a) * 22 - 1.5, 3, 3); }
  ctx.globalAlpha = 1;
}

// A small token over the head of a fencer holding a power, in their colour.
export function drawHeld(ctx, f) {
  if (!f.alive || !f.power || !f.P) return;
  const x = f.P.head.x, y = f.P.head.y - 26, col = f.id ? C.green : C.red;
  ctx.fillStyle = INK; ctx.globalAlpha = .85; ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.stroke();
  icon(ctx, f.power, x, y, 5.5, '#ffffff');
}

// Knives in flight: a short steel blade along its path with a faint streak in the thrower's colour.
export function drawKnives(ctx, S) {
  for (const k of S.knives) {
    const sp = Math.hypot(k.vx, k.vy) || 1, ux = k.vx / sp, uy = k.vy / sp, col = k.owner ? C.green : C.red;
    ctx.lineCap = 'round';
    ctx.strokeStyle = col; ctx.globalAlpha = .35; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(k.x - ux * 46, k.y - uy * 46); ctx.lineTo(k.x - ux * 12, k.y - uy * 12); ctx.stroke(); ctx.globalAlpha = 1;
    ctx.strokeStyle = INK; ctx.lineWidth = 4.5; ctx.beginPath(); ctx.moveTo(k.x - ux * 14, k.y - uy * 14); ctx.lineTo(k.x + ux * 6, k.y + uy * 6); ctx.stroke();
    ctx.strokeStyle = C.steel; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(k.x - ux * 6, k.y - uy * 6); ctx.lineTo(k.x + ux * 6, k.y + uy * 6); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(k.x - ux * 14, k.y - uy * 14); ctx.lineTo(k.x - ux * 7, k.y - uy * 7); ctx.stroke();
  }
}
