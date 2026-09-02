import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

// Compatibility layer for the legacy app.js login transition.
// app.js currently sends every successful password login to the mood screen.
// This module corrects only completed users whose most recent cloud mood is still
// inside the check-in interval. New/incomplete users continue through onboarding.

const STATE_KEY='reclaim-state-v2';
const SESSION_KEY='reclaim-session-v1';
const CHECKIN_INTERVAL_MS=2*60*60*1000;
const RELOAD_GUARD_KEY='reclaim-login-resume-guard-v1';

function readJson(key){
  try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}
}

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
  const token=session.access_token||'';
  return {token,userId:session.user?.id||decodeSub(token)};
}

async function request(path,token){
  const response=await fetch(`${SUPABASE_URL}${path}`,{
    method:'GET',
    headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${token}`,'Content-Type':'application/json'}
  });
  const text=await response.text();
  let data=null;try{data=text?JSON.parse(text):null}catch{data=text}
  if(!response.ok)throw new Error(data?.message||data?.hint||data?.error||`Login resume failed (${response.status})`);
  return data;
}

function persistAppStage(){
  const state=readJson(STATE_KEY)||{};
  state.stage='app';
  state.view='home';
  localStorage.setItem(STATE_KEY,JSON.stringify(state));
}

function guardKey(userId){return `${userId}:${Math.floor(Date.now()/60000)}`}

async function reconcileCompletedLogin(){
  const {token,userId}=authContext();
  if(!token||!userId)return false;

  const profileRows=await request(`/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=onboarding_completed&limit=1`,token);
  const profile=Array.isArray(profileRows)?profileRows[0]:null;
  if(!profile?.onboarding_completed)return false;

  const checkinRows=await request(`/rest/v1/daily_checkins?user_id=eq.${encodeURIComponent(userId)}&select=created_at&order=created_at.desc&limit=1`,token);
  const latest=Array.isArray(checkinRows)?checkinRows[0]:null;
  const latestAt=latest?.created_at?new Date(latest.created_at).getTime():0;
  if(!latestAt||Date.now()-latestAt>=CHECKIN_INTERVAL_MS)return false;

  const guard=guardKey(userId);
  if(sessionStorage.getItem(RELOAD_GUARD_KEY)===guard)return false;

  persistAppStage();
  sessionStorage.setItem(RELOAD_GUARD_KEY,guard);
  location.reload();
  return true;
}

function waitForSession(attempt=0){
  const {token}=authContext();
  if(token){
    reconcileCompletedLogin().catch(error=>console.warn('Login resume:',error.message));
    return;
  }
  if(attempt<30)setTimeout(()=>waitForSession(attempt+1),100);
}

// Capture the intent before app.js replaces the auth screen. The actual reconciliation
// waits until the successful Supabase session has been written to localStorage.
document.addEventListener('submit',event=>{
  if(event.target?.id!=='auth-form')return;
  setTimeout(()=>waitForSession(0),0);
},true);
