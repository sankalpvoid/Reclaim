import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

const STATE_KEY='reclaim-state-v2';
const SESSION_KEY='reclaim-session-v1';
const LIFECYCLE_KEY='reclaim-lifecycle-v1';
const VALID_MOODS=new Set(['great','okay','struggling','craving']);
const CHECKIN_INTERVAL_MS=2*60*60*1000;
const DAILY_PROMPT_CAP=5;
const ACTIVE_HEARTBEAT_MS=30*1000;
const RETRY_INITIAL_MS=1500;
const RETRY_MAX_MS=60000;
const nativeSetItem=Storage.prototype.setItem;
const startupAt=Date.now();
const startupLifecycle=readJson(LIFECYCLE_KEY)||{};
let cloudCheckins=[];
let syncing=false;
let scheduled=null;
let lastAttempt=0;
let retryDelay=RETRY_INITIAL_MS;
let lastUser='';
let routeBridge=document.querySelector('.intro-reference-cta[data-stage]');
let completingOnboarding=false;
let welcomeForUser='';

function readJson(key){try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}}
function safeDate(value){const date=new Date(value||0);return Number.isFinite(date.getTime())?date.toISOString():new Date().toISOString()}
function localDay(value){const date=new Date(value||Date.now());if(!Number.isFinite(date.getTime()))return '';const pad=n=>String(n).padStart(2,'0');return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`}
function escapeHtml(value=''){return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]))}
function decodeSub(token=''){
  try{
    const payload=token.split('.')[1];
    if(!payload)return '';
    const normalized=payload.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(payload.length/4)*4,'=');
    return JSON.parse(atob(normalized))?.sub||'';
  }catch{return ''}
}
function authContext(){
  const session=readJson(SESSION_KEY)||{};
  return {token:session.access_token||'',userId:session.user?.id||decodeSub(session.access_token||'')};
}
function mergeCheckins(local=[],remote=[]){
  const byClient=new Map(),merged=[];
  for(const item of [...local,...remote]){
    if(!item||!VALID_MOODS.has(item.mood))continue;
    const clientId=item.clientId||item.client_id||'';
    const key=clientId?`client:${clientId}`:`legacy:${item.mood}:${safeDate(item.at||item.created_at)}`;
    const normalized={
      mood:item.mood,
      at:safeDate(item.at||item.created_at),
      ...(item.note?{note:String(item.note).slice(0,500)}:{}),
      ...(clientId?{clientId}:{}),
      ...(item.cloudId||item.id?{cloudId:item.cloudId||item.id}:{})
    };
    if(!byClient.has(key)){
      byClient.set(key,normalized);
      merged.push(normalized);
    }else{
      const existing=byClient.get(key);
      if(!existing.cloudId&&normalized.cloudId)existing.cloudId=normalized.cloudId;
    }
  }
  return merged.sort((a,b)=>new Date(a.at)-new Date(b.at));
}
function writeState(state){nativeSetItem.call(localStorage,STATE_KEY,JSON.stringify(state))}
function writeLifecycle(patch={}){
  const current=readJson(LIFECYCLE_KEY)||{};
  nativeSetItem.call(localStorage,LIFECYCLE_KEY,JSON.stringify({...current,...patch}));
}
function ensureClientIds(state){
  let changed=false;
  state.checkins=Array.isArray(state.checkins)?state.checkins:[];
  for(const item of state.checkins){
    if(!item||!VALID_MOODS.has(item.mood))continue;
    if(!item.clientId){item.clientId=crypto.randomUUID();changed=true}
    if(!item.at){item.at=new Date().toISOString();changed=true}
  }
  return changed;
}
function latestCheckin(checkins=[]){return [...checkins].filter(item=>VALID_MOODS.has(item?.mood)).sort((a,b)=>new Date(b.at||b.created_at)-new Date(a.at||a.created_at))[0]||null}
function todayCheckinCount(checkins=[]){const today=localDay(Date.now());return checkins.filter(item=>VALID_MOODS.has(item?.mood)&&localDay(item.at||item.created_at)===today).length}
function checkinIsDue(checkins=[]){
  const latest=latestCheckin(checkins);
  if(todayCheckinCount(checkins)>=DAILY_PROMPT_CAP)return false;
  if(!latest)return true;
  return Date.now()-new Date(latest.at||latest.created_at).getTime()>=CHECKIN_INTERVAL_MS;
}
function routeTo(stage){
  if(!routeBridge?.isConnected){
    const current=document.querySelector('.intro-reference-cta[data-stage]');
    if(current)routeBridge=current;
  }
  if(!routeBridge)return false;
  routeBridge.dataset.stage=stage;
  routeBridge.click();
  return true;
}
function progressSignal(state={}){
  const profile=state.profile||{};
  if(profile.journeyMode==='quit'&&profile.quitAt){
    const elapsed=Math.max(0,Date.now()-new Date(profile.quitAt).getTime());
    const hours=Math.floor(elapsed/36e5);
    if(hours>=48)return `${Math.floor(hours/24)} days reclaimed so far. Your progress is still here.`;
    if(hours>=1)return `${hours} ${hours===1?'hour':'hours'} reclaimed so far. Your progress is still here.`;
  }
  return 'Your progress is still here. Take a moment to check in with yourself.';
}
function renderWelcome(profile,state,userId){
  if(welcomeForUser===userId&&document.querySelector('[data-returning-checkin]'))return;
  const bridge=routeBridge||document.querySelector('.intro-reference-cta[data-stage]');
  if(!bridge)return;
  routeBridge=bridge;
  const app=document.querySelector('#app');
  if(!app)return;
  const name=profile?.display_name||state?.profile?.name||'there';
  app.innerHTML=`<main class="shell"><section class="screen full"><div class="brand">RECLAIM</div><div style="margin-top:58px"><div class="eyebrow">YOUR JOURNEY CONTINUES</div><h1>WELCOME BACK,<br>${escapeHtml(String(name).toUpperCase())}.</h1><p class="muted" style="margin-top:18px">${escapeHtml(progressSignal(state))}</p></div><div class="spacer"></div><p class="muted small" style="text-align:center;margin-bottom:12px">How are you feeling right now?</p><button class="primary" data-returning-checkin>CHECK IN</button><button class="secondary" data-returning-skip style="margin-top:10px">GO TO DASHBOARD</button></section></main>`;
  app.querySelector('[data-returning-checkin]')?.addEventListener('click',()=>{welcomeForUser='';routeTo('mood')});
  app.querySelector('[data-returning-skip]')?.addEventListener('click',()=>{welcomeForUser='';routeTo('app')});
  welcomeForUser=userId;
}
function startupBelongsTo(userId){return Boolean(userId&&startupLifecycle.userId===userId)}
function shouldFastResume(state={}){
  const {userId,token}=authContext();
  if(!userId||!token||!startupBelongsTo(userId))return false;
  const savedStage=state?.stage;
  if(!['app','support','mood'].includes(savedStage))return false;
  const lastActive=Number(startupLifecycle.lastActiveAt||0);
  const recentActivity=lastActive>0&&startupAt-lastActive<CHECKIN_INTERVAL_MS;
  const latest=latestCheckin(state.checkins||[]);
  const recentCheckin=latest&&startupAt-new Date(latest.at||latest.created_at).getTime()<CHECKIN_INTERVAL_MS;
  return recentActivity||recentCheckin;
}
function fastResume(){
  const state=readJson(STATE_KEY)||{};
  if(window.__reclaimReloadStage)return false;
  if(!document.querySelector('.intro-reference-cta[data-stage]'))return false;
  if(!shouldFastResume(state))return false;
  const saved=['app','support','mood'].includes(state.stage)?state.stage:'app';
  return routeTo(saved==='mood'?'app':saved);
}

Storage.prototype.setItem=function(key,value){
  if(this===localStorage&&key===STATE_KEY&&cloudCheckins.length){
    try{
      const next=JSON.parse(String(value));
      next.checkins=mergeCheckins(Array.isArray(next.checkins)?next.checkins:[],cloudCheckins);
      value=JSON.stringify(next);
    }catch{}
  }
  return nativeSetItem.call(this,key,value);
};

async function refreshAuthSession(){
  const session=readJson(SESSION_KEY)||{};
  if(!session.refresh_token)throw new Error('No refresh token');
  const response=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,{
    method:'POST',
    headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json'},
    body:JSON.stringify({refresh_token:session.refresh_token})
  });
  const text=await response.text();
  let data=null;try{data=text?JSON.parse(text):null}catch{data=text}
  if(!response.ok||!data?.access_token)throw new Error(data?.message||data?.error_description||'Session refresh failed');
  nativeSetItem.call(localStorage,SESSION_KEY,JSON.stringify({...session,...data}));
  return data.access_token;
}
async function request(path,options={},retried=false){
  const {token}=authContext();
  if(!token)throw new Error('No signed-in session');
  const response=await fetch(`${SUPABASE_URL}${path}`,{
    ...options,
    headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${token}`,'Content-Type':'application/json',...(options.headers||{})}
  });
  const text=await response.text();
  let data=null;try{data=text?JSON.parse(text):null}catch{data=text}
  if(!response.ok){
    if(!retried&&(response.status===401||response.status===403)){
      try{await refreshAuthSession();return request(path,options,true)}catch{}
    }
    throw new Error(data?.message||data?.hint||data?.error||`Check-in sync failed (${response.status})`);
  }
  return data;
}

function pulseConsumers(){
  document.dispatchEvent(new CustomEvent('reclaim:checkins-synced'));
  const app=document.querySelector('#app');
  if(app){const marker=document.createComment('checkins-synced');app.appendChild(marker);marker.remove()}
}
async function fetchCloudCheckins(userId){
  const rows=await request(`/rest/v1/daily_checkins?user_id=eq.${encodeURIComponent(userId)}&select=id,client_id,mood,note,created_at&order=created_at.asc`,{method:'GET'});
  return (Array.isArray(rows)?rows:[]).map(row=>({mood:row.mood,at:row.created_at,note:row.note,clientId:row.client_id,cloudId:row.id}));
}
async function fetchLifecycleProfile(userId){
  const rows=await request(`/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=id,display_name,onboarding_completed,journey_mode,quit_date`,{method:'GET'});
  return Array.isArray(rows)?rows[0]||null:null;
}
function onboardingMoodConfirmed(userId){
  const lifecycle=readJson(LIFECYCLE_KEY)||{};
  if(lifecycle.userId!==userId||!lifecycle.onboardingMoodAnsweredAt)return false;
  if(lifecycle.onboardingMoodClientId){
    return cloudCheckins.some(item=>item.clientId===lifecycle.onboardingMoodClientId&&item.cloudId);
  }
  const answeredAt=Number(lifecycle.onboardingMoodAnsweredAt||0);
  if(!answeredAt)return false;
  return cloudCheckins.some(item=>Math.abs(new Date(item.at).getTime()-answeredAt)<=2*60*1000);
}
async function markOnboardingComplete(){
  const {userId}=authContext();
  if(!userId||!onboardingMoodConfirmed(userId))return false;
  try{
    await request(`/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`,{
      method:'PATCH',
      headers:{Prefer:'return=minimal'},
      body:JSON.stringify({onboarding_completed:true})
    });
    writeLifecycle({userId,onboardingMoodPending:false,onboardingMoodAnsweredAt:null,onboardingMoodClientId:null,onboardingCompletedAt:Date.now()});
    return true;
  }catch(error){console.warn('Onboarding completion sync:',error.message);return false}
}
function applyLifecycle(profile,state,userId){
  const introVisible=!!document.querySelector('.intro-reference-cta[data-stage]');
  const moodVisible=!!document.querySelector('[data-mood]');
  if(!profile)return;

  if(!profile.onboarding_completed){
    const lifecycle=readJson(LIFECYCLE_KEY)||{};
    const pendingMood=Boolean(lifecycle.userId===userId&&lifecycle.onboardingMoodPending);
    if(introVisible||moodVisible){
      const saved=state?.stage;
      const target=saved==='setup'?'setup':saved==='path'?'path':(saved==='mood'&&pendingMood?'mood':'path');
      if(!(moodVisible&&target==='mood'))routeTo(target);
    }
    return;
  }

  if(window.__reclaimReloadStage)return;

  const lastActive=Number(startupLifecycle.lastActiveAt||0);
  const recentActivity=startupBelongsTo(userId)&&lastActive>0&&startupAt-lastActive<CHECKIN_INTERVAL_MS;
  if((introVisible||moodVisible)&&recentActivity){
    routeTo(['app','support'].includes(state?.stage)?state.stage:'app');
    return;
  }

  if(!introVisible&&!moodVisible)return;

  const due=checkinIsDue(state.checkins||[]);
  if(!due){routeTo('app');return}
  renderWelcome(profile,state,userId);
}

function hasUnsyncedWork(userId){
  const state=readJson(STATE_KEY)||{};
  const pendingCheckin=(state.checkins||[]).some(item=>VALID_MOODS.has(item?.mood)&&item.clientId&&!item.cloudId);
  const lifecycle=readJson(LIFECYCLE_KEY)||{};
  const pendingOnboarding=lifecycle.userId===userId&&Boolean(lifecycle.onboardingMoodAnsweredAt)&&!lifecycle.onboardingCompletedAt;
  return pendingCheckin||pendingOnboarding;
}
async function syncCheckins(){
  const now=Date.now();
  if(syncing)return;
  if(now-lastAttempt<1200){schedule(Math.max(80,1250-(now-lastAttempt)));return}
  lastAttempt=now;
  const {userId,token}=authContext();
  if(!userId||!token){lastUser='';cloudCheckins=[];welcomeForUser='';retryDelay=RETRY_INITIAL_MS;return}
  syncing=true;
  try{
    const state=readJson(STATE_KEY)||{};
    if(ensureClientIds(state))writeState(state);

    const [remote,profile]=await Promise.all([fetchCloudCheckins(userId),fetchLifecycleProfile(userId)]);
    cloudCheckins=remote;

    let current=readJson(STATE_KEY)||state;
    current.checkins=mergeCheckins(Array.isArray(current.checkins)?current.checkins:[],cloudCheckins);
    ensureClientIds(current);
    writeState(current);

    const pending=current.checkins.filter(item=>VALID_MOODS.has(item.mood)&&item.clientId&&!item.cloudId);
    if(pending.length){
      const payload=pending.map(item=>({
        user_id:userId,
        client_id:item.clientId,
        mood:item.mood,
        note:item.note?String(item.note).slice(0,500):null,
        created_at:safeDate(item.at)
      }));
      await request('/rest/v1/daily_checkins?on_conflict=user_id,client_id',{
        method:'POST',
        headers:{Prefer:'resolution=ignore-duplicates,return=minimal'},
        body:JSON.stringify(payload)
      });
      cloudCheckins=await fetchCloudCheckins(userId);
      current=readJson(STATE_KEY)||current;
      current.checkins=mergeCheckins(Array.isArray(current.checkins)?current.checkins:[],cloudCheckins);
      writeState(current);
    }

    if(profile&&!profile.onboarding_completed&&onboardingMoodConfirmed(userId)){
      if(await markOnboardingComplete())profile.onboarding_completed=true;
    }

    retryDelay=RETRY_INITIAL_MS;
    lastUser=userId;
    pulseConsumers();
    applyLifecycle(profile,current,userId);
  }catch(error){
    if(!/daily_checkins|schema cache|PGRST|No signed-in session|JWT|token/i.test(error.message||''))console.warn('Daily check-in sync:',error.message);
    if(hasUnsyncedWork(userId)){
      schedule(retryDelay);
      retryDelay=Math.min(RETRY_MAX_MS,retryDelay*2);
    }
  }finally{syncing=false}
}

function schedule(delay=180){
  clearTimeout(scheduled);
  scheduled=setTimeout(syncCheckins,delay);
}
function markActive(){
  if(document.hidden)return;
  const {userId}=authContext();
  if(userId)writeLifecycle({userId,lastActiveAt:Date.now()});
}

document.addEventListener('click',event=>{
  markActive();
  const moodButton=event.target.closest('[data-mood]');
  const quickMood=event.target.closest('[data-quick-mood]');
  if(moodButton||quickMood)setTimeout(()=>schedule(0),0);
  if(moodButton){
    const {userId}=authContext();
    const lifecycle=readJson(LIFECYCLE_KEY)||{};
    if(userId&&lifecycle.userId===userId&&lifecycle.onboardingMoodPending){
      setTimeout(()=>{
        const state=readJson(STATE_KEY)||{};
        if(ensureClientIds(state))writeState(state);
        const newest=latestCheckin(state.checkins||[]);
        writeLifecycle({
          userId,
          onboardingMoodAnsweredAt:Date.now(),
          onboardingMoodClientId:newest?.clientId||null
        });
        schedule(0);
      },0);
    }
  }
},false);
document.addEventListener('submit',event=>{
  markActive();
  if(event.target?.id==='auth-form')setTimeout(()=>schedule(350),0);
  if(event.target?.id==='setup-form'){
    completingOnboarding=true;
    const {userId}=authContext();
    if(userId)writeLifecycle({userId,onboardingMoodPending:true,onboardingMoodAnsweredAt:null,onboardingMoodClientId:null,onboardingCompletedAt:null});
    setTimeout(()=>{
      completingOnboarding=false;
      schedule(0);
    },500);
  }
},false);
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){
    const {userId}=authContext();
    if(userId)writeLifecycle({userId,lastActiveAt:Date.now()});
  }else{
    markActive();
    schedule(0);
  }
});
window.addEventListener('online',()=>{retryDelay=RETRY_INITIAL_MS;schedule(0)});
window.addEventListener('pagehide',()=>{
  const {userId}=authContext();
  if(userId)writeLifecycle({userId,lastActiveAt:Date.now()});
});

const app=document.querySelector('#app');
if(app)new MutationObserver(()=>{
  const currentBridge=document.querySelector('.intro-reference-cta[data-stage]');
  if(currentBridge)routeBridge=currentBridge;
  const {userId}=authContext();
  if(userId&&userId!==lastUser)schedule(100);
  if(completingOnboarding&&document.querySelector('[data-mood]'))schedule(650);
}).observe(app,{childList:true,subtree:true});

fastResume();
markActive();
setInterval(markActive,ACTIVE_HEARTBEAT_MS);
schedule(250);
