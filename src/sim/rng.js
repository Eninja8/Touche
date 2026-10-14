// Seeded random numbers for the simulation.
//
// Math.random() gives different numbers on every computer, which would make two
// online players' games drift apart. This generator (mulberry32) always produces
// the same sequence from the same starting seed. Its whole state is one integer,
// stored in the game state as `S.rng`, so saving/restoring the game state for
// rollback also saves/restores the random sequence.

// Returns a number in [0, 1) and advances S.rng.
export function random(S) {
  let t = (S.rng = (S.rng + 0x6D2B79F5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// Returns a number in [a, b).
export const rand = (S, a, b) => a + random(S) * (b - a);
