import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

const STATE_KEY='reclaim-state-v2';
const SESSION_KEY='reclaim-session-v1';
const VALID_MOODS=new Set(['great','okay','struggling','craving']);
const CHECKIN_INTERVAL_MS=2*60*60*1000;
const DAILY_PROMPT_CAP=5;
const nativeSetItem=Storage.prototype.setItem;
let cloudCheckins=[];
let syncing=false;
let scheduled=null;
let lastAttempt=0;
let lastUser='';
let routeBridge=document.querySelector('.intro-reference-cta[data-stage]');
let completingOnboarding=false;
let justCompletedOnboarding=false;
let welcomeForUser='';

function readJson(key){try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}}
function safeDate(value){const date=new Date(value||0);return Number.isFinite(date.getTime())?date.toISOString():new Date().toISOString()}
function localDay(value){const date=new Date(value||Date.now());if(!Number.isFinite(date.getTime()))return '';const pad=n=>String(n).padStart(2,'0');return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`}
function escapeHtml(value=''){return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]))}
function navigationType(){return performance.getEntriesByType?.('navigation')?.[0]?.type||'navigate'}
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

// Preserve cloud-hydrated check-ins when the legacy app writes its in-memory state back
// to localStorage. This can be removed once check-ins are integrated directly into app.js.
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

async function request(path,options={}){
  const {token}=authContext();
  if(!token)throw new Error('No signed-in session');
  const response=await fetch(`${SUPABASE_URL}${path}`,{
    ...options,
    headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${token}`,'Content-Type':'application/json',...(options.headers||{})}
  });
  const text=await response.text();
  let data=null;try{data=text?JSON.parse(text):null}catch{data=text}
  if(!response.ok)throw new Error(data?.message||data?.hint||data?.error||`Check-in sync failed (${response.status})`);
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
async function markOnboardingComplete(){
  const {userId}=authContext();
  if(!userId)return;
  try{
    await request(`/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`,{
      method:'PATCH',
      headers:{Prefer:'return=minimal'},
      body:JSON.stringify({onboarding_completed:true})
    });
    justCompletedOnboarding=true;
  }catch(error){console.warn('Onboarding completion sync:',error.message)}
}
function restoreReload(state,profile){
  if(navigationType()!=='reload')return false;
  if(!profile?.onboarding_completed)return false;
  if(!document.querySelector('.intro-reference-cta[data-stage]'))return false;
  const saved=state?.stage;
  const allowed=new Set(['app','support','mood','path','setup']);
  return routeTo(allowed.has(saved)?saved:'app');
}
function applyLifecycle(profile,state,userId){
  const introVisible=!!document.querySelector('.intro-reference-cta[data-stage]');
  const moodVisible=!!document.querySelector('[data-mood]');
  if(!profile)return;

  if(!profile.onboarding_completed){
    // A new account keeps the original one-time flow: Begin Journey -> path -> setup -> mood.
    if(introVisible){
      const saved=state?.stage;
      routeTo(['path','setup','mood'].includes(saved)?saved:'path');
    }
    return;
  }

  if(justCompletedOnboarding&&moodVisible){
    // The first mood check after setup is part of onboarding, not a returning-user prompt.
    justCompletedOnboarding=false;
    return;
  }

  if(restoreReload(state,profile))return;

  // Do not interrupt someone who is already using the app. The interval rule is only
  // evaluated on a genuine return/login, never because the page re-rendered.
  if(!introVisible&&!moodVisible)return;

  const due=checkinIsDue(state.checkins||[]);
  if(!due){routeTo('app');return}
  renderWelcome(profile,state,userId);
}

async function syncCheckins(){
  const now=Date.now();
  if(syncing)return;
  if(now-lastAttempt<1200){schedule(Math.max(80,1250-(now-lastAttempt)));return}
  lastAttempt=now;
  const {userId,token}=authContext();
  if(!userId||!token){lastUser='';cloudCheckins=[];welcomeForUser='';return}
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
      // Check-ins are append-only. Ignore duplicate client IDs rather than updating them,
      // so the browser only needs the SELECT + INSERT privileges intentionally granted.
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
    lastUser=userId;
    pulseConsumers();
    applyLifecycle(profile,current,userId);
  }catch(error){
    if(!/daily_checkins|schema cache|PGRST|No signed-in session|JWT|token/i.test(error.message||''))console.warn('Daily check-in sync:',error.message);
  }finally{syncing=false}
}

function schedule(delay=180){
  clearTimeout(scheduled);
  scheduled=setTimeout(syncCheckins,delay);
}

document.addEventListener('click',event=>{
  if(event.target.closest('[data-mood], [data-quick-mood]'))setTimeout(()=>schedule(0),0);
},false);
document.addEventListener('submit',event=>{
  if(event.target?.id==='auth-form')setTimeout(()=>schedule(350),0);
  if(event.target?.id==='setup-form'){
    completingOnboarding=true;
    setTimeout(async()=>{
      await markOnboardingComplete();
      completingOnboarding=false;
      schedule(0);
    },500);
  }
},false);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule(0)});
window.addEventListener('online',()=>schedule(0));

const app=document.querySelector('#app');
if(app)new MutationObserver(()=>{
  const currentBridge=document.querySelector('.intro-reference-cta[data-stage]');
  if(currentBridge)routeBridge=currentBridge;
  const {userId}=authContext();
  if(userId&&userId!==lastUser)schedule(100);
  if(completingOnboarding&&document.querySelector('[data-mood]'))schedule(650);
}).observe(app,{childList:true,subtree:true});

schedule(250);
