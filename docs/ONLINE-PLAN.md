# Plan: online 1v1 with room codes (Phase 2)

Status: **built** (October 2026), with the owner's additions: the KO slow motion is played locally as a replay after the touch is confirmed, then both players meet with a ready handshake; nothing that a rollback could undo is announced. See DEVLOG.md for details.

## The big picture
- **Connection:** peer-to-peer WebRTC through **PeerJS**. One player clicks *Host* and gets a short room code (like `KX7Q`); the friend types it in. PeerJS's free public server only introduces the two browsers; after that, game data goes directly between them.
- **Netcode:** *rollback* with a small *input delay*. Each machine runs the full game itself. The only thing sent is each player's command for each tick (a few bytes).
- **Already done in Phase 1:** the simulation is deterministic, input arrives only as per-tick commands, and the whole game can be saved and restored with `snapshot(S)`. Those are the three things rollback needs.

## Input delay vs rollback, in plain language
- **Input delay:** your key press is scheduled a few ticks into the future, giving it time to reach your friend. Simple and never wrong, but the game feels sluggish if the delay is large.
- **Rollback:** the game doesn't wait. It *guesses* your friend is still pressing what they pressed last time and carries on. When their real input arrives and the guess was wrong, it rewinds to that tick, re-plays the few ticks since with the correct input (invisibly, in about a millisecond), and shows the corrected result. Usually you see nothing. On a wrong guess you might see the opponent "snap" slightly.
- **Plan: use both.** Input delay of **2 ticks** (17 ms, nobody notices) covers most of a nearby connection. Rollback covers the rest, up to about **12 ticks (100 ms)**. The setting will be adjustable while testing.

## What happens on lag spikes
- **Small spike** (under ~100 ms): rollback hides it; maybe a small visual snap.
- **Bigger spike:** the game freezes briefly instead of guessing too far ahead and showing nonsense. A small "waiting for opponent…" note appears if it lasts more than half a second.
- **One computer running ahead** (a common, slow drift): the side that is ahead slows down very slightly for a moment so both stay in step.
- **Connection lost** for about 5 seconds: "Opponent disconnected", then back to the menu.
- **Lost packets:** each message also repeats the last several inputs, so a dropped packet is filled in by the next one.

## Safety net: desync detection
About twice a second, both games compare a short "fingerprint" (checksum) of the game state. If they ever differ, we have a determinism bug. The game reports it (and logs the tick) instead of silently playing two different matches.

## Changes needed to the game
1. **Network command format:** pack held keys and presses into one small number; round mouse aim to whole pixels. (Rounding must happen *before* the local sim uses it, so both sides see the same value.)
2. **Rollback driver** (`src/net/rollback.js`): keeps the last ~12 ticks of saved states and inputs, predicts, rewinds and re-simulates. Sounds and effects from re-simulated ticks are discarded, so a clash doesn't play twice.
3. **Online match flow:** the host picks the seed and match length and sends them; both start on the same tick. No pause online. "Rematch" needs both players to agree.
4. **KO slow motion:** it currently changes how fast ticks run, which two machines can't do independently. Online, the game runs at normal speed through the KO (or we fake slow-mo visually only). Local play keeps it as it is.
5. **Controls:** online, each player uses the *Red* key layout (or mouse) on their own keyboard.

## Testing it alone on one PC
1. **Sync test, no network** (added to `npm test`): every tick, rewind a few ticks and replay, then check the result is identical. This catches most rollback bugs before a network is involved.
2. **Two browser tabs:** host in one tab, join in the other, same PC. PeerJS works fine like this.
3. **Fake bad internet:** a debug panel (open with `?debug=1`) that adds artificial delay, jitter and packet loss, so we can see how 150 ms or 5% loss feels without needing a bad connection.
4. **Chrome in one window, Edge or Firefox in the other:** checks that different browsers do the maths identically (see risks).
5. **Finally, a real test** with a friend, or your phone's hotspot on a laptop, to try real home-router conditions.

## Risks and decisions for the owner
- **Dependency:** PeerJS (a library, about 100 KB) plus its free public matchmaking server. Needs your OK. The free server has no uptime guarantee; we can run our own later.
- **Strict networks:** about 10–15% of connections (some school and work networks, some mobile carriers) can't connect directly and need a relay ("TURN") server. Good free relays are rare, so we start without one and add it if friends can't connect.
- **Browser maths differences:** Chrome, Edge and Firefox might compute `Math.sin` and similar functions very slightly differently. Chrome-vs-Edge should be identical (same engine). If the desync check catches a difference with Firefox, we swap in our own versions of those few functions.
- **Steam later:** the rollback layer will talk to a small "transport" interface, so swapping PeerJS for Steam networking in Phase 3 changes one file, not the netcode.

## Order of work (each step playable and committed)
1. Sync-test mode and the command packing (no network yet).
2. Rollback driver, tested with a fake "network" inside one page (two simulated players with artificial delay).
3. PeerJS rooms: host/join screen with room codes.
4. Lag handling, disconnect handling, desync check.
5. Polish: connection-quality indicator, rematch flow, then deploy.
