// Fixed numbers that define the arena and how fighters move.
// Changing any of these changes gameplay, so treat them as "the rules".

// World size in logical pixels. The canvas is scaled to fit the screen.
export const W = 960, H = 540, GROUND = 462, LEFT = 18, RIGHT = W - 18;

// One simulation tick lasts 1/120 of a second, always.
export const TICK_HZ = 120, DT = 1 / TICK_HZ;

// Movement
export const GRAV = 2300, JUMP_V = 780, DJUMP_V = 660, RUN_MAX = 270, CROUCH_MAX = 110;
export const RUN_ACC = 2800, AIR_ACC = 1700, GROUND_FRIC = 2600, AIR_FRIC = 260;
export const DASH_V = 760, DASH_T = 0.13, DASH_CD = 0.55, SLIDE_T = 0.42, SLIDE_V = 450;

// Blade: length, arm length, how fast a blade must move to kill, and the aim limits (radians)
export const BLADE = 76, ARM = 24, LETHAL = 600, ANG_MIN = -1.15, ANG_MAX = 1.25;

// Piste markings: the strip is 14 "metres" wide
export const PX_M = (RIGHT - LEFT) / 14, CENTER = W / 2;

export const PLATFORMS = [{x: 110, y: 350, w: 180}, {x: 670, y: 350, w: 180}, {x: 390, y: 252, w: 180}];

// How long a key press is remembered if it can't be used straight away (seconds)
export const PRESS_BUFFER = 0.13;

// Round flow, measured in ticks so it's identical on every machine.
export const COUNTDOWN_READY = Math.round(0.55 * TICK_HZ); // "PRÊTS ?"
export const COUNTDOWN_GO = TICK_HZ;                        // "ALLEZ !" after 1 second
// After a touch the game pauses on the KO for 1.5 seconds of game time.
// (The KO slow-motion stretches this to about 1.9 real seconds, same as before.)
export const KO_TICKS = Math.round(1.5 * TICK_HZ);
// Freeze frames when blades clash
export const HITSTOP_TICKS = Math.ceil(0.045 * TICK_HZ);
