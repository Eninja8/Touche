// Arenas, described as plain data. To add a map, copy an entry and change it.
//
//   width, height: size in arena pixels. Every player sees exactly this area
//                  (scaled to their screen), so keep 960x540 unless there's a reason.
//   floor:         y of the ground line (y grows downward)
//   walls:         x of the left and right walls fencers can't pass
//   platforms:     one-way ledges you can jump up through and drop down from
//   spawns:        where Red [0] and Green [1] start each round (face: 1 = right, -1 = left)
//   colors:        light- and dark-mode colours: sky (top), skyLow (just above the
//                  floor), floor, platform, and line (floor/platform edges)
//
// The match stores only the map's name in the game state (S.map), so maps work
// with rollback and online play automatically.

export const MAPS = {
  hall: {
    name: 'Hall',
    width: 960, height: 540, floor: 462,
    walls: {left: 18, right: 942},
    platforms: [{x: 110, y: 350, w: 180}, {x: 670, y: 350, w: 180}, {x: 390, y: 252, w: 180}],
    spawns: [{x: 348, face: 1}, {x: 612, face: -1}],
    colors: {
      light: {sky: '#e4e9ee', skyLow: '#d3dbe2', floor: '#c4ccd4', platform: '#98a4b0', line: '#16202b'},
      dark: {sky: '#131920', skyLow: '#1b232c', floor: '#242e39', platform: '#3a4855', line: '#e6ecf1'},
    },
  },
};

export const DEFAULT_MAP = 'hall';
export const getMap = S => MAPS[S.map] || MAPS[DEFAULT_MAP];
