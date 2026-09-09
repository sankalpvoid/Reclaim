import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const themeHelper = await readFile(new URL('../quick-theme-toggle.js', import.meta.url), 'utf8');

test('theme helper does not execute the intro bootstrap a second time', () => {
  assert.doesNotMatch(themeHelper, /import\s*\(\s*['"]\.\/intro-reference-v2\.js/);
});
