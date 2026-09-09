import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const themeHelper = await readFile(new URL('../quick-theme-toggle.js', import.meta.url), 'utf8');
const indexHtml = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const manualCheckin = await readFile(new URL('../manual-checkin.js', import.meta.url), 'utf8');

test('theme helper does not execute the intro bootstrap a second time', () => {
  assert.doesNotMatch(themeHelper, /import\s*\(\s*['"]\.\/intro-reference-v2\.js/);
});

test('ui polish is not loaded both as a classic script and an imported module', () => {
  assert.match(manualCheckin, /import\s+['"]\.\/ui-polish\.js['"]/);
  assert.doesNotMatch(indexHtml, /<script[^>]+src=["']ui-polish\.js/);
});

test('unused page snapshot writer is not loaded at runtime', () => {
  assert.doesNotMatch(indexHtml, /<script[^>]+src=["']skeleton-snapshot\.js/);
});
