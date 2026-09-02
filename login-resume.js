import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

// Compatibility layer for the legacy app.js login transition.
// app.js still routes every successful password login to mood. For completed users,
// this module observes the actual session write and resolves the route from cloud data
// before that legacy transition can become the durable state.

const STATE_KEY='reclaim-state-v2';
const SESSION_KEY='reclaim-session-v1';
const CHECKIN_INTERVAL_MS=2*60*60*1000;
const LOGIN_ATTEMPT_KEY='reclaim-login-attempt-v2';
const previousSetItem=Storage.prototype.setItem;
let reconciling=false;
let lastSessionSignature='';

function readJson(key){
  try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}
}

function decodeJwt(token=''){
  try{
    const payload=token.split('.')[1];
    if(!payload)return {};
    const normalized=payload.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(payload.length/4)*4,'=');
    return JSON.parse(atob(normalized))||{};
  }catch{return {}}
}

function authContext(session=readJson(SESSION_KEY)||{}){
  const token=session.access_token||'';
  const claims=decodeJwt(token);
  return {token,userId:session.user?.id||claims.sub||'',signature:`${claims.sub||session.user?.id||''}:${claims.iat||''}:${claims.exp||''}`};
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
  previousSetItem.call(localStorage,STATE_KEY,JSON.stringify(state));
}

function activeLoginAttempt(){return sessionStorage.getItem(LOGIN_ATTEMPT_KEY)||''}
function beginLoginAttempt(){
  const id=crypto.randomUUID();
  sessionStorage.setItem(LOGIN_ATTEMPT_KEY,id);
  return id;
}
function finishLoginAttempt(id){
  if(activeLoginAttempt()===id)sessionStorage.removeItem(LOGIN_ATTEMPT_KEY);
}

async function reconcileCompletedLogin(sessionValue=null,attemptId=activeLoginAttempt()){
  if(!attemptId||reconciling)return false;
  const session=sessionValue&&typeof sessionValue==='object'?sessionValue:readJson(SESSION_KEY)||{};
  const {token,userId,signature}=authContext(session);
  if(!token||!userId)return false;
  if(signature&&signature===lastSessionSignature)return false;
  reconciling=true;
  if(signature)lastSessionSignature=signature;
  try{
    const [profileRows,checkinRows]=await Promise.all([
      request(`/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=onboarding_completed&limit=1`,token),
      request(`/rest/v1/daily_checkins?user_id=eq.${encodeURIComponent(userId)}&select=created_at&order=created_at.desc&limit=1`,token)
    ]);
    const profile=Array.isArray(profileRows)?profileRows[0]:null;
    if(!profile?.onboarding_completed){finishLoginAttempt(attemptId);return false}

    const latest=Array.isArray(checkinRows)?checkinRows[0]:null;
    const latestAt=latest?.created_at?new Date(latest.created_at).getTime():0;
    const recent=latestAt>0&&Date.now()-latestAt<CHECKIN_INTERVAL_MS;
    if(!recent){finishLoginAttempt(attemptId);return false}

    persistAppStage();
    finishLoginAttempt(attemptId);
    location.reload();
    return true;
  }catch(error){
    // Keep the login attempt alive so the fallback poll can retry transient failures.
    lastSessionSignature='';
    console.warn('Login resume:',error.message);
    return false;
  }finally{
    reconciling=false;
  }
}

// Observe the exact moment app.js writes a successful Supabase session. This removes
// the old fixed-duration race: slow logins are handled just as reliably as fast ones.
Storage.prototype.setItem=function(key,value){
  const result=previousSetItem.call(this,key,value);
  if(this===localStorage&&key===SESSION_KEY&&activeLoginAttempt()){
    let parsed=null;try{parsed=JSON.parse(String(value))}catch{}
    if(parsed?.access_token)setTimeout(()=>reconcileCompletedLogin(parsed),0);
  }
  return result;
};

function waitForSession(attemptId,attempt=0){
  if(activeLoginAttempt()!==attemptId)return;
  const session=readJson(SESSION_KEY)||{};
  if(session.access_token){
    reconcileCompletedLogin(session,attemptId);
    return;
  }
  if(attempt<200)setTimeout(()=>waitForSession(attemptId,attempt+1),100);
  else finishLoginAttempt(attemptId);
}

document.addEventListener('submit',event=>{
  if(event.target?.id!=='auth-form')return;
  const primary=event.target.querySelector('button.primary');
  const isLogin=/LOG IN/i.test(primary?.textContent||'');
  if(!isLogin)return;
  const attemptId=beginLoginAttempt();
  setTimeout(()=>waitForSession(attemptId,0),0);
},true);
