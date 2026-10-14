# Touché dev log

## Current state
- **Playable:** local 2-player (one keyboard), vs CPU (easy/normal/hard), menu demo bout, settings with key rebinding, sound, ragdoll deaths. Fixed 120 Hz simulation.
- **Live:** https://eninja8.github.io/Touche/ (GitHub Pages, updates on every push to `main`).
- **Code:** split into `src/sim` (deterministic simulation), `src/view` (drawing, effects, sound) and `src/ui` (input, menus). See README.md for the layout.
- **Determinism:** `npm test` passes: same seed gives the same match, and rewind-and-replay matches exactly.
- **Next:** Part 3, online 1v1 with room codes (PeerJS + rollback). Plan: `docs/ONLINE-PLAN.md`.

## Roadmap
1. Online 1v1 with room codes (in progress).
2. More maps (the arena is already map data in `src/sim/maps.js`).
3. Controller support (Gamepad API).
4. Windows EXE on Steam with Steam lobbies and friend invites.

## Session log

### 2026-10-14: Phase 1 (setup, restructure, deploy)
- Checked tools: Node.js v20.11.1 (past end-of-life; upgraded in the next session), npm 10.2.4, git 2.44.
- Created the git repo with `.gitignore`/`.gitattributes`, committed the original single-file game as-is, pushed to github.com/Eninja8/Touche. Switched this repo to Git Credential Manager for sign-in.
- Split `index.html` into modules without changing gameplay:
  - Simulation is a plain state object `S` plus `step(S, commands)`. No DOM, clocks or `Math.random` inside `src/sim`.
  - **Determinism fixes:**
    - CPU decisions and round-start timers used `Math.random`; they now use a seeded generator (`src/sim/rng.js`) whose state lives in `S.rng`.
    - The mouse position was read straight from a global inside the fighter update; it now arrives as part of the per-tick command (`aim`).
    - Key presses were written into fighter buffers directly from keyboard events (between ticks); they're now queued and applied at the start of the next tick.
    - Countdown and KO timers ran on real (wall-clock) time; they now count ticks. KO pause = 180 ticks, which with slow motion still takes about 1.9 real seconds, as before.
    - The clash freeze-frame (hitstop) paused the loop by real time; it's now 6 frozen ticks inside the sim.
    - Blood/sparks choice, particles, ragdolls and screen shake were inside the sim; they're now cosmetic, driven by events (`src/sim/events.js`).
  - KO slow motion stays as a "feed ticks slower" effect in `main.js`; flagged for online play in the Phase 2 plan.
  - Added `body{margin:0}` and a proper HTML document head (the old file had no `<!doctype>`).
- Added `npm start` (zero-dependency local server, `tools/serve.mjs`) and `npm test` (`tools/determinism-test.mjs`).
- Verified in headless Chrome: no console errors; ~5.5 minutes of fast-forwarded CPU-vs-CPU bouts (86 touches) without errors; a full CPU match reaches the game-over screen (0–5).
- Enabled GitHub Pages (main branch, root). Live site checked.
- Wrote CLAUDE.md and the Phase 2 online plan.

### 2026-10-14: Phase 2 kickoff
Owner approved the online plan and PeerJS with its free public server.

**Part 1, Node upgrade:** installed Node.js v24.20.0 LTS with winget (was v20.11.1, end-of-life). `npm test` passes on Node 24. `package.json` now states `"engines": {"node": ">=24"}`.

**Part 2, mouse aiming, pointer lock, fullscreen:**
- *World-space mouse aim (sim):* the command's `aim` is now the crosshair's offset from the shoulder, rounded to whole pixels (−160…160) inside the sim. Mouse players face whichever side the crosshair is on (3 px dead zone straight up/down). Turning mirrors the blade angle (`π − angle`), so the blade keeps its world direction instead of snapping. It then turns toward the crosshair at the old capped speed (9.5 rad/s); the allowed range for mouse players goes past vertical, so a swing across the body goes over the top. The few-pixel shoulder shift from turning is removed from the blade-speed measurement. Keyboard players and the CPU are unchanged (auto-face, raise/lower).
- *Pointer lock + crosshair (`src/ui/mouse.js`):* clicking into the game (or starting a match) locks the mouse, requesting raw (unaccelerated) input when the browser supports it. Mouse movement moves a crosshair at an offset from the shoulder, clamped to a 160 px reach ring. Losing the lock (Esc, alt-tab, clicking away) pauses the game; Resume re-grabs the mouse, and the game continues only once the lock is confirmed. Safety net: if the mouse should be locked but isn't for 0.4 s, the game pauses.
- *Settings:* "Aim with mouse" (Red uses mouse / Off), mouse sensitivity (0.2–4.0), and a fullscreen key (unbound by default).
- *Full window:* the game fills the browser window, with the scoring box floating over the top. The arena stays 960×540 and is scaled to fit; extra space is painted as more hall, with the area past the side walls slightly dimmed. Fullscreen button in the menu, pause screen and settings.
- Tests: new checks that turning keeps the blade's world direction (it moved 0.079 rad on the turn tick, one normal tick of rotation) and that a swing over the top is lethal (950 px/s vs 600 needed). Headless-browser probes: mouse-aimed CPU match plays to the end with no errors; crosshair draws; a refused lock pauses the game with the right hint; wide and tall windows have no black bars.

**Playtest feedback on Part 2** (owner): turning feels good; the blade is a little slow coming around after a turn, but keep it (getting behind your opponent should be an advantage). Reach distance is good, but the crosshair and circle were cluttered. Owner plays at sensitivity 1.5; default stays 1.0. Pausing, fullscreen and resizing all work. Local 2P on one keyboard is cramped, so controller support goes on the roadmap.

**Part 2 follow-ups:**
- Replaced the crosshair and reach circle with a faint, wide chevron just past blade reach, pointing where the mouse aims. Same aiming system and controls. New setting "Aim indicator: Arrow / Off".
- Removed the floor text and tick marks.
- The arena is now map data (`src/sim/maps.js`): size, floor, walls, platforms, spawn points, light/dark colours. The match stores the map name in `S.map`; sim, effects and renderer all read the map. Only the current map ("Fencing hall") exists. Gameplay unchanged: the long determinism test gives exactly the same score as before the change.
