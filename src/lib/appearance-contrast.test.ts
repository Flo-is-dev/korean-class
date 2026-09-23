import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

function luminance(hex: string) {
  const components = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255);
  return components.reduce((sum, value, index) => sum + (value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4) * [.2126, .7152, .0722][index], 0);
}
function contrast(a: string, b: string) {
  const [low, high] = [luminance(a), luminance(b)].sort((x, y) => x - y);
  return (high + .05) / (low + .05);
}
const css = readFileSync('src/styles.css', 'utf8');
for (const [mode, selector] of [['light', ':root {'], ['dark', ':root[data-theme="dark"] {']]) {
  it(`${mode} theme satisfies AA for text pairs, control borders and focus`, () => {
    const block = css.split(selector)[1].split('}')[0];
    const colors = Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[\da-fA-F]{6});/g)].map(match => [match[1], match[2]]));
    const textPairs = [
      ['ink', 'bg'], ['ink', 'surface'], ['ink', 'selected'], ['ink', 'warning-bg'],
      ['muted', 'bg'], ['muted', 'surface'], ['muted', 'hero'], ['muted', 'selected'], ['muted', 'subtle'], ['muted', 'warning-bg'],
      ['accent', 'selected'], ['accent', 'surface'], ['accent', 'hero'], ['accent', 'brand-bg'],
      ['accent-ink', 'primary'], ['good', 'good-soft'], ['bad', 'bad-soft'], ['warning-ink', 'warning-bg'],
    ];
    for (const [foreground, background] of textPairs) expect(contrast(colors[foreground], colors[background]), `${foreground} on ${background}`).toBeGreaterThanOrEqual(4.5);
    for (const [foreground, background] of [['control-border', 'surface'], ['focus', 'bg'], ['selected-border', 'selected']]) expect(contrast(colors[foreground], colors[background])).toBeGreaterThanOrEqual(3);
  });
}
