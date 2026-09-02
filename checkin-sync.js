import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

const STATE_KEY='reclaim-state-v2';
const SESSION_KEY='reclaim-session-v1';
const VALID_MOODS=new Set(['great','okay','struggling','craving']);
const nativeSetItem=Storage.prototype.setItem;
let cloudCheckins=[];
let syncing=false;
let scheduled=null;
let lastAttempt=0;
let lastUser='';

function readJson(key){try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}}
function safeDate(value){const date=new Date(value||0);return Number.isFinite(date.getTime())?date.toISOString():new Date().toISOString()}
function localDay(value){const date=new Date(value||Date.now());if(!Number.isFinite(date.getTime()))return '';const pad=n=>String(n).padStart(2,'0');return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`}
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
function resumeSignedInJourney(){
  const {userId,token}=authContext();
  if(!userId||!token)return;
  const begin=document.querySelector('.intro-reference-cta[data-stage]');
  if(!begin)return;
  const state=readJson(STATE_KEY)||{};
  const today=localDay(Date.now());
  const checkedInToday=(Array.isArray(state.checkins)?state.checkins:[]).some(item=>VALID_MOODS.has(item?.mood)&&localDay(item.at||item.created_at)===today);
  begin.dataset.stage=checkedInToday?'app':'mood';
  begin.click();
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

async function syncCheckins(){
  const now=Date.now();
  if(syncing)return;
  if(now-lastAttempt<1200){schedule(Math.max(80,1250-(now-lastAttempt)));return}
  lastAttempt=now;
  const {userId,token}=authContext();
  if(!userId||!token){lastUser='';cloudCheckins=[];return}
  syncing=true;
  try{
    const state=readJson(STATE_KEY)||{};
    if(ensureClientIds(state))writeState(state);

    cloudCheckins=await fetchCloudCheckins(userId);

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
      // Ignore duplicates rather than merging them. This keeps check-ins append-only and
      // only requires the SELECT + INSERT permissions granted by the foundation migration.
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
    resumeSignedInJourney();
  }catch(error){
    // The app remains local-first if the database upgrade has not been applied or the
    // session has expired. A later navigation/visibility change will retry.
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
},false);

document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule(0)});
window.addEventListener('online',()=>schedule(0));

const app=document.querySelector('#app');
if(app)new MutationObserver(()=>{
  const {userId}=authContext();
  if(userId&&userId!==lastUser)schedule(100);
}).observe(app,{childList:true,subtree:true});

schedule(250);
