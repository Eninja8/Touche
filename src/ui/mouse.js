// Mouse aiming: pointer lock plus our own crosshair.
//
// While the game has the mouse "locked", the browser hides the cursor and reports
// only how far the mouse moved. Two aim styles use those movements (Settings →
// Controls → Aim style):
//  - Arrow / Off: a crosshair that lives at an offset from the fencer's shoulder (so
//    it travels with them), kept within AIM_REACH pixels. Arrow draws a faint chevron.
//  - Free cursor: a pointer that moves anywhere on the screen like a normal mouse and
//    stops at the screen's edges. It stays put on screen when the camera moves.
// Either way, each tick aimOffset() gives the simulation the same kind of number: the
// direction from the shoulder to the crosshair (an offset in arena pixels). Online,
// that offset is what gets sent, never a screen position, so both computers simulate
// exactly the same aim whatever their screens show.

import {AIM_REACH} from '../sim/constants.js';
import {settings} from './settings.js';
import {cam} from '../view/camera.js';

const cv = document.getElementById('cv');

// Arrow / Off: the crosshair offset from the shoulder, in arena pixels. Starts in front, blade-height.
export const cross = {x: 98, y: -18};
// Free cursor: where the pointer is on the canvas, in CSS pixels from its top-left corner.
export const screen = {x: 0, y: 0};
let pendingPlace = null; // free cursor: put it in front of this fencer once the camera is ready

export const freeAim = () => settings.aimStyle === 'free';

// A new round: the crosshair goes back in front of the fencer.
export function resetCross(face, p) { cross.x = 98 * face; cross.y = -18; pendingPlace = {face, p}; }

// Canvas CSS pixels ↔ arena pixels, through the follow camera.
const dpr = () => cv.width / (cv.clientWidth || cv.width);
const toWorld = (sx, sy) => ({x: cam.x + (sx * dpr() - cv.width / 2) / cam.s, y: cam.y + (sy * dpr() - cv.height / 2) / cam.s});
const toScreen = (wx, wy) => ({x: ((wx - cam.x) * cam.s + cv.width / 2) / dpr(), y: ((wy - cam.y) * cam.s + cv.height / 2) / dpr()});

// Called each screen frame after drawing (so the camera has framed the new round):
// places the free cursor in front of the fencer at the start of a round.
export function placeFreeCursor(S) {
  if (!pendingPlace || !cam.ready) return;
  const f = S.F[pendingPlace.p]; pendingPlace = null;
  if (!f || !f.P) return;
  const at = toScreen(f.P.sh.x + 98 * f.face, f.P.sh.y - 18);
  screen.x = Math.max(0, Math.min(cv.clientWidth, at.x)); screen.y = Math.max(0, Math.min(cv.clientHeight, at.y));
}

// The aim for player p this tick: the offset from their shoulder to the crosshair.
// Free cursor: the direction to the pointer, stretched or shrunk to AIM_REACH so the
// whole-pixel rounding loses as little precision as possible.
export function aimOffset(S, p) {
  if (!freeAim()) return {x: cross.x, y: cross.y};
  const f = S.F[p];
  if (!f || !f.P) return {x: cross.x, y: cross.y};
  const w = toWorld(screen.x, screen.y), dx = w.x - f.P.sh.x, dy = w.y - f.P.sh.y, d = Math.hypot(dx, dy);
  if (d >= 1) { cross.x = dx / d * AIM_REACH; cross.y = dy / d * AIM_REACH; } // (on the shoulder itself: keep the last aim)
  return {x: cross.x, y: cross.y};
}

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

// Sensitivity 1 = 0.3 arena pixels (Arrow / Off) or 1 screen pixel (Free cursor) per unit of mouse movement.
document.addEventListener('mousemove', e => {
  if (!isLocked()) return;
  if (freeAim()) {
    const k = settings.sens;
    screen.x = Math.max(0, Math.min(cv.clientWidth, screen.x + e.movementX * k));
    screen.y = Math.max(0, Math.min(cv.clientHeight, screen.y + e.movementY * k));
    return;
  }
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
