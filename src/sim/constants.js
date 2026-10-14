// Fixed numbers that define how fighters move. (The arena itself is in maps.js.)
// Changing any of these changes gameplay, so treat them as "the rules".

// One simulation tick lasts 1/120 of a second, always.
export const TICK_HZ = 120, DT = 1 / TICK_HZ;

// Movement
export const GRAV = 2300, JUMP_V = 780, DJUMP_V = 660, RUN_MAX = 270, CROUCH_MAX = 110;
export const RUN_ACC = 2800, AIR_ACC = 1700, GROUND_FRIC = 2600, AIR_FRIC = 260;
export const DASH_V = 760, DASH_T = 0.13, DASH_CD = 0.55, SLIDE_T = 0.42, SLIDE_V = 450;

// Blade: length, arm length and the aim limits (radians)
export const BLADE = 76, ARM = 24, ANG_MIN = -1.15, ANG_MAX = 1.25;

// When does a blade kill? (Thrusts are always lethal while the point is live.)
// LETHAL: any part of the blade kills when it moves this fast (px/s) relative to the body: a swing.
// TIP_LETHAL: the point (the outer TIP_ZONE of the blade) also kills when it is driven
//   into the body this fast along the blade's direction: walking or running onto a point.
export const LETHAL = 600, TIP_LETHAL = 250, TIP_ZONE = 0.15;
// A harmless contact is solid: the body is shoved out of the blade (at most PUSH_MAX px per
// tick) and the holder takes PUSH_HOLDER of that shove themselves.
export const PUSH_MAX = 24, PUSH_HOLDER = 0.25;

// The beat: when blades meet and one point is being swung at BEAT_SPEED (px/s) or more
// (measured from how fast the blade turns, so carrying a still blade at a run doesn't count)
// while the other moves at most BEAT_RATIO of that speed, the slower blade is knocked
// BEAT_KNOCK radians wide and can't kill (or thrust) for BEAT_OPEN seconds.
// (Thrusts meeting a blade are parries instead, as before.)
export const BEAT_SPEED = 450, BEAT_RATIO = 0.5, BEAT_KNOCK = 1.3, BEAT_OPEN = 0.35;

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

// Mouse aiming. The crosshair is an offset from the shoulder, in whole pixels,
// kept within AIM_REACH. The blade turns toward it at most MOUSE_TURN rad/s
// (fast enough that a full swing is lethal). Within AIM_DEADZONE pixels of
// straight up/down, the fencer keeps facing the same way.
export const AIM_REACH = 160, MOUSE_TURN = 9.5, AIM_DEADZONE = 3;
