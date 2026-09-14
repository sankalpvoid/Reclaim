import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const errors=[];
try{
 for(const mode of ['quit','reduce','track']){
  const context=await browser.newContext({viewport:{width:390,height:844}});
  await context.route('https://**/*',r=>{const p=new URL(r.request().url()).pathname;return p.startsWith('/rest/')||p.startsWith('/auth/')?r.fulfill({status:200,contentType:'application/json',body:'[]'}):r.continue()});
  await context.addInitScript(mode=>{localStorage.setItem('reclaim-state-v2',JSON.stringify({stage:'app',view:'home',profile:{journeyMode:mode,cigarettesPerDay:20,quitAt:new Date(Date.now()-3*864e5).toISOString(),pricePerPack:300,cigarettesPerPack:20,country:'IN'},smokingEvents:[]}))},mode);
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.TEST_URL||'http://127.0.0.1:4173');await page.locator('.today-screen').waitFor();
  const visit=async(view)=>{await page.locator(`[data-view="${view}"]`).first().click();await page.locator('.screen').waitFor();await page.waitForTimeout(350);assert.ok(await page.locator('nav').count()<=1);for(const width of [320,390]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${mode}/${view} overflow at ${width}`)}await page.screenshot({path:`/tmp/reclaim-v2-${mode}-${view}.png`,fullPage:true})};
  await visit('craving');
  for(const tool of ['walk','breathe','water','timer']){await page.locator(`[data-tool="${tool}"]`).click();await page.locator('.modal-body').waitFor();await page.locator('[data-close]').click()}
  await page.locator('[data-back]').click();
  if(mode==='quit'){for(const view of ['health','momentum','dreams'])await visit(view)}
  await visit('more');await visit('insights');await visit('more');
  if(mode==='quit'){await visit('circles');assert.ok(await page.locator('[data-community-safety]').isVisible());await page.locator('[data-community-safety]').click();await page.locator('.modal-body').waitFor();await page.locator('[data-close]').click();await visit('more')}
  await page.locator('[data-theme-choice=light]').click();assert.equal(await page.locator('html').getAttribute('data-theme'),'light');await page.waitForFunction(()=>getComputedStyle(document.querySelector('.screen')).opacity==='1');await page.screenshot({path:`/tmp/reclaim-v2-${mode}-light.png`,fullPage:true});
  await page.locator('[data-edit-profile]').click();await page.locator('.setup-screen input:not([type=hidden])').first().waitFor();await page.waitForFunction(()=>getComputedStyle(document.querySelector('.screen')).opacity==='1');await page.screenshot({path:`/tmp/reclaim-v2-${mode}-setup.png`,fullPage:true});
  await context.close();
 }
 assert.deepEqual(errors,[]);console.log('App v2: all journey navigation, four tools, community safety, profile editor, themes and mobile layouts passed.');
}finally{await browser.close()}
