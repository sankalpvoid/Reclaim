import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const key='reclaim-state-v2';
const user={id:'11111111-1111-4111-8111-111111111111'};
const today=new Date();const day=(offset=0)=>{const d=new Date();d.setDate(d.getDate()+offset);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const profile={name:'Flow Test',journeyMode:'reduce',cigarettesPerDay:20,dailyTarget:18,quitAt:new Date(Date.now()-864000000).toISOString(),pricePerPack:300,cigarettesPerPack:20,country:'IN'};
const dbProfile=mode=>({id:user.id,display_name:'Flow Test',journey_mode:mode,daily_target:18,quit_date:profile.quitAt,cigarettes_per_day:20,price_per_pack:300,cigarettes_per_pack:20,country:'IN',onboarding_completed:true});
let errors=[];
async function open(mode='reduce',extra={}){
 const context=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Kolkata'}),page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));
 const rows=new Map();let offline=false;
 await context.route('https://**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(!url.pathname.startsWith('/rest/v1/')&&!url.pathname.startsWith('/auth/v1/'))return route.continue();
  let data=[];
  if(url.pathname==='/auth/v1/user')data=user;
  else if(url.pathname.includes('/profiles'))data=[dbProfile(mode)];
  else if(url.pathname.includes('/daily_checkins'))data=[{client_id:'c',created_at:new Date().toISOString(),mood:'okay'}];
  else if(url.pathname.includes('/smoking_events')){
    if(offline)return route.abort();
    if(req.method()==='POST'){const row=req.postDataJSON();rows.set(row.id,row);data=[row];}
    else if(req.method()==='DELETE'){rows.delete(url.searchParams.get('id')?.slice(3));}
    else data=[...rows.values()];
  }
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
 await context.addInitScript(({key,user,profile,mode,extra})=>{
  if(localStorage.getItem('test-seeded'))return;
  localStorage.setItem('test-seeded','yes');
  localStorage.setItem(key,JSON.stringify({stage:'app',view:'home',profile:{...profile,journeyMode:mode},smokingEvents:[],...extra}));
  localStorage.setItem('reclaim-session-v1',JSON.stringify({access_token:'test-token',user}));
  localStorage.setItem('reclaim-lifecycle-v1',JSON.stringify({userId:user.id,lastActiveAt:Date.now()}));
 },{key,user,profile,mode,extra});
 await page.goto(process.env.TEST_URL||'http://127.0.0.1:4173');
 await page.locator(mode==='quit'?'.home-screen':'.sj-screen').waitFor();
 return {context,page,rows,setOffline:v=>offline=v};
}
try{
 const x=await open();const {page,rows}=x;
 await page.locator('[data-log-cigarette]').click();
 await page.waitForFunction(key=>Object.keys(JSON.parse(localStorage.getItem(key)).smokingMutations||{}).length===0,key);
 assert.equal(rows.size,1);
 await page.locator(`[data-smoking-day="${day()}"]`).first().click();
 await page.locator('[data-smoking-edit]').click();
 await page.locator('[name=count]').fill('3');
 await page.locator('#smoking-log-form .primary').click();
 await page.waitForFunction(key=>Object.keys(JSON.parse(localStorage.getItem(key)).smokingMutations||{}).length===0,key);
 assert.equal(rows.size,1);assert.equal([...rows.values()][0].cigarettes,3);
 await page.reload();await page.locator('.sj-screen').waitFor();
 assert.equal(await page.locator('.tracking-intro h1').innerText(),'3\nTODAY');
 await page.locator(`[data-smoking-day="${day()}"]`).first().click();await page.locator('[data-smoking-complete]').click();
 let stored=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);assert.equal(stored.dayConfirmations[day()],'complete');
 x.setOffline(true);await page.locator('[data-log-cigarette]').click();
 await page.getByText(/waiting to sync/).waitFor();
 await page.reload();await page.locator('.sj-screen').waitFor();assert.match(await page.locator('.tracking-intro h1').innerText(),/^4/);
 x.setOffline(false);await page.locator('[data-smoking-sync]').click();await page.waitForFunction(key=>Object.keys(JSON.parse(localStorage.getItem(key)).smokingMutations||{}).length===0,key);assert.equal(rows.size,2);
 await page.locator(`[data-smoking-day="${day()}"]`).first().click();await page.locator('[data-smoking-edit]').first().click();await page.locator('[data-smoking-remove]').click();
 await page.waitForFunction(key=>Object.keys(JSON.parse(localStorage.getItem(key)).smokingMutations||{}).length===0,key);
 await page.reload();await page.locator('.sj-screen').waitFor();assert.equal(rows.size,1);assert.match(await page.locator('.tracking-intro h1').innerText(),/^3/);
 await page.locator('[data-view=insights]').first().click();await page.locator('.tracking-insights').waitFor();assert.ok((await page.locator('body').innerText()).includes('ACTUAL VS TARGET'));
 await page.waitForTimeout(700);await page.screenshot({path:'/tmp/reclaim-reduce-patterns.png',fullPage:true});
 await page.locator('[data-view=home]').first().click();await page.locator('[data-smoking-for-you]').click();await page.locator('.for-you-sheet').waitFor();await page.locator('[data-close]').click();await x.context.close();
 const t=await open('track');await t.page.locator('[data-log-cigarette]').click();await t.page.locator('[data-view=insights]').first().click();assert.equal(await t.page.locator('.sj-plan').count(),0);assert.equal(await t.page.locator('.sj-comparison').count(),0);assert.ok(!(await t.page.locator('.sj-screen').innerText()).includes('DAILY TARGET'));
 await t.page.waitForTimeout(700);await t.page.screenshot({path:'/tmp/reclaim-track-patterns.png',fullPage:true});await t.context.close();
 const confirmations={},logs=[];for(let i=-7;i<0;i++){confirmations[day(i)]='complete';logs.push({at:day(i)+'T12:00:00',cigarettes:15});}
 const plan={version:1,baseline:20,baselineSource:'your estimate',currentTarget:18,stage:1,reviewStart:day(-7),startedOn:day(-7),history:[],targetHistory:[{from:day(-7),target:18}]};
 const r=await open('reduce',{reductionPlan:plan,dayConfirmations:confirmations,smokingEvents:logs});await r.page.locator('[data-smoking-review]').click();await r.page.locator('[data-smoking-apply]').click();stored=await r.page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);assert.equal(stored.reductionPlan.currentTarget,16);assert.equal(stored.reductionPlan.stage,2);
 await r.page.locator('[data-smoking-review]').click();assert.equal(await r.page.locator('[data-smoking-apply]').count(),0);await r.page.locator('[data-close]').click();await r.page.waitForTimeout(700);await r.page.screenshot({path:'/tmp/reclaim-reduce-home.png',fullPage:true});await r.context.close();
 const setup=await open('track');await setup.page.locator('[data-view=more]').click();await setup.page.locator('[data-change-path]').click();await setup.page.locator('[data-journey-mode=reduce]').click();await setup.page.locator('[name=cigarettesPerDay]').fill('12');await setup.page.locator('#setup-form .primary').click();await setup.page.locator('.sj-screen').waitFor();stored=await setup.page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);assert.equal(stored.reductionPlan.baseline,12);assert.equal(stored.reductionPlan.currentTarget,11);await setup.page.evaluate(()=>{document.documentElement.dataset.theme='light'});await setup.page.waitForTimeout(900);assert.equal(await setup.page.locator('.reclaim-country-sheet').isVisible(),false);await setup.page.screenshot({path:'/tmp/reclaim-light.png',fullPage:true});assert.ok(await setup.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await setup.context.close();
 const owner=await open('track',{cloudOwnerId:'another-user',smokingEvents:[{at:new Date().toISOString(),cigarettes:99}],reductionPlan:plan,dayConfirmations:confirmations,smokingMutations:{secret:{kind:'delete',ownerId:'another-user'}}});stored=await owner.page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);assert.equal(stored.smokingEvents.length,0);assert.equal(stored.reductionPlan,null);assert.deepEqual(stored.dayConfirmations,{});assert.deepEqual(stored.smokingMutations,{});await owner.context.close();
 const q=await open('quit');assert.equal(await q.page.locator('.home-days').count(),1);await q.page.locator('[data-view=health]').click();await q.page.locator('[data-view=momentum]').click();await q.page.locator('[data-view=more]').click();await q.page.locator('[data-edit-profile]').click();await q.page.locator('[data-open-quit-picker]').click();await q.page.locator('.reclaim-time-card').waitFor();await q.page.locator('[data-date-trigger]').click();await q.page.locator('[data-cal-year-trigger]').click();assert.ok(await q.page.locator('[data-cal-year-menu]').isVisible());await q.context.close();
 assert.deepEqual(errors,[]);console.log('PASS: logging, edit/delete, offline retry, reload, day confirmation, Reduce review, Track isolation, Quit navigation/date picker; no page errors.');
}finally{await browser.close();}
