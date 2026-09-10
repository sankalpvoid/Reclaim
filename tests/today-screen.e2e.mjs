import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const url=process.env.TEST_URL||'http://127.0.0.1:4173';
const errors=[];
try{
 for(const mode of ['quit','reduce','track']){
  const context=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Kolkata'});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await context.route('https://**/*',route=>{const u=new URL(route.request().url());return u.pathname.startsWith('/rest/')||u.pathname.startsWith('/auth/')?route.fulfill({status:200,contentType:'application/json',body:'[]'}):route.continue()});
  await context.addInitScript(mode=>{if(localStorage.getItem('today-test'))return;localStorage.setItem('today-test','1');localStorage.setItem('reclaim-state-v2',JSON.stringify({stage:'app',view:'home',profile:{journeyMode:mode,cigarettesPerDay:20,quitAt:new Date(Date.now()-3*864e5).toISOString(),pricePerPack:300,cigarettesPerPack:20,country:'IN'},smokingEvents:[]}))},mode);
  await page.goto(url);await page.locator('.today-screen').waitFor();
  assert.equal(await page.locator('nav').count(),1);
  assert.equal(await page.locator('[data-view=activities],[data-view=ritual],[data-view=progress]').count(),0);
  assert.equal(await page.locator('.today-support').count(),1);
  if(mode==='quit')assert.equal(await page.locator('[data-log-cigarette]').count(),0);
  else{
   const help=await page.locator('.today-support').boundingBox(),log=await page.locator('[data-log-cigarette]').boundingBox();assert.ok(help.y<log.y);
   assert.equal(await page.locator('[data-log-cigarette].primary').count(),0);
   assert.equal(await page.locator('.sj-target').count(),mode==='reduce'?1:0);
   await page.locator('[data-log-cigarette]').click();await page.locator('.tracking-intro h1').filter({hasText:'1'}).waitFor();
   await page.reload();await page.locator('.today-screen').waitFor();assert.match(await page.locator('.tracking-intro h1').innerText(),/^1/);
  }
  await page.locator('.today-support').click();await page.locator('.craving-support').waitFor();
  await page.locator('[data-back]').click();await page.locator('.today-screen').waitFor();
  await page.locator('.today-next-step [data-tool=walk]').click();await page.locator('.modal-body').waitFor();assert.match(await page.locator('.modal-body').innerText(),/five minutes/i);await page.locator('[data-close]').click();
  for(const width of [320,390,768]){
   await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  }
  await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>getComputedStyle(document.querySelector('.today-screen')).opacity==='1');await page.screenshot({path:`/tmp/today-v2-${mode}.png`,fullPage:true});
  await page.locator('[data-view=more]').click();
  await page.locator('[data-theme-choice=light]').click();
  await page.locator('[data-view=home]').first().click();
  await page.locator('.today-screen').waitFor();
  assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('.today-screen')).opacity==='1');await page.screenshot({path:`/tmp/today-v2-${mode}-light.png`,fullPage:true});
  await context.close();
 }
 assert.deepEqual(errors,[]);console.log('Today v2: Quit/Reduce/Track, existing support, logging/reload, single navigation, responsive widths passed.');
}finally{await browser.close()}
