// The simulation never plays sounds or draws anything itself. Instead it writes
// small notes ("events") such as {type:'sfx', name:'clash'} into a list.
// After each tick, main.js reads the list and passes it to the sound, effects
// and menu code. Later, during online rollback, the game re-runs old ticks and
// can simply throw these notes away so sounds don't play twice.

let list = [], muted = 0;

export function emit(type, data) { if (!muted) list.push({type, ...data}); }

// Hand over everything emitted since the last call, and start a fresh list.
export function drain() { const out = list; list = []; return out; }

// Run fn without recording any events (the CPU uses this to try out moves in its head).
export function quietly(fn) { muted++; try { return fn(); } finally { muted--; } }
