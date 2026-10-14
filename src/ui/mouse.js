// Mouse aiming: pointer lock plus a virtual crosshair.
//
// While the game has the mouse "locked", the browser hides the cursor and
// reports only how far the mouse moved. We add those movements to a crosshair
// that lives at an offset from the fencer's shoulder (so it travels with them),
// clamped to a circle of AIM_REACH pixels. Each tick, that offset is sent to the
// simulation as the `aim` part of the command.

import {AIM_REACH} from '../sim/constants.js';
import {settings} from './settings.js';

const cv = document.getElementById('cv');

// The crosshair offset from the shoulder, in arena pixels. Starts in front, blade-height.
export const cross = {x: 98, y: -18};
export function resetCross(face) { cross.x = 98 * face; cross.y = -18; }

export const isLocked = () => document.pointerLockElement === cv;

// Ask for the lock. Must be called from a click or key press (browser rule).
// Tries "raw" mouse input first (no Windows pointer acceleration) and falls
// back to normal if the browser doesn't support it. The returned promise
// rejects if the browser refuses (for example, right after Esc it waits ~1 s).
export function requestLock() {
  if (isLocked()) return Promise.resolve();
  const plain = () => Promise.resolve(cv.requestPointerLock());
  try { return Promise.resolve(cv.requestPointerLock({unadjustedMovement: true})).catch(e => e && e.name === 'NotSupportedError' ? plain() : Promise.reject(e)); }
  catch (e) { return plain(); }
}
export function releaseLock() { if (isLocked()) document.exitPointerLock(); }

// Sensitivity 1 = 0.3 arena pixels per unit of mouse movement.
document.addEventListener('mousemove', e => {
  if (!isLocked()) return;
  const k = .3 * settings.sens;
  cross.x += e.movementX * k; cross.y += e.movementY * k;
  const d = Math.hypot(cross.x, cross.y);
  if (d > AIM_REACH) { cross.x *= AIM_REACH / d; cross.y *= AIM_REACH / d; }
});

// When the lock is lost by pressing Esc, the browser may also deliver that Esc
// key to the page. lostRecently() lets the keyboard code ignore it.
let lostAt = -1e9;
const lockListeners = [];
export const onLockChange = fn => lockListeners.push(fn);
export const lostRecently = () => performance.now() - lostAt < 300;
document.addEventListener('pointerlockchange', () => {
  const locked = isLocked();
  if (!locked) lostAt = performance.now();
  for (const fn of lockListeners) fn(locked);
});
