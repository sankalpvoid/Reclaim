import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

// Durable mood/check-in synchronization only.
// Startup, login, reload and Welcome Back routing are owned by auth-lifecycle.js.

const STATE_KEY='reclaim-state-v2';
const SESSION_KEY='reclaim-session-v1';
const LIFECYCLE_KEY='reclaim-lifecycle-v1';
const VALID_MOODS=new Set(['great','okay','struggling','craving']);
const ACTIVE_HEARTBEAT_MS=30*1000;
const RETRY_INITIAL_MS=1500;
const RETRY_MAX_MS=60000;
const nativeSetItem=Storage.prototype.setItem;
let cloudCheckins=[];
let syncing=false;
let scheduled=null;
let lastAttempt=0;
let retryDelay=RETRY_INITIAL_MS;
let lastUser='';
let completingOnboarding=false;

function readJson(key){try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}}
function safeDate(value){const date=new Date(value||0);return Number.isFinite(date.getTime())?date.toISOString():new Date().toISOString()}
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
  nativeSetItem.call(localStorage,SESSION_KEY,JSON.stringify({...session,...data,user:data.user||session.user}));
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
  const rows=await request(`/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=id,onboarding_completed`,{method:'GET'});
  return Array.isArray(rows)?rows[0]||null:null;
}
function onboardingMoodConfirmed(userId){
  const lifecycle=readJson(LIFECYCLE_KEY)||{};
  if(lifecycle.userId!==userId||!lifecycle.onboardingMoodAnsweredAt)return false;
  if(lifecycle.onboardingMoodClientId)return cloudCheckins.some(item=>item.clientId===lifecycle.onboardingMoodClientId&&item.cloudId);
  const answeredAt=Number(lifecycle.onboardingMoodAnsweredAt||0);
  return cloudCheckins.some(item=>Math.abs(new Date(item.at).getTime()-answeredAt)<=2*60*1000);
}
async function markOnboardingComplete(){
  const {userId}=authContext();
  if(!userId||!onboardingMoodConfirmed(userId))return false;
  try{
    await request(`/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`,{
      method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({onboarding_completed:true})
    });
    writeLifecycle({userId,onboardingMoodPending:false,onboardingMoodAnsweredAt:null,onboardingMoodClientId:null,onboardingCompletedAt:Date.now()});
    document.dispatchEvent(new CustomEvent('reclaim:lifecycle-profile-changed',{detail:{userId,onboardingCompleted:true}}));
    return true;
  }catch(error){console.warn('Onboarding completion sync:',error.message);return false}
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
  if(!userId||!token){lastUser='';cloudCheckins=[];retryDelay=RETRY_INITIAL_MS;return}
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
        user_id:userId,client_id:item.clientId,mood:item.mood,
        note:item.note?String(item.note).slice(0,500):null,created_at:safeDate(item.at)
      }));
      await request('/rest/v1/daily_checkins?on_conflict=user_id,client_id',{
        method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify(payload)
      });
      cloudCheckins=await fetchCloudCheckins(userId);
      current=readJson(STATE_KEY)||current;
      current.checkins=mergeCheckins(Array.isArray(current.checkins)?current.checkins:[],cloudCheckins);
      writeState(current);
    }

    if(profile&&!profile.onboarding_completed&&onboardingMoodConfirmed(userId))await markOnboardingComplete();
    retryDelay=RETRY_INITIAL_MS;
    lastUser=userId;
    pulseConsumers();
  }catch(error){
    if(!/daily_checkins|schema cache|PGRST|No signed-in session|JWT|token/i.test(error.message||''))console.warn('Daily check-in sync:',error.message);
    if(hasUnsyncedWork(userId)){
      schedule(retryDelay);
      retryDelay=Math.min(RETRY_MAX_MS,retryDelay*2);
    }
  }finally{syncing=false}
}
function schedule(delay=180){clearTimeout(scheduled);scheduled=setTimeout(syncCheckins,delay)}
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
        writeLifecycle({userId,onboardingMoodAnsweredAt:Date.now(),onboardingMoodClientId:newest?.clientId||null});
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
    setTimeout(()=>{completingOnboarding=false;schedule(0)},500);
  }
},false);
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){
    const {userId}=authContext();
    if(userId)writeLifecycle({userId,lastActiveAt:Date.now()});
  }else{markActive();schedule(0)}
});
window.addEventListener('online',()=>{retryDelay=RETRY_INITIAL_MS;schedule(0)});
window.addEventListener('pagehide',()=>{
  const {userId}=authContext();
  if(userId)writeLifecycle({userId,lastActiveAt:Date.now()});
});
const app=document.querySelector('#app');
if(app)new MutationObserver(()=>{
  const {userId}=authContext();
  if(userId&&userId!==lastUser)schedule(100);
  if(completingOnboarding&&document.querySelector('[data-mood]'))schedule(650);
}).observe(app,{childList:true,subtree:true});

markActive();
setInterval(markActive,ACTIVE_HEARTBEAT_MS);
schedule(250);
