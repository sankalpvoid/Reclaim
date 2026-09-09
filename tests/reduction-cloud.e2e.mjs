import {createRequire} from 'node:module';
import assert from 'node:assert/strict';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const browser=await chromium.launch({
  executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless:true
});

const TEST_URL=process.env.TEST_URL||'http://127.0.0.1:4173';
const STATE_KEY='reclaim-state-v2';
const SESSION_KEY='reclaim-session-v1';
const user={id:'22222222-2222-4222-8222-222222222222'};
const day=(offset=0)=>{const d=new Date();d.setDate(d.getDate()+offset);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const baseProfile={name:'Cloud Test',journeyMode:'reduce',cigarettesPerDay:20,dailyTarget:18,quitAt:new Date(Date.now()-10*86400000).toISOString(),pricePerPack:300,cigarettesPerPack:20,country:'IN'};

const cloud={
  profile:{id:user.id,display_name:'Cloud Test',journey_mode:'reduce',daily_target:18,quit_date:baseProfile.quitAt,cigarettes_per_day:20,price_per_pack:300,cigarettes_per_pack:20,country:'IN',onboarding_completed:true},
  plan:null,
  reviews:[],
  confirmations:new Map(),
  smokingEvents:new Map()
};
let failReviews=false;
let failConfirmationWrites=false;
const pageErrors=[];

function json(route,data,status=200){return route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});}
function body(req){try{return req.postDataJSON()}catch{return null}}
function stripEq(value=''){return String(value).startsWith('eq.')?String(value).slice(3):String(value)}

async function installApi(context){
  await context.route('https://**/*',async route=>{
    const req=route.request(),url=new URL(req.url()),path=url.pathname,method=req.method();
    if(!path.startsWith('/rest/v1/')&&!path.startsWith('/auth/v1/'))return route.continue();

    if(path==='/auth/v1/user')return json(route,user);
    if(path.includes('/profiles')){
      if(method==='GET')return json(route,[cloud.profile]);
      const next=body(req)||{};cloud.profile={...cloud.profile,...next};return json(route,[cloud.profile]);
    }
    if(path.includes('/health_milestones')||path.includes('/savings_goals')||path.includes('/daily_checkins'))return json(route,[]);

    if(path.includes('/smoking_events')){
      if(method==='GET')return json(route,[...cloud.smokingEvents.values()]);
      if(method==='POST'){
        const rows=Array.isArray(body(req))?body(req):[body(req)];
        for(const row of rows.filter(Boolean))cloud.smokingEvents.set(row.id,row);
        return json(route,[]);
      }
      if(method==='DELETE'){
        const id=stripEq(url.searchParams.get('id'));if(id)cloud.smokingEvents.delete(id);return json(route,[]);
      }
    }

    if(path.includes('/reduction_plans')){
      if(method==='GET')return json(route,cloud.plan?[cloud.plan]:[]);
      if(method==='POST'){cloud.plan=body(req);return json(route,[]);}
    }
    if(path.includes('/reduction_reviews')){
      if(method==='GET')return json(route,[...cloud.reviews].sort((a,b)=>a.reviewed_on.localeCompare(b.reviewed_on)||a.review_start.localeCompare(b.review_start)));
      if(method==='POST'){
        if(failReviews)return route.abort();
        const rows=Array.isArray(body(req))?body(req):[body(req)];
        for(const row of rows.filter(Boolean)){
          const index=cloud.reviews.findIndex(item=>item.user_id===row.user_id&&item.reviewed_on===row.reviewed_on&&item.review_start===row.review_start);
          if(index>=0)cloud.reviews[index]=row;else cloud.reviews.push(row);
        }
        return json(route,[]);
      }
    }
    if(path.includes('/daily_smoking_confirmations')){
      if(method==='GET')return json(route,[...cloud.confirmations.values()].sort((a,b)=>a.day.localeCompare(b.day)));
      if(method==='POST'){
        if(failConfirmationWrites)return route.abort();
        const rows=Array.isArray(body(req))?body(req):[body(req)];
        for(const row of rows.filter(Boolean))cloud.confirmations.set(row.day,row);
        return json(route,[]);
      }
      if(method==='DELETE'){
        if(failConfirmationWrites)return route.abort();
        const key=stripEq(url.searchParams.get('day'));if(key)cloud.confirmations.delete(key);return json(route,[]);
      }
    }

    return json(route,[]);
  });
}

function seededPlan(){
  return {
    version:1,baseline:20,baselineSource:'your estimate',currentTarget:18,stage:1,status:'active',
    reviewStart:day(-7),startedOn:day(-7),history:[],targetHistory:[{from:day(-7),target:18}],
    minimumAutomaticTarget:1,reductionRate:0.1,reviewWindowDays:7
  };
}

async function waitForCloudBootstrap(page){
  await page.waitForFunction(()=>window.__reclaimCloudBootstrap?.partial===false);
  await page.locator('.sj-screen').waitFor();
}

async function openDevice({seedReduction=true}={}){
  const context=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Kolkata'});
  await installApi(context);
  const page=await context.newPage();
  page.on('pageerror',error=>pageErrors.push(error.message));
  await context.addInitScript(({STATE_KEY,SESSION_KEY,user,baseProfile,seedReduction,plan,confirmations,logs})=>{
    localStorage.setItem(SESSION_KEY,JSON.stringify({access_token:'test-token',user}));
    localStorage.setItem('reclaim-lifecycle-v1',JSON.stringify({userId:user.id,lastActiveAt:Date.now()}));
    const state={stage:'app',view:'home',profile:{...baseProfile},cloudOwnerId:user.id};
    if(seedReduction){state.reductionPlan=plan;state.dayConfirmations=confirmations;state.smokingEvents=logs;}
    localStorage.setItem(STATE_KEY,JSON.stringify(state));
  },{
    STATE_KEY,SESSION_KEY,user,baseProfile,seedReduction,
    plan:seededPlan(),
    confirmations:Object.fromEntries(Array.from({length:7},(_,index)=>[day(index-7),'complete'])),
    logs:Array.from({length:7},(_,index)=>({at:`${day(index-7)}T12:00:00`,cigarettes:15}))
  });
  await page.goto(TEST_URL);
  await waitForCloudBootstrap(page);
  return {context,page};
}

async function localState(page){return page.evaluate(key=>JSON.parse(localStorage.getItem(key)),STATE_KEY);}
async function waitReductionClean(page){
  await page.waitForFunction(key=>{
    const state=JSON.parse(localStorage.getItem(key)||'{}'),sync=state.reductionSync||{};
    return !sync.planDirty&&!sync.reviewsDirty&&Object.keys(sync.confirmations||{}).length===0;
  },STATE_KEY);
}

try{
  const a=await openDevice({seedReduction:true});
  for(let attempt=0;attempt<100&&!cloud.plan;attempt++)await new Promise(resolve=>setTimeout(resolve,25));
  for(let attempt=0;attempt<100&&cloud.confirmations.size<7;attempt++)await new Promise(resolve=>setTimeout(resolve,25));
  assert.ok(cloud.plan,'Device A should upload its existing Reduce plan');
  assert.equal(cloud.confirmations.size,7,'Device A should migrate its seven existing completed days');
  await waitReductionClean(a.page);

  failReviews=true;
  await a.page.locator('[data-smoking-review]').first().click();
  await a.page.locator('[data-smoking-apply]').first().click();
  await a.page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).reductionPlan?.currentTarget===16,STATE_KEY);
  let state=await localState(a.page);
  assert.equal(state.reductionPlan.stage,2);
  assert.equal(state.reductionPlan.history.length,1);
  assert.equal(state.reductionSync.planDirty,false,'plan snapshot should have synced before the review-history failure');
  assert.equal(state.reductionSync.reviewsDirty,true,'failed review history must remain pending');
  assert.equal(state.reductionSync.pendingReviews?.length,1,'failed review must have an independent pending snapshot');
  assert.equal(cloud.plan.current_target,16);
  assert.equal(cloud.reviews.length,0);

  await a.page.reload();
  await waitForCloudBootstrap(a.page);
  const boot=await a.page.evaluate(()=>window.__reclaimCloudBootstrap?.reduction||null);
  assert.equal(boot?.historyCount,1,`cloud bootstrap must restore pending history; bootstrap=${JSON.stringify(boot)}`);
  assert.equal(boot?.reviewsDirty,true,`review must remain dirty during failed endpoint; bootstrap=${JSON.stringify(boot)}`);
  assert.equal(boot?.pendingReviewCount,1,`pending review snapshot must survive hydration; bootstrap=${JSON.stringify(boot)}`);
  state=await localState(a.page);
  assert.equal(state.reductionPlan.history.length,1,'pending review history must survive reload');
  assert.equal(state.reductionPlan.currentTarget,16);
  assert.equal(state.reductionSync.reviewsDirty,true);

  failReviews=false;
  await a.page.locator('[data-smoking-sync]').first().click();
  for(let attempt=0;attempt<100&&cloud.reviews.length<1;attempt++)await new Promise(resolve=>setTimeout(resolve,25));
  await waitReductionClean(a.page);
  assert.equal(cloud.reviews.length,1,'pending review history should sync after reconnect');

  failConfirmationWrites=true;
  await a.page.locator(`[data-smoking-day="${day()}"]`).first().click();
  await a.page.locator('[data-smoking-complete]').click();
  state=await localState(a.page);
  assert.equal(state.dayConfirmations[day()],'smoke_free');
  assert.equal(state.reductionSync.confirmations[day()].kind,'upsert');
  assert.equal(cloud.confirmations.has(day()),false);
  await a.page.reload();
  await waitForCloudBootstrap(a.page);
  state=await localState(a.page);
  assert.equal(state.dayConfirmations[day()],'smoke_free','offline confirmation must survive reload');
  assert.equal(state.reductionSync.confirmations[day()].kind,'upsert');

  failConfirmationWrites=false;
  await a.page.locator('[data-smoking-sync]').first().click();
  for(let attempt=0;attempt<100&&!cloud.confirmations.has(day());attempt++)await new Promise(resolve=>setTimeout(resolve,25));
  await waitReductionClean(a.page);
  assert.equal(cloud.confirmations.get(day()).status,'smoke_free');

  await a.page.locator('[data-log-cigarette]').click();
  for(let attempt=0;attempt<100&&cloud.confirmations.has(day());attempt++)await new Promise(resolve=>setTimeout(resolve,25));
  state=await localState(a.page);
  assert.equal(state.dayConfirmations[day()],undefined);
  assert.equal(cloud.confirmations.has(day()),false,'adding a cigarette after confirmation should delete the cloud confirmation');
  await a.context.close();

  const b=await openDevice({seedReduction:false});
  await b.page.waitForFunction(key=>{
    const state=JSON.parse(localStorage.getItem(key)||'{}');
    return state.reductionPlan?.history?.length===1&&state.reductionPlan?.currentTarget===16;
  },STATE_KEY);
  const restored=await localState(b.page);
  assert.equal(restored.reductionPlan.baseline,20);
  assert.equal(restored.reductionPlan.currentTarget,16);
  assert.equal(restored.reductionPlan.stage,2);
  assert.equal(restored.reductionPlan.history.length,1);
  assert.deepEqual(restored.reductionPlan.targetHistory,[{from:day(-7),target:18},{from:day(),target:16}]);
  for(let offset=-7;offset<0;offset++)assert.equal(restored.dayConfirmations[day(offset)],'complete');
  assert.equal(restored.dayConfirmations[day()],undefined,'invalidated today confirmation must not reappear on Device B');
  assert.equal(restored.reductionSync.planDirty,false);
  assert.equal(restored.reductionSync.reviewsDirty,false);
  assert.deepEqual(restored.reductionSync.confirmations,{});
  assert.deepEqual(pageErrors,[]);
  await b.context.close();

  console.log('PASS: Device A -> cloud -> clean Device B restores Reduce plan, stage, target history, reviews and completed days; partial/offline sync survives reload and reconnect.');
}finally{
  await browser.close();
}
