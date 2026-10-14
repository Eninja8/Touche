// Who is fencer f fighting? With two fencers it's simply the other one. Written for any
// number of fencers so a free-for-all mode later needs no changes here (see DEVLOG's
// FFA plan): the nearest fencer still standing, or the nearest one if all are down.

export function foeOf(S, f) {
  let best = null, bestD = Infinity, bestAlive = false;
  for (const o of S.F) {
    if (o === f) continue;
    const d = Math.hypot(o.x - f.x, o.y - f.y);
    if ((o.alive && !bestAlive) || (o.alive === bestAlive && d < bestD)) { best = o; bestD = d; bestAlive = o.alive; }
  }
  return best;
}
