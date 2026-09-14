import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {sectionHeading,toolArtwork} from '../v2-presentation.js';
test('presentation helpers use shipped decorative assets',()=>{
 for(const html of [sectionHeading('Test'),sectionHeading('Test','ritual-path'),...['walk','timer','water','breathe'].map(toolArtwork)]){
  assert.match(html,/alt="" aria-hidden="true"/);
  const asset=html.match(/src="([^"]+)"/)[1];assert.ok(existsSync(new URL('../'+asset,import.meta.url)));
 }
});
test('visual helpers do not introduce state or event ownership',()=>{
 const source=readFileSync(new URL('../v2-presentation.js',import.meta.url),'utf8');
 assert.doesNotMatch(source,/localStorage|sessionStorage|addEventListener|setInterval|window\.|document\.|fetch\(/);
 const css=readFileSync(new URL('../reclaim-v2.css',import.meta.url),'utf8');
 assert.doesNotMatch(css,/circle-mark\{display:none/);
});
