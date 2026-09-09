import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../quick-theme-toggle.js', import.meta.url), 'utf8');

assert.doesNotMatch(
  source,
  /import\(['"]\.\/intro-reference-v2\.js/,
  'quick-theme-toggle must not execute intro-reference-v2 a second time'
);

console.log('PASS: theme helper does not duplicate intro setup.');
