// The arenas. Each map is plain data in its own file in maps/; this file lists them
// and builds the version the game plays on (with Hazards on or off).
//
// Map fields (all positions in arena pixels; y grows downward):
//   name, theme:  shown in the lobby and at round start / which painter draws it (src/view/themes/)
//   width, height: size of the map; the camera never shows past it
//   solids:     solid blocks [{x, y, w, h, look?, grip?}]: floors, walls, ledges, ceilings.
//               Every side of a block can be wall-jumped. grip: 1 = normal, ice is low.
//   pits:       gaps in the floor [{x, y, w, d, look?}] with spikes at the bottom (d deep).
//               The floor blocks on each side make the pit's walls.
//   spikes:     spike strips [{x, y, w, h, dir}]: the box the spikes fill, and which way they point
//   platforms:  one-way ledges [{x, y, w}] you can jump up through and drop down from
//   ropes:      climbable ropes, chains and ladders [{x, y0, y1, look}] (see rope.js)
//   pads:       [{type: 'jump' | 'speed', x, w, y, power}] jump pads launch you up (power = px/s);
//               speed pads give a short burst of run speed. Pads aren't hazards.
//   spawns:     where Red [0] and Green [1] start each round (mirror images of each other)
//   items:      spots where power-ups can appear [{x, y}] (y = the surface), in mirrored pairs
//   colors:     light/dark colours used for the arena: sky, skyLow, floor, platform, line, accent
//
// Touching spikes is a touch for the opponent (both at once: coup double).
// With Hazards off (a lobby option), spikes are removed and pits get a floor over them.
// The match stores only the map's name (S.map) and the Hazards choice (S.mode.hazards).

import castle from './maps/castle.js';
import roofs from './maps/roofs.js';
import forge from './maps/forge.js';
import lake from './maps/lake.js';
import dojo from './maps/dojo.js';

export const MAPS = {castle, roofs, forge, lake, dojo};
export const DEFAULT_MAP = 'castle';
export const MAP_KEYS = Object.keys(MAPS);

// The playable map: pit floors and their spikes added, or (Hazards off) no spikes and
// a floor over every pit. `covers` lists those floors so they can be drawn as such.
function build(def, hazards) {
  const m = {...def, solids: [...def.solids], platforms: def.platforms || [], ropes: def.ropes || [], pads: def.pads || [],
    pits: def.pits || [], spikes: hazards ? [...(def.spikes || [])] : [], covers: [], hazards};
  for (const p of m.pits) {
    m.solids.push({x: p.x, y: p.y + p.d, w: p.w, h: 40, look: 'pitFloor'});
    if (hazards) m.spikes.push({x: p.x, y: p.y + p.d - 16, w: p.w, h: 16, dir: 'up', pit: true});
    else { const c = {x: p.x, y: p.y, w: p.w, h: 12, look: 'cover'}; m.solids.push(c); m.covers.push(c); }
  }
  return m;
}
const BUILT = Object.fromEntries(MAP_KEYS.map(k => [k, {on: build(MAPS[k], true), off: build(MAPS[k], false)}]));

// The arena for this match, with the Hazards setting applied.
export const getMap = S => {
  const b = BUILT[MAPS[S.map] ? S.map : DEFAULT_MAP];
  return S.mode && S.mode.hazards === false ? b.off : b.on;
};
