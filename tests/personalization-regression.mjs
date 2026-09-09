import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../name-personalization.js', import.meta.url), 'utf8');

test('personalized names are never interpolated into innerHTML', () => {
  assert.doesNotMatch(source, /innerHTML\s*=\s*`[^`]*\$\{\s*name/i);
  assert.match(source, /replaceWithLines\(/);
  assert.match(source, /createTextNode/);
});
