# Touché

1v1 stick-figure fencing where one touch kills. Plain JavaScript and HTML5 canvas, no libraries.

**Play online:** https://eninja8.github.io/Touche/

## Play locally

You need [Node.js](https://nodejs.org) installed. In a terminal, from this folder:

```
npm start
```

Then open http://localhost:8080 in your browser. Press Ctrl+C in the terminal to stop the server.

(Double-clicking `index.html` won't work. The game uses JavaScript modules, which browsers only load from a web server.)

## Play online

Click **Play online**, then **Host a match** and send the 4-letter code to a friend. They click **Play online**, then **Join a match**, and type it in. To try it alone, open the game in **two separate browser windows** side by side (not two tabs: browsers pause games in background tabs). Add `?lag=100&jitter=20&loss=5` to the address to fake a bad connection.

## Test

```
npm test
```

This checks that the simulation is deterministic (the same inputs always produce exactly the same game), then runs two simulated online players through a fake bad network and checks their games stay identical.

## Folder layout

| Path | What it is |
|---|---|
| `index.html` | The page: scoring box, canvas, menus |
| `src/styles.css` | All styling (light and dark mode) |
| `src/main.js` | Starts everything and runs the main loop |
| `src/sim/` | **The simulation**: rules, physics, combat, CPU. Pure and deterministic |
| `src/view/` | Drawing, sound and cosmetic effects (particles, ragdolls, blood) |
| `src/ui/` | Keyboard/mouse input, pointer lock, menus, settings |
| `src/net/` | Online play: rollback netcode, PeerJS connection, lobby and match flow |
| `src/vendor/` | PeerJS 1.5.5 (MIT licence), the only outside library |
| `tools/` | Local server and the determinism test |
