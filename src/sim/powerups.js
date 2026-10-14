// Power-ups (when the lobby's Power-ups option is on). One at a time appears at one of the
// map's spots (map.items); walk through it to take it. A fencer holds one power until the
// round ends; taking another replaces it.
//   swift:  run faster, dash again sooner
//   long:   a longer blade
//   air:    several dashes per jump
//   knife:  one throwing knife (the Throw key): it kills on any touch, and a blade in its
//           path blocks it
// What each one does to movement is in fighter.js (it reads f.power); the numbers are in
// constants.js. Everything lives in S (S.item, S.itemT, S.knives), so it rewinds with the game.

import {TICK_HZ, BLADE, POWER_AGAIN, LONG_BLADE, KNIFE_V, KNIFE_GRAV, KNIFE_LIFE} from './constants.js';
import {random} from './rng.js';
import {segSeg} from './util.js';
import {bodyParts} from './fighter.js';
import {insideSolid, BODY_H} from './terrain.js';
import {kill} from './combat.js';
import {emit} from './events.js';

export const KINDS = ['swift', 'long', 'air', 'knife'];
export const POWER_NAMES = {swift: 'SWIFT', long: 'LONG BLADE', air: 'AIR DASH', knife: 'KNIFE'};
const FLOAT = 34; // the pickup floats this far above its spot

// A new round: the first power-up is already waiting (so it's there during the countdown).
export function resetPowerups(S, map) { S.item = null; S.itemT = 0; S.knives = []; if (S.mode.powerups) spawn(S, map); }

// Give fencer f a power.
export function givePower(f, kind) {
  f.power = kind; f.blade = kind === 'long' ? LONG_BLADE : BLADE; f.knife = kind === 'knife';
}

// Pick a spot away from both fencers (so nothing appears on someone's head), then a kind.
function spawn(S, map) {
  const spots = map.items || [];
  if (!spots.length) return;
  const clear = spots.filter(s => S.F.every(f => !f.alive || Math.hypot(f.x - s.x, f.y - s.y) > 160));
  const from = clear.length ? clear : spots, s = from[Math.floor(random(S) * from.length)];
  S.item = {kind: KINDS[Math.floor(random(S) * KINDS.length)], x: s.x, y: s.y - FLOAT};
  emit('itemSpawn', {x: S.item.x, y: S.item.y, kind: S.item.kind});
}

// Is the pickup touching fencer f's body?
const touching = (f, it) => Math.abs(f.x - it.x) < 22 && it.y > f.y - BODY_H - 14 && it.y < f.y + 14;

// One tick of power-ups during a fight: count down to the next one, and hand it to
// whoever touches it first (Red wins an exact tie, which needs both on the same pixel).
export function updatePowerups(S, map) {
  if (!S.item) { if (--S.itemT <= 0) spawn(S, map); return; }
  for (const f of S.F) {
    if (!f.alive || !touching(f, S.item)) continue;
    givePower(f, S.item.kind);
    emit('pickup', {p: f.id, kind: f.power, x: S.item.x, y: S.item.y});
    emit('text', {x: S.item.x, y: S.item.y - 30, text: POWER_NAMES[f.power], color: f.id ? 'green' : 'red'});
    emit('sfx', {name: 'pickup'});
    S.item = null; S.itemT = Math.round(POWER_AGAIN * TICK_HZ);
    return;
  }
}

// Fencer f throws its knife from the hand, the way its blade points.
export function throwKnife(S, f) {
  const P = f.P;
  S.knives.push({x: P.hand.x, y: P.hand.y, vx: P.dx * KNIFE_V + f.vx * .3, vy: P.dy * KNIFE_V, owner: f.id, t: 0});
  f.knife = false; f.power = null;
  emit('sfx', {name: 'throw'});
}

// Move every knife one tick. A knife that meets the opponent's blade is blocked; one that
// reaches their body kills. Returns the fencer it killed, or null. (Kills only count while
// `lethal`: during the fight, not in the pause after a touch.)
export function updateKnives(S, map, dt, lethal) {
  let victim = null;
  S.knives = S.knives.filter(k => {
    const a = {x: k.x, y: k.y};
    k.vy += KNIFE_GRAV * dt; k.x += k.vx * dt; k.y += k.vy * dt; k.t += dt;
    const b = {x: k.x, y: k.y}, o = S.F[1 - k.owner];
    if (k.t > KNIFE_LIFE || insideSolid(map, k.x, k.y) || k.y > map.height + 200) {
      if (insideSolid(map, k.x, k.y)) emit('sparks', {x: a.x, y: a.y, n: 6});
      return false;
    }
    if (!o.alive || !lethal || victim) return true;
    const blade = segSeg(a, b, o.P.hand, o.P.tip);
    if (blade.d < 4) {
      emit('sparks', {x: blade.p.x, y: blade.p.y, n: 14}); emit('sfx', {name: 'parry'});
      emit('text', {x: blade.p.x, y: blade.p.y - 24, text: 'BLOCK', color: o.id ? 'green' : 'red'});
      return false;
    }
    for (const q of bodyParts(o.P)) {
      const h = segSeg(a, b, q.a, q.b);
      if (h.d < q.r + 1.5) {
        kill(o, {p: {...h.p}, vx: k.vx, vy: k.vy, sp: Math.hypot(k.vx, k.vy), part: q.n, tip: true, lethal: true, knife: true});
        victim = o; return false;
      }
    }
    return true;
  });
  return victim;
}
