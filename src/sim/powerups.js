// Power-ups (when the lobby's Power-ups option is on). They appear in fair "waves": one
// pickup per fencer, all the same kind, on a mirrored pair of the map's spots (map.items),
// so neither side is favoured. Each fencer can take only one pickup per wave (f.took
// remembers the last wave they took from), so the nearer fencer can't grab both. Walk
// through a pickup to take it. A fencer holds one power until the round ends; taking
// another replaces it.
//   swift:  run faster, dash again sooner
//   long:   a longer blade
//   air:    several dashes per jump
//   knife:  one throwing knife (the Throw key): it kills on any touch, and a blade in its
//           path blocks it
// What each one does to movement is in fighter.js (it reads f.power); the numbers are in
// constants.js. Everything lives in S (S.items, S.itemT, S.wave, S.knives), so it rewinds.
//
// Fairness: the first wave comes when the round starts, with the fencers on mirrored
// spawns, so each pickup of the pair is exactly as far from one fencer as the other is
// from the other. Later waves pick the pair that is closest to fair for where everyone
// is standing right then (the gap between the nearest fencer's and the farthest fencer's
// walk to "their" pickup). Nothing here assumes two fencers: with more players, a wave
// would need one spot per player in each group (see the FFA plan in DEVLOG.md).

import {TICK_HZ, BLADE, POWER_AGAIN, LONG_BLADE, KNIFE_V, KNIFE_GRAV, KNIFE_LIFE} from './constants.js';
import {random} from './rng.js';
import {segSeg} from './util.js';
import {bodyParts} from './fighter.js';
import {insideSolid, BODY_H} from './terrain.js';
import {kill} from './combat.js';
import {emit} from './events.js';

export const KINDS = ['swift', 'long', 'air', 'knife'];
export const POWER_NAMES = {swift: 'SWIFT', long: 'LONG BLADE', air: 'AIR DASH', knife: 'KNIFE'};
const FLOAT = 34;      // a pickup floats this far above its spot
const NEAR = 160;      // never appear closer than this to a fencer (not on someone's head)
const FAIR_SLACK = 60; // pairs within this many px of the fairest one are all fine (keeps variety)

// A new round: the first wave is already waiting (so it's there during the countdown).
export function resetPowerups(S, map) {
  S.items = []; S.itemT = 0; S.knives = []; S.wave = S.wave || 0;
  if (S.mode.powerups) spawnWave(S, map);
}

// Give fencer f a power.
export function givePower(f, kind) {
  f.power = kind; f.blade = kind === 'long' ? LONG_BLADE : BLADE; f.knife = kind === 'knife';
}

// The map's spots grouped with their mirror image (x → width - x, same height).
// A spot right on the middle line is its own mirror and makes a group of one.
function mirrorGroups(map) {
  const spots = map.items || [], used = new Set(), groups = [];
  spots.forEach((s, k) => {
    if (used.has(k)) return;
    used.add(k);
    const m = spots.findIndex((o, j) => !used.has(j) && o.x === map.width - s.x && o.y === s.y);
    if (m >= 0) used.add(m);
    groups.push(m >= 0 ? [s, spots[m]] : [s]);
  });
  return groups;
}

const dist = (f, s) => Math.hypot(f.x - s.x, f.y - s.y);

// How unfair is a group of spots right now? Each standing fencer walks to the spot nearest
// them; the answer is the gap between the shortest and the longest of those walks (px).
function unfairness(S, g) {
  let lo = Infinity, hi = -Infinity;
  for (const f of S.F) {
    if (!f.alive) continue;
    const d = Math.min(...g.map(s => dist(f, s)));
    lo = Math.min(lo, d); hi = Math.max(hi, d);
  }
  return hi > lo ? hi - lo : 0;
}

// Put out a new wave (replacing any pickups left from the last one): pick the fairest
// group of spots that isn't on top of anyone, and one kind for the whole wave.
function spawnWave(S, map) {
  const groups = mirrorGroups(map);
  if (!groups.length) return;
  const clear = groups.filter(g => g.every(s => S.F.every(f => !f.alive || dist(f, s) > NEAR)));
  const pool = clear.length ? clear : groups;
  const score = pool.map(g => unfairness(S, g)), best = Math.min(...score);
  const fair = pool.filter((g, k) => score[k] <= best + FAIR_SLACK);
  const g = fair[Math.floor(random(S) * fair.length)], kind = KINDS[Math.floor(random(S) * KINDS.length)];
  S.wave++; S.itemT = 0;
  S.items = g.map(s => ({kind, x: s.x, y: s.y - FLOAT, wave: S.wave}));
  for (const it of S.items) emit('itemSpawn', {x: it.x, y: it.y, kind});
}

// Is the pickup touching fencer f's body?
const touching = (f, it) => Math.abs(f.x - it.x) < 22 && it.y > f.y - BODY_H - 14 && it.y < f.y + 14;

// Can fencer f take pickup it? (Standing, touching it, and hasn't taken one from this wave.)
export const canTake = (f, it) => f.alive && f.took !== it.wave;

// One tick of power-ups during a fight. The next wave comes POWER_AGAIN seconds after the
// first pickup of this one is taken. If two fencers touch the same pickup on the same
// tick, the lower player number gets it (that needs both on the same pixel).
export function updatePowerups(S, map) {
  if (S.itemT > 0 && --S.itemT === 0) { spawnWave(S, map); return; }
  for (const f of S.F) {
    const it = S.items.find(it => canTake(f, it) && touching(f, it));
    if (!it) continue;
    givePower(f, it.kind); f.took = it.wave;
    emit('pickup', {p: f.id, kind: f.power, x: it.x, y: it.y});
    emit('text', {x: it.x, y: it.y - 30, text: POWER_NAMES[f.power], color: f.id ? 'green' : 'red'});
    emit('sfx', {name: 'pickup'});
    S.items = S.items.filter(o => o !== it);
    if (S.itemT === 0) S.itemT = Math.round(POWER_AGAIN * TICK_HZ);
  }
}

// Fencer f throws its knife from the hand, the way its blade points.
export function throwKnife(S, f) {
  const P = f.P;
  S.knives.push({x: P.hand.x, y: P.hand.y, vx: P.dx * KNIFE_V + f.vx * .3, vy: P.dy * KNIFE_V, owner: f.id, t: 0});
  f.knife = false; f.power = null;
  emit('sfx', {name: 'throw'});
}

// Move every knife one tick. A knife that meets another fencer's blade is blocked; one that
// reaches their body kills. Returns the fencer it killed, or null. (Kills only count while
// `lethal`: during the fight, not in the pause after a touch.)
export function updateKnives(S, map, dt, lethal) {
  let victim = null;
  S.knives = S.knives.filter(k => {
    const a = {x: k.x, y: k.y};
    k.vy += KNIFE_GRAV * dt; k.x += k.vx * dt; k.y += k.vy * dt; k.t += dt;
    const b = {x: k.x, y: k.y};
    if (k.t > KNIFE_LIFE || insideSolid(map, k.x, k.y) || k.y > map.height + 200) {
      if (insideSolid(map, k.x, k.y)) emit('sparks', {x: a.x, y: a.y, n: 6});
      return false;
    }
    if (!lethal || victim) return true;
    for (const o of S.F) {
      if (o.id === k.owner || !o.alive) continue;
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
    }
    return true;
  });
  return victim;
}
