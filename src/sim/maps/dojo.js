// Dojo: a training hall with climbing ropes from the ceiling beams, raised
// walkways along both walls, two pillars hanging from the roof to wall-jump off,
// bamboo-spike traps in the floor and spiked corners. (Field meanings: see ../maps.js.)

const FLOOR = 740;

export default {
  name: 'Dojo', theme: 'dojo', width: 1600, height: 900,
  solids: [
    {x: 0, y: 0, w: 50, h: 900}, {x: 1550, y: 0, w: 50, h: 900},
    {x: 0, y: 0, w: 1600, h: 110, look: 'ceiling'},
    {x: 50, y: FLOOR, w: 250, h: 160}, {x: 400, y: FLOOR, w: 800, h: 160}, {x: 1300, y: FLOOR, w: 250, h: 160},
    {x: 50, y: 470, w: 220, h: 24, look: 'walkway'}, {x: 1330, y: 470, w: 220, h: 24, look: 'walkway'},
    {x: 690, y: 110, w: 18, h: 270, look: 'pillar'}, {x: 892, y: 110, w: 18, h: 270, look: 'pillar'},
  ],
  pits: [{x: 300, y: FLOOR, w: 100, d: 140, look: 'bamboo'}, {x: 1200, y: FLOOR, w: 100, d: 140, look: 'bamboo'}],
  spikes: [{x: 50, y: FLOOR - 14, w: 60, h: 14, dir: 'up'}, {x: 1490, y: FLOOR - 14, w: 60, h: 14, dir: 'up'}],
  platforms: [{x: 270, y: 610, w: 150}, {x: 1180, y: 610, w: 150}, {x: 708, y: 560, w: 184}],
  ropes: [{x: 560, y0: 110, y1: 590, look: 'rope'}, {x: 1040, y0: 110, y1: 590, look: 'rope'}],
  spawns: [{x: 660, y: FLOOR, face: 1}, {x: 940, y: FLOOR, face: -1}],
  items: [{x: 170, y: 470}, {x: 1430, y: 470}, {x: 345, y: 610}, {x: 1255, y: 610}, {x: 770, y: 560}, {x: 830, y: 560}], // power-up spots, in mirrored pairs
  colors: {
    light: {sky: '#efe4cf', skyLow: '#e3d3b4', floor: '#c9a46b', platform: '#8a6237', line: '#2b1d10', accent: '#b8322a'},
    dark: {sky: '#1d1712', skyLow: '#2a2017', floor: '#4a3620', platform: '#6b4c2c', line: '#f1e3c8', accent: '#e0584c'},
  },
};
