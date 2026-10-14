// Rooftops: three roofs between two tall buildings. The alleys between them have
// spiked railings at the bottom; the chimneys have spikes on top. Crane chains hang
// over the alleys, fire-escape ladders climb the towers, and a billboard walkway
// runs above the middle roof. (Field meanings: see ../maps.js.)

const MID = 700, SIDE = 640;

export default {
  name: 'Rooftops', theme: 'roofs', width: 1800, height: 960,
  solids: [
    {x: 0, y: 330, w: 120, h: 630, look: 'tower'}, {x: 1680, y: 330, w: 120, h: 630, look: 'tower'},
    {x: 120, y: SIDE, w: 260, h: 320, look: 'roof'}, {x: 480, y: MID, w: 840, h: 260, look: 'roof'}, {x: 1420, y: SIDE, w: 260, h: 320, look: 'roof'},
    {x: 560, y: SIDE, w: 50, h: 60, look: 'chimney'}, {x: 1190, y: SIDE, w: 50, h: 60, look: 'chimney'},
  ],
  pits: [{x: 380, y: MID, w: 100, d: 200, look: 'alley'}, {x: 1320, y: MID, w: 100, d: 200, look: 'alley'}],
  spikes: [{x: 560, y: SIDE - 14, w: 50, h: 14, dir: 'up'}, {x: 1190, y: SIDE - 14, w: 50, h: 14, dir: 'up'}],
  platforms: [{x: 700, y: 500, w: 400, look: 'billboard'}, {x: 200, y: 470, w: 130, look: 'fire'}, {x: 1470, y: 470, w: 130, look: 'fire'}],
  ropes: [
    {x: 430, y0: 0, y1: 520, look: 'chain', lamp: 'hook'}, {x: 1370, y0: 0, y1: 520, look: 'chain', lamp: 'hook'},
    {x: 138, y0: 330, y1: 530, look: 'ladder', to: SIDE}, {x: 1662, y0: 330, y1: 530, look: 'ladder', to: SIDE},
  ],
  spawns: [{x: 760, y: MID, face: 1}, {x: 1040, y: MID, face: -1}],
  colors: {
    light: {sky: '#f4c9a1', skyLow: '#e79f86', floor: '#8b8f99', platform: '#5c616c', line: '#231c26', accent: '#f2a541'},
    dark: {sky: '#0b0f1e', skyLow: '#1b1f3a', floor: '#30364a', platform: '#454c66', line: '#e6e9f5', accent: '#ffd36b'},
  },
};
