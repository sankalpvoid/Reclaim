import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {todayHero,todayNextStep} from '../today-screen.js';
const icon=name=>`<span aria-hidden="true">${name}</span>`;
test('Today prioritizes craving support using the existing view action',()=>{
 const html=todayHero(icon);
 assert.match(html,/One small/);assert.match(html,/data-view="craving"/);
 assert.doesNotMatch(html,/data-log-cigarette|data-activity|localStorage|sessionStorage/);
 assert.match(html,/assets\/living-petal.webp/);
});
test('next step reuses current walking tool and accurately states five minutes',()=>{
 const html=todayNextStep(icon);
 assert.match(html,/data-tool="walk"/);assert.match(html,/5-minute/);
 assert.match(html,/assets\/activity-stretch.webp/);
 assert.doesNotMatch(html,/data-view="(?:activities|ritual|progress)"/);
});
test('new Today module has no lifecycle, router, storage, timers or global listeners',()=>{
 const source=readFileSync(new URL('../today-screen.js',import.meta.url),'utf8');
 assert.doesNotMatch(source,/localStorage|sessionStorage|addEventListener|setInterval|createLivingUI|window\.|document\./);
});
test('app only imports Today presentation, retaining current routing and tracking module',()=>{
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(app,/from '\.\/today-screen.js'/);
 assert.match(app,/function trackingHome\(\)\{return smokingJourney.home\(\)\}/);
 assert.doesNotMatch(app+index,/living-ui\.(js|css)|living-activities.js|createLivingUI/);
 assert.doesNotMatch(app,/function (activities|ritual|progress|legacyhome)\(/);
});
