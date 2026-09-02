import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

const STATE_KEY='reclaim-state-v2';
const SESSION_KEY='reclaim-session-v1';
const CHECKIN_INTERVAL_MS=2*60*60*1000;
let handling=false;

function readJson(key){try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}}
function writeJson(key,value){localStorage.setItem(key,JSON.stringify(value))}
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
function setStage(stage,view='home'){
  const state=readJson(STATE_KEY)||{};
  state.stage=stage;
  if(view)state.view=view;
  writeJson(STATE_KEY,state);
}
async function chooseLoginStage(token,userId){
  const [profiles,checkins]=await Promise.all([
    authedGet(`/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=onboarding_completed&limit=1`,token),
    authedGet(`/rest/v1/daily_checkins?user_id=eq.${encodeURIComponent(userId)}&select=created_at&order=created_at.desc&limit=1`,token)
  ]);
  const profile=Array.isArray(profiles)?profiles[0]:null;
  if(!profile?.onboarding_completed)return 'path';
  const latest=Array.isArray(checkins)?checkins[0]:null;
  const latestAt=latest?.created_at?new Date(latest.created_at).getTime():0;
  if(latestAt&&Date.now()-latestAt<CHECKIN_INTERVAL_MS)return 'app';
  return 'intro';
}

// Intercept only password LOGIN submissions. Signup still belongs to app.js.
document.addEventListener('submit',async event=>{
  const form=event.target;
  if(!(form instanceof HTMLFormElement)||form.id!=='auth-form')return;
  if(form.querySelector('input[name="name"]'))return;
  if(handling)return;

  event.preventDefault();
  event.stopImmediatePropagation();
  handling=true;
  const submit=form.querySelector('button[type="submit"],button:not([type])');
  if(submit)submit.disabled=true;
  try{
    const fields=Object.fromEntries(new FormData(form));
    const email=String(fields.email||'').trim().toLowerCase();
    const password=String(fields.password||'');
    if(!email||!password)throw new Error('Enter your email and password.');

    const session=await parseResponse(await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`,{
      method:'POST',
      headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({email,password})
    }));
    if(!session?.access_token)throw new Error('Login failed. Please try again.');

    const user=session.user||await authedGet('/auth/v1/user',session.access_token);
    const savedSession={...session,user};
    writeJson(SESSION_KEY,savedSession);

    const nextStage=await chooseLoginStage(session.access_token,user.id);
    if(nextStage==='app')setStage('app','home');
    else if(nextStage==='path')setStage('path','home');
    else setStage('intro','home');

    // Reload after writing the resolved stage. The existing reload bootstrap preserves it,
    // while checkin-sync handles due returning users from the intro stage.
    location.reload();
  }catch(error){
    showError(form,error.message);
    if(submit)submit.disabled=false;
    handling=false;
  }
},true);
