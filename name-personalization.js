import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

const STORAGE='reclaim-state-v2', SESSION='reclaim-session-v1';
let cachedName='';

function read(key){try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}}
function cleanFirst(raw=''){return String(raw).trim().split(/\s+/)[0]||''}
function localName(){
  const state=read(STORAGE)||{}, session=read(SESSION)||{}, meta=session?.user?.user_metadata||{};
  const emailName=String(session?.user?.email||'').split('@')[0].replace(/[._-]+/g,' ').trim();
  return cleanFirst(state?.profile?.name||meta.display_name||meta.full_name||meta.name||emailName||'');
}
async function resolveName(){
  const immediate=localName();if(immediate)return immediate;
  const session=read(SESSION)||{},token=session?.access_token;if(!token)return '';
  const headers={apikey:SUPABASE_KEY,Authorization:`Bearer ${token}`};
  try{
    const userRes=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers});
    if(userRes.ok){
      const user=await userRes.json(),meta=user?.user_metadata||{};
      const fromUser=cleanFirst(meta.display_name||meta.full_name||meta.name||String(user?.email||'').split('@')[0].replace(/[._-]+/g,' '));
      if(fromUser)return fromUser;
      if(user?.id){
        const profileRes=await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=display_name`,{headers:{...headers,Accept:'application/json'}});
        if(profileRes.ok){const rows=await profileRes.json();const fromProfile=cleanFirst(rows?.[0]?.display_name);if(fromProfile)return fromProfile}
      }
    }
  }catch{}
  return '';
}
function greeting(){const h=new Date().getHours();return h<12?'GOOD MORNING':h<17?'GOOD AFTERNOON':'GOOD EVENING'}
function addMoodName(name){
  const screen=document.querySelector('#app > .shell .screen.full');if(!screen)return;
  const h1=screen.querySelector('h1');if(!h1||!h1.textContent.includes('HOW ARE'))return;
  const p=screen.querySelector('h1 + p.muted');
  if(p)p.innerHTML=`${name}, your journey matters.<br>Let's keep going.`;
}
function addHomeName(name){
  const hero=document.querySelector('.home-screen .home-hero-copy');if(!hero)return;
  let el=hero.querySelector('.name-greeting');if(!el){el=document.createElement('div');el.className='name-greeting';hero.prepend(el)}
  el.textContent=`${greeting()}, ${name.toUpperCase()}.`;
}
function addSupportName(name){
  const screen=document.querySelector('.struggling-support');if(!screen)return;
  const heading=screen.querySelector('h1');
  if(heading)heading.innerHTML=`TODAY<br>FEELS HARD, ${name.toUpperCase()}.`;
}
function apply(name){if(!name)return;addMoodName(name);addHomeName(name);addSupportName(name)}
async function personalize(){
  const local=localName();if(local){cachedName=local;apply(local);return}
  if(cachedName){apply(cachedName);return}
  const resolved=await resolveName();if(resolved){cachedName=resolved;apply(resolved)}
}
function schedule(){requestAnimationFrame(()=>requestAnimationFrame(personalize));setTimeout(personalize,150)}
function start(){
  const app=document.querySelector('#app');
  if(app)new MutationObserver(schedule).observe(app,{childList:true});
  schedule();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule()});
