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

## Test

```
npm test
```

This checks that the simulation is deterministic: the same inputs always produce exactly the same game. Online play depends on that.

## Folder layout

| Path | What it is |
|---|---|
| `index.html` | The page: scoring box, canvas, menus |
| `src/styles.css` | All styling (light and dark mode) |
| `src/main.js` | Starts everything and runs the main loop |
| `src/sim/` | **The simulation**: rules, physics, combat, CPU. Pure and deterministic |
| `src/view/` | Drawing, sound and cosmetic effects (particles, ragdolls, blood) |
| `src/ui/` | Keyboard/mouse input, menus, settings |
| `tools/` | Local server and the determinism test |
