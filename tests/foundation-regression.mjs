import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  normalizeBehaviorEvents,
  deriveSmokingEvents,
  deriveCravings,
  fromDatabaseRows
} from '../behavior-model.js';

const ROOT=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,ROOT),'utf8');

test('behavior model merges legacy and canonical events without duplicates',()=>{
  const at='2026-09-03T12:00:00.000Z';
  const state={
    smokingEvents:[{at,cigarettes:1}],
    cravings:[{at:'2026-09-03T12:05:00.000Z',resisted:true,tool:'breathe',feedback:'yes'}]
  };
  const canonical=[{type:'smoked',at,cigarettes:1}];
  const events=normalizeBehaviorEvents(canonical,state);
  assert.equal(events.length,2);
  assert.equal(deriveSmokingEvents(events).length,1);
  assert.equal(deriveCravings(events).length,1);
});

test('database smoking_events map into the canonical browser model',()=>{
  const rows=[
    {id:'smoke-1',event_type:'smoked',smoked_at:'2026-09-03T10:00:00Z',cigarettes:2},
    {id:'crave-1',event_type:'craving',smoked_at:'2026-09-03T11:00:00Z',cigarettes:0,resisted:true,toolkit:'walk',tool_feedback:'a_little'}
  ];
  const events=fromDatabaseRows(rows);
  assert.deepEqual(events.map(event=>event.type),['smoked','craving']);
  assert.equal(deriveSmokingEvents(events)[0].cigarettes,2);
  assert.equal(deriveCravings(events)[0].tool,'walk');
  assert.equal(deriveCravings(events)[0].feedback,'a_little');
});

test('runtime no longer loads retired lifecycle compatibility modules',async()=>{
  const index=await read('index.html');
  assert.equal(index.includes('session-bootstrap.js'),false);
  assert.equal(index.includes('login-resume.js'),false);
  assert.equal(index.includes('auth-lifecycle.js'),true);
});

test('canonical profile bootstrap uses quit_date only',async()=>{
  const bootstrap=await read('cloud-bootstrap.js');
  assert.equal(bootstrap.includes('quit_at'),false);
  assert.equal(bootstrap.includes('row.quit_date'),true);
});

test('cloud bootstrap hydrates smoking and craving history through one smoking_events request',async()=>{
  const bootstrap=await read('cloud-bootstrap.js');
  const requests=bootstrap.match(/\/rest\/v1\/smoking_events/g)||[];
  assert.equal(requests.length,1);
  assert.equal(bootstrap.includes('event_type=eq.craving'),false);
  assert.equal(bootstrap.includes('event_type=eq.smoked'),false);
});

test('manual mood transition blocks Home snapshot recapture before route change',async()=>{
  const manual=await read('manual-checkin.js');
  assert.equal(manual.includes("SNAPSHOT_KEY='reclaim-page-skeleton-v1'"),true);
  assert.equal(manual.includes("classList.add('reclaim-snapshot-host')"),true);
  assert.equal(manual.includes('localStorage.removeItem(SNAPSHOT_KEY)'),true);
  assert.equal(manual.includes("stage:'mood'"),true);
});

test('UI polish keeps small plan values compact and removes infrastructure status',async()=>{
  const [script,styles]=await Promise.all([read('ui-polish.js'),read('ui-polish.css')]);
  assert.equal(script.includes('connected\\s+to\\s+supabase'),true);
  assert.equal(script.includes("classList.add('ui-compact-field')"),true);
  assert.equal(styles.includes('.ui-appearance-card'),true);
  assert.equal(styles.includes('.hero-runner .runner-art'),true);
});


test('distinct smoking records at the same instant retain both identities',()=>{
  const at='2026-09-03T12:00:00.000Z';
  const events=normalizeBehaviorEvents([{type:'smoked',at,cigarettes:1,cloudId:'a'},{type:'smoked',at,cigarettes:1,cloudId:'b'}]);
  assert.equal(events.length,2);
});
