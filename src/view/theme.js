// Colours for the canvas, read from the CSS variables in styles.css so the
// game follows light/dark mode automatically.

export const C = {};

function readTheme() {
  const s = getComputedStyle(document.documentElement);
  for (const k of ['hall', 'hall-2', 'ink', 'muted', 'line', 'red', 'green', 'steel', 'spark', 'blood', 'piste', 'piste-edge']) C[k] = s.getPropertyValue('--' + k).trim();
}
readTheme();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', readTheme);
new MutationObserver(readTheme).observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']});

// Is the page in dark mode? (an explicit data-theme wins over the system setting)
export function isDark() {
  const t = document.documentElement.dataset.theme;
  return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
}
