// Great Hall: a castle hall at night. Chandeliers hang on chains (two of them over
// spiked oubliettes), balconies along both walls, musicians' galleries in the middle,
// and stone pedestals to vault and wall-jump off. (Field meanings: see ../maps.js.)

const FLOOR = 790, PIT = 130;

export default {
  name: 'Great Hall', theme: 'castle', width: 1760, height: 940,
  solids: [
    {x: 0, y: 0, w: 40, h: 940}, {x: 1720, y: 0, w: 40, h: 940},        // side walls
    {x: 0, y: 0, w: 1760, h: 40, look: 'ceiling'},                       // vaulted ceiling
    {x: 40, y: FLOOR, w: 290, h: 150}, {x: 450, y: FLOOR, w: 860, h: 150}, {x: 1430, y: FLOOR, w: 290, h: 150}, // floor
    {x: 40, y: 520, w: 260, h: 26, look: 'balcony'}, {x: 1460, y: 520, w: 260, h: 26, look: 'balcony'},
    {x: 520, y: 710, w: 40, h: 80, look: 'pedestal'}, {x: 1200, y: 710, w: 40, h: 80, look: 'pedestal'},
  ],
  pits: [{x: 330, y: FLOOR, w: 120, d: PIT}, {x: 1310, y: FLOOR, w: 120, d: PIT}],
  platforms: [{x: 600, y: 580, w: 180}, {x: 980, y: 580, w: 180}],
  ropes: [
    {x: 390, y0: 40, y1: 610, look: 'chain', lamp: 'chandelier'}, {x: 1370, y0: 40, y1: 610, look: 'chain', lamp: 'chandelier'},
    {x: 880, y0: 40, y1: 330, look: 'chain', lamp: 'chandelier'},
  ],
  spawns: [{x: 740, y: FLOOR, face: 1}, {x: 1020, y: FLOOR, face: -1}],
  colors: {
    light: {sky: '#d9d3c8', skyLow: '#c9bfae', floor: '#a49a8a', platform: '#7a6e5f', line: '#1e1a16', accent: '#b8322a'},
    dark: {sky: '#11131c', skyLow: '#1a1c27', floor: '#2b2a31', platform: '#3f3c45', line: '#ece6dc', accent: '#ff6b4a'},
  },
};
