// Arenas, described as plain data. To add a map, copy an entry and change it.
//
//   name:        shown in the lobby and at round start
//   width/height: size in arena pixels (every player sees exactly this area); keep 960x540
//   floor:       y of the ground line (y grows downward)
//   floors:      optional solid stretches of floor [{x, w}]; anywhere else is a gap you fall into
//   walls:       x of the left and right ends
//   ends:        'walls' (solid), 'ringout' (an end line: cross it and the opponent scores) or
//                'drop' (no wall: the floor just stops and you fall)
//   ceiling:     optional y of a ceiling
//   innerWalls:  free-standing wall pieces [{x, y0, y1}] you can wall-jump off
//   platforms:   one-way ledges [{x, y, w}] you can jump up through and drop down from
//   pads:        [{type: 'jump' | 'speed', x, w, y, power}] jump pads launch you up (power = px/s);
//                speed pads give a short burst of run speed. Pads aren't hazards.
//   grip:        floor grip (1 = normal; ice is low: slow to start, slow to stop)
//   spawns:      where Red [0] and Green [1] start each round (mirror images of each other)
//   theme:       which backdrop the renderer paints (src/view/backdrops.js)
//   colors:      light/dark colours: sky (top), skyLow (above the floor), floor, platform, line, accent
//
// With Hazards off (a lobby option), safeMap() turns ring-out and drop ends into walls and puts
// nets over floor gaps, so every map plays without hazards.
// The match stores only the map's name (S.map) and the Hazards choice (S.mode.hazards).

const SIDE_SPAWNS = [{x: 348, face: 1}, {x: 612, face: -1}];
const HALL_COLORS = {
  light: {sky: '#e4e9ee', skyLow: '#d3dbe2', floor: '#c4ccd4', platform: '#98a4b0', line: '#16202b', accent: '#cf3a32'},
  dark: {sky: '#131920', skyLow: '#1b232c', floor: '#242e39', platform: '#3a4855', line: '#e6ecf1', accent: '#ff5b50'},
};
const HALL_PLATFORMS = [{x: 110, y: 350, w: 180}, {x: 670, y: 350, w: 180}, {x: 390, y: 252, w: 180}];

export const MAPS = {
  hall: {
    name: 'Hall', theme: 'hall', width: 960, height: 540, floor: 462,
    walls: {left: 18, right: 942}, ends: 'walls',
    platforms: HALL_PLATFORMS, spawns: SIDE_SPAWNS, colors: HALL_COLORS,
  },
  hallOpen: {
    name: 'Open Hall', theme: 'hall', width: 960, height: 540, floor: 462,
    walls: {left: 60, right: 900}, ends: 'ringout',
    platforms: HALL_PLATFORMS, spawns: SIDE_SPAWNS, colors: HALL_COLORS,
  },
  lake: {
    name: 'Frozen Lake', theme: 'lake', width: 960, height: 540, floor: 462, grip: .2,
    walls: {left: 70, right: 890}, ends: 'ringout',
    platforms: [{x: 150, y: 352, w: 150}, {x: 660, y: 352, w: 150}],
    spawns: SIDE_SPAWNS,
    colors: {
      light: {sky: '#dbe8f3', skyLow: '#c6d9ea', floor: '#d4e6f3', platform: '#a7c6dc', line: '#1d3347', accent: '#3a7bb0'},
      dark: {sky: '#0d1520', skyLow: '#15243a', floor: '#1f3850', platform: '#2f5470', line: '#d8ecfa', accent: '#7cc4f2'},
    },
  },
  roofs: {
    name: 'Rooftops', theme: 'roofs', width: 960, height: 540, floor: 462,
    walls: {left: 30, right: 930}, ends: 'drop',
    floors: [{x: 30, w: 270}, {x: 370, w: 220}, {x: 660, w: 270}],
    platforms: [{x: 90, y: 352, w: 120}, {x: 750, y: 352, w: 120}, {x: 400, y: 318, w: 160}],
    spawns: [{x: 250, face: 1}, {x: 710, face: -1}],
    colors: {
      light: {sky: '#f4c9a1', skyLow: '#e79f86', floor: '#8b8f99', platform: '#5c616c', line: '#231c26', accent: '#f2a541'},
      dark: {sky: '#0b0f1e', skyLow: '#1b1f3a', floor: '#30364a', platform: '#454c66', line: '#e6e9f5', accent: '#ffd36b'},
    },
  },
  dojo: {
    name: 'Dojo', theme: 'dojo', width: 960, height: 540, floor: 462, ceiling: 232,
    walls: {left: 170, right: 790}, ends: 'walls',
    innerWalls: [{x: 330, y0: 232, y1: 330}, {x: 630, y0: 232, y1: 330}],
    platforms: [{x: 405, y: 352, w: 150}],
    spawns: [{x: 380, face: 1}, {x: 580, face: -1}],
    colors: {
      light: {sky: '#efe4cf', skyLow: '#e3d3b4', floor: '#c9a46b', platform: '#8a6237', line: '#2b1d10', accent: '#b8322a'},
      dark: {sky: '#1d1712', skyLow: '#2a2017', floor: '#4a3620', platform: '#6b4c2c', line: '#f1e3c8', accent: '#e0584c'},
    },
  },
  forge: {
    name: 'Forge', theme: 'forge', width: 960, height: 540, floor: 462,
    walls: {left: 18, right: 942}, ends: 'walls',
    platforms: [{x: 50, y: 178, w: 190}, {x: 720, y: 178, w: 190}, {x: 395, y: 300, w: 170}],
    pads: [
      {type: 'jump', x: 115, w: 60, y: 462, power: 1120}, {type: 'jump', x: 785, w: 60, y: 462, power: 1120},
      {type: 'speed', x: 225, w: 60, y: 462}, {type: 'speed', x: 675, w: 60, y: 462},
    ],
    spawns: SIDE_SPAWNS,
    colors: {
      light: {sky: '#e9d8c6', skyLow: '#d9b08c', floor: '#6d5a4f', platform: '#4a3b33', line: '#1f1410', accent: '#ff7a1a'},
      dark: {sky: '#140c0a', skyLow: '#2b1510', floor: '#3a2a24', platform: '#55403a', line: '#f5e1d0', accent: '#ff8a2a'},
    },
  },
};

export const DEFAULT_MAP = 'hall';
export const MAP_KEYS = Object.keys(MAPS);

// The same map with hazards switched off: solid ends, nets over the floor gaps.
function safeMap(m) {
  if (m.ends === 'walls' && !m.floors) return m;
  const s = {...m, ends: 'walls', floors: null, drawFloors: m.floors, nets: []}; // drawFloors: still drawn as rooftops
  if (m.floors) {
    const fl = [...m.floors].sort((a, b) => a.x - b.x);
    for (let k = 1; k < fl.length; k++) s.nets.push({x: fl[k - 1].x + fl[k - 1].w, w: fl[k].x - fl[k - 1].x - fl[k - 1].w});
  }
  return s;
}
const SAFE = Object.fromEntries(MAP_KEYS.map(k => [k, safeMap(MAPS[k])]));

// The arena for this match, with the Hazards setting applied.
export const getMap = S => {
  const k = MAPS[S.map] ? S.map : DEFAULT_MAP;
  return S.mode && S.mode.hazards === false ? SAFE[k] : MAPS[k];
};
