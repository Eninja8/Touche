// Forge: jump pads launch you to high platforms over the slag pits by the walls,
// speed pads on the floor, crane chains up to a catwalk (with hot spikes in its
// middle), and anvils to vault. (Field meanings: see ../maps.js.)

const FLOOR = 780;

export default {
  name: 'Forge', theme: 'forge', width: 1700, height: 920,
  solids: [
    {x: 0, y: 0, w: 50, h: 920}, {x: 1650, y: 0, w: 50, h: 920},
    {x: 0, y: 0, w: 1700, h: 40, look: 'ceiling'},
    {x: 170, y: FLOOR, w: 1360, h: 140},
    {x: 600, y: 300, w: 500, h: 20, look: 'catwalk'},
    {x: 390, y: FLOOR - 40, w: 50, h: 40, look: 'anvil'}, {x: 1260, y: FLOOR - 40, w: 50, h: 40, look: 'anvil'},
  ],
  pits: [{x: 50, y: FLOOR, w: 120, d: 140, look: 'slag'}, {x: 1530, y: FLOOR, w: 120, d: 140, look: 'slag'}],
  spikes: [{x: 820, y: 286, w: 60, h: 14, dir: 'up'}],
  platforms: [{x: 70, y: 450, w: 230}, {x: 1400, y: 450, w: 230}, {x: 330, y: 600, w: 160}, {x: 1210, y: 600, w: 160}],
  pads: [
    {type: 'jump', x: 230, w: 60, y: FLOOR, power: 1250}, {type: 'jump', x: 1410, w: 60, y: FLOOR, power: 1250},
    {type: 'speed', x: 500, w: 60, y: FLOOR}, {type: 'speed', x: 1140, w: 60, y: FLOOR},
  ],
  ropes: [{x: 560, y0: 40, y1: 590, look: 'chain', lamp: 'hook'}, {x: 1140, y0: 40, y1: 590, look: 'chain', lamp: 'hook'}],
  spawns: [{x: 710, y: FLOOR, face: 1}, {x: 990, y: FLOOR, face: -1}],
  colors: {
    light: {sky: '#e9d8c6', skyLow: '#d9b08c', floor: '#6d5a4f', platform: '#4a3b33', line: '#1f1410', accent: '#ff7a1a'},
    dark: {sky: '#140c0a', skyLow: '#2b1510', floor: '#3a2a24', platform: '#55403a', line: '#f5e1d0', accent: '#ff8a2a'},
  },
};
