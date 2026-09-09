import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require=createRequire(import.meta.url);
const { chromium }=require(process.env.PLAYWRIGHT_PATH||'playwright');
const browser=await chromium.launch({
  executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless:true
});

const user={id:'33333333-3333-4333-8333-333333333333'};
const quitAt=new Date(Date.now()-10*86400000).toISOString();

try{
  const context=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Kolkata'});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));

  await context.route('https://**/*',async route=>{
    const url=new URL(route.request().url());
    if(!url.pathname.startsWith('/rest/v1/')&&!url.pathname.startsWith('/auth/v1/'))return route.continue();

    let data=[];
    if(url.pathname==='/auth/v1/user')data=user;
    else if(url.pathname.includes('/profiles'))data=[{
      id:user.id,
      display_name:'Refresh Test',
      journey_mode:'quit',
      daily_target:15,
      quit_date:quitAt,
      cigarettes_per_day:20,
      price_per_pack:300,
      cigarettes_per_pack:20,
      country:'IN',
      onboarding_completed:true
    }];
    else if(url.pathname.includes('/daily_checkins'))data=[{client_id:'refresh-checkin',created_at:new Date().toISOString(),mood:'okay'}];
    else if(url.pathname.includes('/smoking_events'))data=[];

    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });

  await context.addInitScript(({user,quitAt})=>{
    localStorage.setItem('reclaim-state-v2',JSON.stringify({
      stage:'app',
      view:'home',
      profile:{
        name:'Refresh Test',
        journeyMode:'quit',
        quitAt,
        cigarettesPerDay:20,
        dailyTarget:15,
        pricePerPack:300,
        cigarettesPerPack:20,
        minutesPerCigarette:11,
        country:'IN',
        currency:'₹',
        currencyCode:'INR'
      },
      smokingEvents:[],
      checkins:[],
      cravings:[],
      goals:[]
    }));
    localStorage.setItem('reclaim-session-v1',JSON.stringify({access_token:'test-token',user}));
    localStorage.setItem('reclaim-lifecycle-v1',JSON.stringify({userId:user.id,lastActiveAt:Date.now()}));
  },{user,quitAt});

  await page.goto(process.env.TEST_URL||'http://127.0.0.1:4173');
  await page.locator('.home-screen').waitFor();
  assert.equal(await page.locator('.intro-reference').count(),0,'Returning app load must not render intro');
  assert.equal(await page.locator('#reclaim-restore-host').count(),0,'No inert snapshot overlay should exist');

  await page.reload();
  await page.locator('.home-screen').waitFor();
  assert.equal(await page.locator('.intro-reference').count(),0,'Refresh must stay on the dashboard');

  await page.locator('[data-view=more]').click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('reclaim-state-v2')||'{}').view==='more');
  assert.equal(await page.locator('.intro-reference').count(),0,'Navigation after refresh must remain interactive');

  await page.reload();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('reclaim-state-v2')||'{}').view==='more');
  assert.equal(await page.locator('.intro-reference').count(),0,'A non-home page must survive refresh without intro flash');

  await page.locator('[data-view=home]').first().click();
  await page.locator('.home-screen').waitFor();
  assert.deepEqual(errors,[],'Refresh flow emitted browser errors');

  console.log('PASS: saved app route survives refresh and controls remain live.');
  await context.close();
}finally{
  await browser.close();
}
