// Frozen Lake: very slippery ice between two snowy banks, split by two crevasses
// with ice spikes at the bottom. Frozen ropes hang from dead trees over the
// crevasses, icicles hang under the rock overhangs at both ends, and fishing-hut
// roofs stand on the ice. (Field meanings: see ../maps.js.)

const ICE = 700, BANK = 620, GRIP = .08;

export default {
  name: 'Frozen Lake', theme: 'lake', width: 1700, height: 920,
  solids: [
    {x: 0, y: 0, w: 60, h: 920, look: 'rock'}, {x: 1640, y: 0, w: 60, h: 920, look: 'rock'},
    {x: 60, y: 0, w: 180, h: 330, look: 'rock'}, {x: 1460, y: 0, w: 180, h: 330, look: 'rock'},     // overhangs
    {x: 60, y: BANK, w: 250, h: 300, look: 'snow'}, {x: 1390, y: BANK, w: 250, h: 300, look: 'snow'}, // banks
    {x: 310, y: ICE, w: 160, h: 220, look: 'ice', grip: GRIP}, {x: 560, y: ICE, w: 580, h: 220, look: 'ice', grip: GRIP},
    {x: 1230, y: ICE, w: 160, h: 220, look: 'ice', grip: GRIP},
  ],
  pits: [{x: 470, y: ICE, w: 90, d: 170, look: 'crevasse'}, {x: 1140, y: ICE, w: 90, d: 170, look: 'crevasse'}],
  spikes: [{x: 70, y: 330, w: 160, h: 16, dir: 'down'}, {x: 1470, y: 330, w: 160, h: 16, dir: 'down'}], // icicles
  platforms: [{x: 80, y: 480, w: 140, look: 'rock'}, {x: 1480, y: 480, w: 140, look: 'rock'}, {x: 640, y: 575, w: 150, look: 'hut'}, {x: 910, y: 575, w: 150, look: 'hut'}],
  ropes: [{x: 515, y0: 300, y1: 560, look: 'rope', tree: -1}, {x: 1185, y0: 300, y1: 560, look: 'rope', tree: 1}],
  spawns: [{x: 710, y: ICE, face: 1}, {x: 990, y: ICE, face: -1}],
  items: [{x: 715, y: 575}, {x: 985, y: 575}, {x: 150, y: 480}, {x: 1550, y: 480}, {x: 200, y: 620}, {x: 1500, y: 620}], // power-up spots, in mirrored pairs
  colors: {
    light: {sky: '#dbe8f3', skyLow: '#c6d9ea', floor: '#d4e6f3', platform: '#a7c6dc', line: '#1d3347', accent: '#3a7bb0'},
    dark: {sky: '#0d1520', skyLow: '#15243a', floor: '#1f3850', platform: '#2f5470', line: '#d8ecfa', accent: '#7cc4f2'},
  },
};
