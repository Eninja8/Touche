# Touché dev log

## Current state
- **Maps:** Hall, Open Hall (ring-out), Frozen Lake (ice, ring-out), Rooftops (gaps, open ends), Dojo (small, low ceiling, wall pieces), Forge (jump and speed pads). Lobby: Map (a map, Random each round, Random each match) and Hazards (On/Off).
- **Menus:** Main (Play, Settings, corner fullscreen + mute icons) → Play (Online, vs CPU, Local) → a lobby with the match options (remembered per mode) → Start. Online: Host shows a room code and editable options; the joiner sees them read-only; both click Ready (which grabs the mouse); the host presses Start. Keyboard: arrows move, Left/Right change options, Enter picks, Esc goes back.
- **Playable:** online 1v1 with room codes (rollback netcode over PeerJS), local 2-player (Red on mouse + keyboard, Green on keyboard), vs CPU (easy/normal/hard), menu demo bout, settings with key rebinding, sound, ragdoll deaths. Fixed 120 Hz simulation.
- **Live:** https://eninja8.github.io/Touche/ (GitHub Pages, updates on every push to `main`).
- **Code:** split into `src/sim` (deterministic simulation), `src/view` (drawing, effects, sound) and `src/ui` (input, menus). See README.md for the layout.
- **Determinism:** `npm test` passes: same seed gives the same match, and rewind-and-replay matches exactly.
- **Blade rules** (tweak in `src/sim/constants.js`): a swing kills at `LETHAL` = 600 px/s; the point (outer `TIP_ZONE` = 15% of the blade) kills when driven in at `TIP_LETHAL` = 250 px/s; thrusts always kill. Harmless contacts are solid: the body is shoved out (up to `PUSH_MAX` = 24 px per tick) and the holder takes `PUSH_HOLDER` = 25% of the shove. **Beats:** a blade swung at `BEAT_SPEED` = 450 px/s or more into a blade moving at most `BEAT_RATIO` = 0.5 of that is knocked `BEAT_KNOCK` = 1.3 rad wide and harmless for `BEAT_OPEN` = 0.35 s. The beating swing can't kill until it slows below `BEAT_SPEED`; the same player can't beat again for `BEAT_CD` = 0.6 s; a blade swinging back into the beat at `BEAT_MEET` = 200 px/s or more makes it a normal clash.
- **Next:** owner playtests Phase C. Then Phase D (power-ups), stopping after each for a playtest.

## Roadmap
1. Online 1v1 with room codes (built; being playtested).
2. Phase A: menus and UI cleanup (done).
3. Phase B: combat tuning (done).
4. Phase C: maps and hazards (built; being playtested).
5. Phase D: power-ups (Swift, Long Blade, Air Dash, Throwing Knife; Power-ups on/off).
6. Controller support (Gamepad API). Not started.
7. On hold until online has been tested with a friend: Windows EXE (Steam/Electron) with Steam lobbies and invites, and a relay server.

## Session log

### 2026-10-14 — Phase C2: hazards, bigger maps, camera, ropes
- Ring-out removed. Hazards are spiked pits and spike strips (touch = point for the opponent; both = coup double). Hazards Off removes spikes and floors over pits.
- Maps rebuilt from solid blocks (every side wall-jumpable), ~1.7x bigger: Great Hall (new, replaces Hall/Open Hall), Rooftops, Forge, Frozen Lake (ice grip .08), Dojo. Map files in src/sim/maps/, painters in src/view/themes/ with parallax layers, lighting and ambient particles.
- Ropes, chains and ladders (src/sim/rope.js): jump in to grab, up/down climb, jump+direction to leap off, blade works while hanging.
- Follow camera (src/view/camera.js), render-only. Map name big at round start, small bottom-left during the round. Lobby defaults to Random each round.
- CPU: ai-plan.js (tries moves in a copy of the physics), ai-nav.js (per-map route graph), ai-chase.js (chase, escape, bait across pits, spike guard, pin opponents near pits). Hard CPU reaches every surface of every map (test).
- PROTOCOL 8. npm test all passing.
- Not yet checked by eye: rope grab screenshots from the last run.

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

**Part 3, online 1v1** (built in the planned steps; stopped after the two-window test as asked):
- *PeerJS 1.5.5* vendored as `src/vendor/peerjs-1.5.5.min.js` (MIT licence included; checksum matches npm). Loaded only when "Play online" is used. It includes Google STUN and PeerJS's free TURN relays.
- *Rollback core* (`src/net/rollback.js`, `codec.js`): inputs packed as `[bits]` or `[bits, ax, ay]`; 2-tick input delay; up to 12 ticks of prediction (guess = same held keys and aim, no presses); rewind-and-replay on a wrong guess; confirmed-frame tracking; a state fingerprint is compared with the opponent every 60 ticks.
- *No-network test* (`tools/netcode-test.mjs`, part of `npm test`): two simulated players over a fake network (30 ms; 100 ms + jitter + 10% loss + slow frames; 200 ms) must end identical to each other and to a straight run. It found two real bugs:
  1. **Minus zero:** rounding a small negative mouse offset gives −0, which stayed −0 locally but became 0 over the network. `Math.atan2` treats them differently (aiming flat backward came out as fully up vs fully down). Fixed by turning −0 into 0 in `codec.encode` and in the sim.
  2. **Leftover state:** the menu's demo bout ran a different length on each computer, and `newMatch` only reset some fields (the tick counter and clash cooldown carried over). `newMatch` now wipes the whole state, and the test now starts each player from a different history.
- *Online flow* (`src/net/online.js`, `transport.js`):
  - Lobby: Play online → Host (4-letter code with a Copy button) or Join (type the code). The host is Red and the joiner Green; the host picks the seed, match length and map.
  - Both press Fight → ready handshake → the round runs with rollback.
  - A touch is announced (TOUCHÉ callout, lamp, point) only when confirmed by both players' real inputs. The ragdoll shows immediately but is provisional: it's removed if a rollback undoes it, and its blood can't stain the floor until confirmed.
  - After confirmation, each computer rewinds to the confirmed KO tick and plays the KO in slow motion locally with no inputs (identical on both), then both meet with a ready handshake for the next round. A rematch needs both players to agree.
  - Ping shows in the scoreboard; "Waiting for your friend…" appears if the game has to stall. Leaving or closing the page sends a goodbye, otherwise a 5 s timeout ends the match. A version check refuses mismatched builds.
  - Online, Esc shows the menu but the match keeps running. Online players use the Red key layout (plus arrows/Space/Shift) and their own mouse.
- *Fake bad internet:* add `?lag=ms&jitter=ms&loss=percent` to the address.
- *Verified* with two real browser windows through the real PeerJS server: full matches to game over plus a rematch at about 1 ms, 143 ms and 240 ms ping (with 3–5% loss). Scores identical on both sides, zero desyncs, no errors. Closing one window shows "Your friend left the match" on the other within 25 ms. Local CPU and 2-player modes still work.
- *Known limits:* a game in a background tab pauses (browsers stop drawing hidden tabs), so the friend sees "Waiting for your friend…". Test alone with two windows, not two tabs. Keyboard and mouse only reach the focused window.

### 2026-10-14: The point kills; blades are solid
Owner's request: fencers could walk into each other and the point passed through bodies harmlessly.
- *The point:* the outer 15% of the blade now kills when it's driven into the body at 250 px/s or more, measured along the blade (so running onto a point, or running a point into someone, kills; standing still or inching forward doesn't). The full run speed is 270 px/s, so a level blade at a run just counts. The rest of the blade still needs a 600 px/s swing; thrusts are still always lethal. A lethal contact anywhere on the blade wins over a harmless one.
- *Solid blades:* a harmless contact shoves the body sideways out of the blade (away from the holder, unless only the other way clears it) and pushes the holder back by a quarter of the shove; whoever was moving into the blade loses that speed. This also runs on clash ticks, which stops blades staying inside bodies through the clash freeze-frame.
- *Thresholds* (all in `src/sim/constants.js`): `LETHAL = 600`, `TIP_LETHAL = 250`, `TIP_ZONE = 0.15`, `PUSH_MAX = 24` (px per tick), `PUSH_HOLDER = 0.25`.
- *Measured* over 20 CPU-vs-CPU bouts (11 minutes of fighting): ticks with a blade visibly inside a body went from 1,638 to 7 (one 3 px moment during a double-thrust clash). Touches per minute are about the same; about three quarters are now point touches.
- *Tests:* new checks in `npm test`: standing near the point is safe; inching onto it doesn't kill and the point never enters the body; a slow 520 px/s swing down through a body neither kills nor passes through (shoves it 45 px); running onto the point kills (266 px/s). Determinism and all three rollback network tests pass. Browser runs (vs CPU, 2-player) have no errors.
- Online version bumped to 2, so an old cached copy can't play against the new rules.

### 2026-10-14: Phase A, menus and UI cleanup
- *Short labels everywhere:* removed the help sentences under the main menu, settings and controls table. Status lines are brief ("Waiting for opponent…", "Copied", "Opponent left."), and so are connection errors ("No match with that code.").
- *Tagline* options: **"One touch kills."** (in use), "Strike first. Strike once.", "En garde."
- *How to play* is now five short lines.
- *New menu structure:* Main (title, tagline, Play, Settings; fullscreen and mute icons in the top-right corner, menus only) → Play (Online, vs CPU, Local, Back) → lobby. The fullscreen buttons in the other menus are gone (the optional fullscreen key still works everywhere). The scoring box is hidden on menu screens.
- *Lobbies* (`src/ui/lobby.js`): vs CPU has Difficulty, Map, First to; Local and Online have Map and First to. Options are "‹ value ›" selectors (`src/ui/options.js`), remembered per mode in `settings.lobby`. Old saves carry their match length over. Map has one choice (Hall) until Phase C.
- *Online:* Online → Host or Join. The host's lobby shows the room code, a Copy button and the editable options. The joiner sees the host's options read-only and live (new `lobby` message). The host presses Start once someone has joined, and both games start straight away (the old "both press Fight" step is gone). If the joiner's browser refuses to grab the mouse without a click, the pause menu asks them to click Resume. Online version bumped to 3.
- *Settings:* Controls (aim with mouse, aim indicator, sensitivity, keys, fullscreen key), Sound (volume, mute), Display (screen shake, blood), How to play. "First to" moved into the lobbies.
- *Keyboard:* every menu works with arrows (Up/Down move; Left/Right change an option, switch settings tabs or move between buttons), Enter picks, Esc goes back one screen (`src/ui/screens.js`). Typing a room code doesn't trigger game keys (M no longer mutes while typing).
- The current map is now called "Hall".
- *Checked:* `npm test` passes. Headless browser walkthrough of every screen by keyboard and mouse, starting a CPU match and pausing, with no errors. Two-window online test: the joiner saw the host change "First to" live, Start began the match on both, scores matched, the rematch worked, and closing one window showed "Opponent left." within 27 ms.

**Phase A playtest feedback** (owner): menus feel good. Tagline changed to **"En garde."**

**Online Ready button:**
- Both players click **Ready** in the online lobby. That click also grabs the mouse (when mouse aiming is on), so nobody starts a match without it. If the browser refuses, the lobby says "Click Ready again."
- The host's **Start** only lights up when both are ready, and greys out again if either player un-readies: by clicking Ready again, or by losing the mouse (Esc, alt-tab).
- With the mouse grabbed the cursor is hidden, so the host can click anywhere (or press Enter) to start.
- An Esc that just released the mouse no longer also counts as "back" in menus.
- New `rdy` message; online version bumped to 4.
- *Checked:* two-window test: Start stayed grey until both were ready, greyed out when the joiner un-readied, ignored clicks while grey, and the match plus rematch ran with matching scores. Mouse-grab test with real clicks: Ready grabbed the mouse on both windows; releasing it un-readied the joiner and greyed out Start; the host's click anywhere started the match with both mice still grabbed and no pause screen.

### 2026-10-14: Phase B, combat tuning
**CPU vs slides** (`src/sim/ai.js`):
- The CPU now notices an incoming slide (chance by difficulty: easy 30%, normal 75%, hard 92%) after a reaction delay (easy 0.2 s, normal 0.08 s, hard 0.05 s), then picks an answer:
  - **Meet:** point the blade at the incoming point, so the blades clash or the slider runs onto it.
  - **Jump:** jump just before the point arrives (timed from where the slider's point is, not their body).
  - **Back off:** dash away when it's too late for anything else.
- While answering it doesn't start other moves (such as lunging into the slide).
- Measured with a scripted player sliding from random distances (300 slides per difficulty). How often the slide killed the CPU: easy 27% → ~30% (unchanged within noise), normal 24% → 10%, hard 18% → 7%. How often the CPU killed the slider instead: about 20% on Normal and Hard.
- Bug found while tuning: the first "back off" dashed toward the slider.

**Beats** (`src/sim/combat.js`, numbers in `constants.js`):
- When blades meet, neither fencer is thrusting, and one blade is being swung at 450 px/s or more while the other moves at most half that, it's a beat:
  - The slower blade is knocked 1.3 rad wide, the way the attacker was swinging.
  - That blade can't kill and its owner can't thrust for 0.35 s, which is the attacker's opening.
  - The attacker's own blade is harmless for only 0.08 s, so the same swing can't kill straight through.
- Thrusts meeting a blade are still parries, as before.
- *Swing speed* is how fast the blade turns (angle change × reach), not how fast the point moves. Otherwise running, sliding or a pose change (the body dropping into a slide) counted as a "swing". That bug showed up in testing: sliders were beating the CPU's blade aside.
- *Look and sound:* a quick ring burst with pale streaks, a "BEAT" label in the attacker's colour, a short freeze, a sharper "tak-ting" sound, and the beaten blade drawn faded while it's harmless.
- *CPU:* on Normal and Hard it sometimes swings hard through a nearby, still point on purpose (6% / 12% per decision when in reach), and it presses the attack while your blade is beaten aside. Beats also happen naturally whenever a full-speed swing crosses a still blade.
- *Tests* (`npm test`): a fast swing into a still blade is a beat (knocked 1.3 rad wide, harmless 0.35 s, nobody touched); running a still blade into another is a normal clash; a thrust into a still blade is still a parry. All rollback network tests pass. Two-window online test at about 145 ms ping with 3% loss: scores matched and there were no errors. Online version bumped to 5.

**Phase B playtest feedback** (owner): slide defence feels good (the CPU retreating is cool); the 0.35 s opening is fine; beats were overpowered: swinging up and down while walking forward killed the CPU most of the time, even on Hard.

**Beat fixes:**
1. *A beat is not a kill:* after landing a beat, the attacker's swing can't kill until the blade slows below the beat speed (`swingLock`). The follow-up has to be a thrust or the point.
2. *Cooldown:* a second beat by the same player within 0.6 s (`BEAT_CD`) is a normal clash.
3. *Meeting a swing:* if the other blade is swinging back into the beat at 200 px/s or more (`BEAT_MEET`), it's a normal clash.
4. *Swing speed* now measures only the fencer's own aiming. Being knocked by a clash used to register as a "swing" (over 6000 px/s for one tick), so a knocked blade springing back could have beaten someone.
5. *CPU vs wild swinging:* it tracks how much you've been swinging hard lately. Then, scaled by difficulty:
   - It thrusts when your blade is out of line or you're on beat cooldown (punish: easy 20%, normal 50%, hard 60%).
   - Otherwise it backs out of reach (10 / 30 / 30%) or swings back into your blade (5 / 15 / 15%).
- *Measured* (scripted player walking forward whipping the blade at full mouse speed, 200 rounds):
  - Player wins against Hard went from 64% to about 40%. That's the same as simply walking forward with a still point (35–41%), so swinging no longer adds an edge.
  - Normal ~31–45%, Easy ~44%.
  - Slide defence is unchanged: deaths to slides easy 27%, normal 11%, hard 5%.
- *Tests* (`npm test`):
  - After a beat, the swing is locked and beating is on cooldown.
  - A beat followed by a thrust still lands the touch.
  - A second beat within the cooldown is a normal clash.
  - Meeting a swing (300 px/s the other way) is a clash, not a beat.
  - A 950 px/s mouse swing that beats a blade and carries on through the body doesn't kill (it shoves the body 35 px).
  - Swing-spamming forward wins 39% against Hard (must stay under 50%).
- Online version bumped to 6.

**Phase B follow-up feedback** (owner): beats were tuned as above; go ahead with Phase C.

### 2026-10-14: Phase C, maps and hazards
- *Map data* (`src/sim/maps.js`) now describes:
  - floor stretches with gaps (`floors`)
  - what the ends are (`ends`: `walls`, `ringout` or `drop`)
  - a ceiling, free-standing wall pieces (`innerWalls`), pads, floor grip, a backdrop theme, and accent colours
- *Arena collision* moved to `src/sim/terrain.js`:
  - walls or open ends; floors with gaps (inside a gap the building sides are walls, so you can wall-jump back out)
  - platforms, wall pieces, the ceiling, pads
  - `isOut`: past a ring-out line, or 60 px below the floor
- *Maps* (all spawn points are mirror images):
  - **Hall:** unchanged. The long test gives exactly the same score as before the terrain rewrite.
  - **Open Hall:** the Hall with ring-out end lines.
  - **Frozen Lake:** ice (grip 0.2: slow to start, about 5× longer to stop), ring-out ends with open water past them, pines on the shore.
  - **Rooftops:** three roofs with 70 px gaps; the ends drop off the buildings; city skyline (sunset in light mode, night with lit windows in dark mode).
  - **Dojo:** a smaller arena (620 px between walls), a low ceiling (a double jump bonks it), two hanging wall pieces for wall jumps; paper screens, lanterns, tatami.
  - **Forge:** jump pads that launch you to the high platforms (a pad launch always goes full height, even without holding jump), speed pads (a short burst: 1.6× top speed for 0.6 s, with a 430 px/s push); brick walls, a glowing furnace and embers.
- *Ring-out:* going past an end line, or falling into a gap or off a drop, is a touch for the opponent, with an "OUT" label and no blood. Both out at once is a coup double. A blade shove can push someone out on an open map. Ring-out ends have a small flag marker.
- *Hazards On/Off* (lobby, default On; the host's choice applies online): Off turns ring-out and drop ends into walls (drawn as a railing) and puts nets over rooftop gaps. Pads stay on.
- *Map choice:* a specific map, Random each match, or Random each round. Picks come from the match seed, so both computers agree online; each new map differs from the previous one. The map's name shows under the scoring box at the start of each round. The menu's demo bout cycles through the maps.
- *CPU safety* (pushing you out comes in Phase D):
  - doesn't run, dash or slide past an open end, and brakes early on ice
  - jumps rooftop gaps; when falling into a gap it double-jumps or wall-jumps out
  - CPU-vs-CPU falls on Rooftops went from 42 to 7 per ~90 rounds
- *Drawing* (`src/view/backdrops.js`): every map is drawn with code, no images. Effects know about gaps and open ends (bodies fall through gaps; blood still in the air is cleared when the map changes).
- *Tests:*
  - every map, hazards on and off, is deterministic, and rewind-and-replay matches
  - walking past Open Hall's line is a touch; with hazards off it's a wall
  - running into a rooftop gap or off the end is out; with hazards off the net holds
  - ice slides 69 px vs 13 px on the Hall; the jump pad reaches y 193; the speed pad gives 432 px/s
  - random maps: same seed, same maps, never the same map twice in a row
  - a new netcode run with random maps each round and hazards on (100 ms, 5% loss): both players agree
- *Browser checks:* screenshots of every map in light and dark; a vs CPU match on random maps played to game over with no errors; a two-window online match with random maps, 93 ms ping and 2% loss had matching scores and no errors. Online version bumped to 7.
- *Housekeeping:*
  - `src/net/online.js` had grown past the file-size rule (391 lines), so it's now three files: `online.js` (lobby, messages, leaving), `match.js` (match flow, rollback loop, KOs, rematches) and `state.js` (shared state).
  - The map tests moved to `tools/maps-test.mjs` (part of `npm test`).
  - Two-window tests re-run after the split: Ready flow, a match at about 93 ms with 2% loss, rematch, disconnect and the mouse grab all behave the same, with no errors.
- *Mistake fixed:* a local test run started from the project folder put a throwaway browser profile (67 MB, a fresh headless profile used only on localhost) and 14 map screenshots into the Phase C commit, which was pushed. They were removed in the next commit and are now ignored by `.gitignore`. They are still in the git history.
