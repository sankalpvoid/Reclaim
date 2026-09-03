import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

// Single owner for Reclaim's startup/auth routing decisions.
// app.js still renders the legacy intro first, but this module is the only compatibility
// layer allowed to decide where an authenticated user belongs after that render.

const STATE_KEY='reclaim-state-v2';
const SESSION_KEY='reclaim-session-v1';
const LIFECYCLE_KEY='reclaim-lifecycle-v1';
const RETURNING_KEY='reclaim-returning-welcome-v1';
const CHECKIN_INTERVAL_MS=2*60*60*1000;
const DAILY_PROMPT_CAP=5;
const RESTORABLE_STAGES=new Set(['app','support','mood','path','setup']);
const startupAt=Date.now();
const startupState=readJson(STATE_KEY)||{};
const startupLifecycle=readJson(LIFECYCLE_KEY)||{};
const startupNavigation=navigationType();
let handlingLogin=false;
let resolvingStartup=false;
let startupResolved=false;
let pendingRoute=null;
let routeObserver=null;

function readJson(key,storage=localStorage){try{return JSON.parse(storage.getItem(key)||'null')}catch{return null}}
function writeJson(key,value,storage=localStorage){storage.setItem(key,JSON.stringify(value))}
function decodeJwt(token=''){
  try{
    const payload=token.split('.')[1];
    if(!payload)return {};
    const normalized=payload.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(payload.length/4)*4,'=');
    return JSON.parse(atob(normalized))||{};
  }catch{return {}}
}
function authContext(session=readJson(SESSION_KEY)||{}){
  const token=session?.access_token||'';
  const claims=decodeJwt(token);
  return {session,token,userId:session?.user?.id||claims.sub||''};
}
function navigationType(){return performance.getEntriesByType?.('navigation')?.[0]?.type||'navigate'}
function localDay(value){const date=new Date(value||Date.now());if(!Number.isFinite(date.getTime()))return '';const pad=n=>String(n).padStart(2,'0');return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`}
function setStateRoute(stage,view=null){
  const state=readJson(STATE_KEY)||{};
  state.stage=stage;
  if(view)state.view=view;
  writeJson(STATE_KEY,state);
}
function normalizeLifecycleOwner(userId){
  if(!userId)return;
  const lifecycle=readJson(LIFECYCLE_KEY)||{};
  if(lifecycle.userId&&lifecycle.userId!==userId)writeJson(LIFECYCLE_KEY,{userId,lastActiveAt:0});
}
function showError(form,message){
  let node=form.querySelector('[data-auth-lifecycle-error]');
  if(!node){node=document.createElement('p');node.dataset.authLifecycleError='';node.className='muted small';node.style.marginTop='10px';form.appendChild(node)}
  node.textContent=message||'Login failed. Please try again.';
}
async function parseResponse(response){
  const text=await response.text();
  let data=null;try{data=text?JSON.parse(text):null}catch{data=text}
  if(!response.ok)throw new Error(data?.msg||data?.message||data?.error_description||data?.hint||`Request failed (${response.status})`);
  return data;
}
async function authedGet(path,token){
  return parseResponse(await fetch(`${SUPABASE_URL}${path}`,{headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${token}`,'Content-Type':'application/json'}}));
}
async function refreshSession(session){
  if(!session?.refresh_token)throw new Error('Your session ended. Please sign in again.');
  const data=await parseResponse(await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,{
    method:'POST',headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token})
  }));
  const next={...session,...data,user:data.user||session.user};
  writeJson(SESSION_KEY,next);
  return next;
}
async function lifecycleData(session){
  let active=session;
  let {token,userId}=authContext(active);
  if(!token||!userId)throw new Error('No signed-in session');
  const fetchData=async()=>Promise.all([
    authedGet(`/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=display_name,onboarding_completed,journey_mode,quit_date&limit=1`,token),
    authedGet(`/rest/v1/daily_checkins?user_id=eq.${encodeURIComponent(userId)}&select=created_at&order=created_at.desc&limit=8`,token)
  ]);
  let result;
  try{result=await fetchData()}
  catch(error){
    if(!active?.refresh_token)throw error;
    active=await refreshSession(active);
    ({token,userId}=authContext(active));
    result=await fetchData();
  }
  const [profiles,checkins]=result;
  return {session:active,userId,profile:Array.isArray(profiles)?profiles[0]||null:null,checkins:Array.isArray(checkins)?checkins:[]};
}
function automaticCheckinDue(checkins=[]){
  const latest=checkins[0]||null;
  const latestAt=latest?.created_at?new Date(latest.created_at).getTime():0;
  const todayCount=checkins.filter(item=>localDay(item?.created_at)===localDay(startupAt)).length;
  if(todayCount>=DAILY_PROMPT_CAP)return false;
  if(!latestAt)return true;
  return startupAt-latestAt>=CHECKIN_INTERVAL_MS;
}
function recentActivityFor(userId){
  if(!userId||startupLifecycle.userId!==userId)return false;
  const lastActive=Number(startupLifecycle.lastActiveAt||0);
  return lastActive>0&&startupAt-lastActive<CHECKIN_INTERVAL_MS;
}
function onboardingRoute(){
  const state=readJson(STATE_KEY)||startupState||{};
  const lifecycle=readJson(LIFECYCLE_KEY)||{};
  const {userId}=authContext();
  const pendingMood=Boolean(userId&&lifecycle.userId===userId&&lifecycle.onboardingMoodPending);
  if(state.stage==='setup')return {stage:'setup',view:state.view||'home'};
  if(state.stage==='mood'&&pendingMood)return {stage:'mood',view:state.view||'home'};
  if(state.stage==='path')return {stage:'path',view:state.view||'home'};
  return {stage:'path',view:'home'};
}
function completedRoute(userId,checkins,{login=false}={}){
  if(login){
    if(!automaticCheckinDue(checkins))return {stage:'app',view:'home'};
    return {stage:'welcome',view:'home'};
  }
  if(startupNavigation==='reload'){
    const saved=RESTORABLE_STAGES.has(startupState.stage)?startupState.stage:'app';
    return {stage:saved,view:startupState.view||'home',preserveReload:true};
  }
  if(recentActivityFor(userId)||!automaticCheckinDue(checkins)){
    const saved=['app','support'].includes(startupState.stage)?startupState.stage:'app';
    return {stage:saved,view:startupState.view||'home'};
  }
  return {stage:'welcome',view:'home'};
}
function storeWelcome(userId,profile){
  sessionStorage.setItem(RETURNING_KEY,JSON.stringify({
    userId,
    name:profile?.display_name||'',
    journeyMode:profile?.journey_mode||'',
    quitAt:profile?.quit_date||'',
    createdAt:Date.now()
  }));
}
function clearWelcome(){sessionStorage.removeItem(RETURNING_KEY)}
function pendingWelcomeFor(userId){
  const payload=readJson(RETURNING_KEY,sessionStorage);
  if(!payload)return false;
  const valid=payload.userId===userId&&Date.now()-Number(payload.createdAt||0)<=10*60*1000;
  if(!valid)clearWelcome();
  return valid;
}
function clickLegacyBridge(stage,view=null){
  const bridge=document.querySelector('.intro-reference-cta[data-stage]');
  if(!bridge)return false;
  if(view){const state=readJson(STATE_KEY)||{};state.view=view;writeJson(STATE_KEY,state)}
  bridge.dataset.stage=stage;
  bridge.click();
  document.dispatchEvent(new CustomEvent('reclaim:lifecycle-routed',{detail:{stage,view:view||null}}));
  return true;
}
function routeWhenReady(stage,view=null){
  if(stage==='welcome')return false;
  setStateRoute(stage,view);
  if(clickLegacyBridge(stage,view)){pendingRoute=null;return true}
  pendingRoute={stage,view};
  if(routeObserver)return false;
  const app=document.querySelector('#app');
  if(!app)return false;
  routeObserver=new MutationObserver(()=>{
    if(!pendingRoute)return;
    if(clickLegacyBridge(pendingRoute.stage,pendingRoute.view)){
      pendingRoute=null;
      routeObserver.disconnect();
      routeObserver=null;
    }
  });
  routeObserver.observe(app,{childList:true,subtree:true});
  setTimeout(()=>{routeObserver?.disconnect();routeObserver=null},3000);
  return false;
}
async function resolveStartup(){
  if(resolvingStartup||startupResolved)return;
  const {session,token,userId}=authContext();
  if(!session||!token||!userId)return;
  resolvingStartup=true;
  normalizeLifecycleOwner(userId);
  try{
    const data=await lifecycleData(session);
    if(!data.profile){startupResolved=true;return}
    let route;
    const existingWelcome=pendingWelcomeFor(data.userId);
    if(!data.profile.onboarding_completed){clearWelcome();route=onboardingRoute()}
    else if(existingWelcome)route={stage:'welcome',view:'home'};
    else route=completedRoute(data.userId,data.checkins);

    if(route.stage==='welcome'){
      setStateRoute('intro','home');
      if(!existingWelcome)storeWelcome(data.userId,data.profile);
      const app=document.querySelector('#app');
      if(app){const marker=document.createComment('welcome-ready');app.appendChild(marker);marker.remove()}
    }else{
      clearWelcome();
      routeWhenReady(route.stage,route.view);
    }
    startupResolved=true;
  }catch(error){
    // Local reload restoration remains available even when cloud is temporarily unreachable.
    console.warn('Lifecycle startup:',error.message);
  }finally{resolvingStartup=false}
}

// Literal reloads should feel instant. Restore the exact saved stage immediately,
// then let the cloud resolution above validate it without forcing an extra prompt.
(function restoreLiteralReload(){
  const {token,userId}=authContext();
  if(startupNavigation!=='reload'||!token||!userId)return;
  normalizeLifecycleOwner(userId);
  if(!RESTORABLE_STAGES.has(startupState.stage))return;
  routeWhenReady(startupState.stage,startupState.view||'home');
})();

// Password LOGIN is intercepted here so app.js never gets to apply its legacy "login -> mood" rule.
document.addEventListener('submit',async event=>{
  const form=event.target;
  if(!(form instanceof HTMLFormElement)||form.id!=='auth-form')return;
  if(form.querySelector('input[name="name"]'))return;
  if(handlingLogin)return;

  event.preventDefault();
  event.stopImmediatePropagation();
  handlingLogin=true;
  const submit=form.querySelector('button[type="submit"],button:not([type])');
  if(submit)submit.disabled=true;
  try{
    const fields=Object.fromEntries(new FormData(form));
    const email=String(fields.email||'').trim().toLowerCase();
    const password=String(fields.password||'');
    if(!email||!password)throw new Error('Enter your email and password.');

    const session=await parseResponse(await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`,{
      method:'POST',headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json'},body:JSON.stringify({email,password})
    }));
    if(!session?.access_token)throw new Error('Login failed. Please try again.');
    const user=session.user||await authedGet('/auth/v1/user',session.access_token);
    const savedSession={...session,user};
    writeJson(SESSION_KEY,savedSession);
    normalizeLifecycleOwner(user.id);

    const data=await lifecycleData(savedSession);
    clearWelcome();
    let route;
    if(!data.profile?.onboarding_completed)route=onboardingRoute();
    else route=completedRoute(data.userId,data.checkins,{login:true});

    if(route.stage==='welcome'){
      setStateRoute('intro','home');
      storeWelcome(data.userId,data.profile);
    }else setStateRoute(route.stage,route.view);
    location.reload();
  }catch(error){
    showError(form,error.message);
    if(submit)submit.disabled=false;
    handlingLogin=false;
  }
},true);

// Re-resolve when another subsystem changes durable lifecycle state (e.g. onboarding completes).
document.addEventListener('reclaim:lifecycle-profile-changed',()=>{
  startupResolved=false;
  resolveStartup();
});

// app.js is loaded after this module. Its first render gives us the legacy bridge to route through.
const app=document.querySelector('#app');
if(app){
  new MutationObserver(()=>{
    if(pendingRoute)routeWhenReady(pendingRoute.stage,pendingRoute.view);
    if(!startupResolved)resolveStartup();
  }).observe(app,{childList:true,subtree:true});
}
resolveStartup();
