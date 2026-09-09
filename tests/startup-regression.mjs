import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const themeHelper = readFileSync(new URL('../quick-theme-toggle.js', import.meta.url), 'utf8');

assert.match(
  index,
  /id="reclaim-restore-host"[^>]*\binert\b/,
  'restore snapshot host must be inert so cloned controls cannot receive keyboard focus'
);

assert.match(
  index,
  /setTimeout\(\(\)=>\{[\s\S]*?host\.remove\(\);[\s\S]*?observer\.disconnect\(\);[\s\S]*?\},5000\)/,
  'restore snapshot host must be removed after the fail-safe timeout even if app readiness detection fails'
);

assert.doesNotMatch(
  themeHelper,
  /import\(['"]\.\/intro-reference-v2\.js/,
  'theme helper must not execute the intro mutation observer a second time'
);

console.log('PASS: startup restore and theme-helper regression checks.');
