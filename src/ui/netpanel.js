// The network stats overlay, toggled with N: ping, jitter, packet loss, rollback frames
// per second, stalls, input delay and a small ping graph (last 20 seconds). Reads the
// measurements in net/netstats.js; offline it just says so.

import {ns} from '../net/netstats.js';
import {settings, saveSettings} from './settings.js';

const $ = id => document.getElementById(id);
const box = $('netStats'), text = $('netStatsText'), graph = $('netGraph'), g = graph.getContext('2d');
let online = () => false, lastDraw = 0;

// isOnline: () => true while an online match or lobby is connected.
export function initNetPanel(isOnline) { online = isOnline; box.hidden = !settings.netStats; }

export function toggleNetStats() { settings.netStats = !settings.netStats; saveSettings(); box.hidden = !settings.netStats; lastDraw = 0; }

const ms = v => `${Math.round(v)} ms`;
// Colour hints: fine, worth a look, bad.
const grade = (v, ok, bad) => v <= ok ? '' : v <= bad ? 'warn' : 'bad';

// Called every screen frame; redraws four times a second.
export function updateNetPanel(now) {
  if (box.hidden || now - lastDraw < 250) return;
  lastDraw = now;
  if (!online()) { text.innerHTML = '<b>Network</b><br>Not in an online match'; g.clearRect(0, 0, graph.width, graph.height); return; }
  const rows = [
    ['Ping', ms(ns.ping), grade(ns.ping, 90, 160)],
    ['Jitter', ms(ns.jitter), grade(ns.jitter, 8, 20)],
    ['Loss', `${Math.round(ns.loss * 100)}%`, grade(ns.loss, .02, .08)],
    ['Rollback', `${ns.rbPerSec} f/s · max ${ns.rbLongest}`, grade(ns.rbLongest, 6, 10)],
    ['Stalls', `${ns.stallsPerSec} /s`, grade(ns.stallsPerSec, 0, 5)],
    ['Delay', `${ns.delay} ticks · ahead ${ns.advantage.toFixed(1)}`, ''],
  ];
  text.innerHTML = '<b>Network</b>' + rows.map(([k, v, c]) => `<br><span class="k">${k}</span> <span class="${c}">${v}</span>`).join('');
  drawGraph();
}

// Ping over time: a line, scaled to the highest recent ping (at least 100 ms), with the
// scale written in the corner.
function drawGraph() {
  const w = graph.width, h = graph.height, p = ns.pings, css = getComputedStyle(box);
  g.clearRect(0, 0, w, h);
  if (p.length < 2) return;
  const top = Math.max(100, Math.ceil(Math.max(...p) / 50) * 50);
  g.strokeStyle = css.getPropertyValue('--line'); g.lineWidth = 1;
  g.beginPath(); g.moveTo(0, h - .5); g.lineTo(w, h - .5); g.stroke();
  g.strokeStyle = css.color; g.lineWidth = 1.5; g.beginPath();
  p.forEach((v, k) => { const x = w - (p.length - 1 - k) * (w / 79), y = h - 2 - (v / top) * (h - 6); k ? g.lineTo(x, y) : g.moveTo(x, y); });
  g.stroke();
  g.fillStyle = css.color; g.font = '10px ' + css.fontFamily; g.fillText(`${top} ms`, 2, 10);
}
