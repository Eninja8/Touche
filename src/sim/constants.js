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

// How fast the blade turns (radians per second) when aiming with the mouse.
// THE number to change for a faster or slower blade. Everything else about swinging
// is a share of it, so changing it keeps the balance: the keyboard's raise/lower speed
// (KEY_TURN), the CPU's blade (`ang` in ai.js), and the swing speeds that kill (LETHAL)
// or beat (BEAT_SPEED, BEAT_MEET). A full-speed swing stays exactly as dangerous; it
// just gets there sooner. (Was 9.5 until October 2026.)
export const BLADE_TURN = 19;
// How fast the point moves in a full-speed swing with a normal blade (px/s): 1900 at 19.
export const FULL_SWING = BLADE_TURN * (ARM + BLADE);
// Keyboard raise/lower keys turn the blade at this speed (rad/s).
export const KEY_TURN = BLADE_TURN * .55;

// When does a blade kill? (Thrusts are always lethal while the point is live.)
// LETHAL: any part of the blade kills when it moves this fast (px/s) relative to the body: a swing.
// TIP_LETHAL: the point (the outer TIP_ZONE of the blade) also kills when it is driven
//   into the body this fast along the blade's direction: walking or running onto a point.
// LETHAL is 63% of a full-speed swing (1197 px/s at BLADE_TURN 19): swung flat out, the
// outer third of the blade kills, the same share as before the speed-up.
export const LETHAL = Math.round(.63 * FULL_SWING), TIP_LETHAL = 250, TIP_ZONE = 0.15;
// A harmless contact is solid: the body is shoved out of the blade (at most PUSH_MAX px per
// tick) and the holder takes PUSH_HOLDER of that shove themselves.
export const PUSH_MAX = 24, PUSH_HOLDER = 0.25;

// The beat: when blades meet and one point is being swung at BEAT_SPEED (px/s) or more
// (measured from how fast the blade turns, so carrying a still blade at a run doesn't count)
// while the other moves at most BEAT_RATIO of that speed, the slower blade is knocked
// BEAT_KNOCK radians wide and can't kill (or thrust) for BEAT_OPEN seconds.
// It's a normal clash instead if: either blade is thrusting (a parry), the beater beat
// within the last BEAT_CD seconds, or the other blade is swinging back into it at
// BEAT_MEET px/s or more. The beating swing itself can't kill until it slows below
// BEAT_SPEED: the follow-up has to be a thrust or the point.
// BEAT_SPEED and BEAT_MEET are shares of a full-speed swing (893 and 399 px/s at BLADE_TURN 19).
export const BEAT_SPEED = Math.round(.47 * FULL_SWING), BEAT_MEET = Math.round(.21 * FULL_SWING);
export const BEAT_RATIO = 0.5, BEAT_KNOCK = 1.3, BEAT_OPEN = 0.35, BEAT_CD = 0.6;

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

// Mouse aiming. The aim is an offset from the shoulder, in whole pixels, kept within
// AIM_REACH. The blade turns toward it at BLADE_TURN (above). Within AIM_DEADZONE
// pixels of straight up/down, the fencer keeps facing the same way.
export const AIM_REACH = 160, AIM_DEADZONE = 3;

// Power-ups (Power-ups On in the lobby; see powerups.js). One is waiting on the map when a
// round starts, and another appears POWER_AGAIN seconds after the last was taken, at one of
// the map's spots. Each lasts until the end of the round; picking up another replaces it.
export const POWER_AGAIN = 7;
// Swift: run speed and acceleration x SWIFT_RUN, dash recovery x SWIFT_DASH_CD.
export const SWIFT_RUN = 1.3, SWIFT_DASH_CD = 0.6;
// Long Blade: the blade's length (normal: BLADE).
export const LONG_BLADE = 106;
// Air Dash: dashes allowed per jump (normally 1), and the dash recovery in the air.
export const AIR_DASHES = 3, AIR_DASH_CD = 0.25;
// Throwing Knife: one throw, flying the way the blade points at KNIFE_V px/s with a little
// gravity, for at most KNIFE_LIFE seconds. It kills on any touch; a blade in its path blocks it.
export const KNIFE_V = 1050, KNIFE_GRAV = 450, KNIFE_LIFE = 1.2;
