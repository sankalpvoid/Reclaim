const STATE_KEY='reclaim-state-v2';
const SESSION_KEY='reclaim-session-v1';
const SNAPSHOT_KEY='reclaim-page-skeleton-v1';
const ROUTE_TRANSITION_KEY='reclaim-route-transition-v1';
const BUTTON_ATTR='data-manual-mood-checkin';
const ORIGINAL_HTML_ATTR='data-original-for-you-html';

function readJson(key){
  try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}
}

function isDashboardHome(){
  const state=readJson(STATE_KEY)||{};
  const session=readJson(SESSION_KEY);
  return Boolean(session?.access_token&&state.stage==='app'&&(state.view||'home')==='home');
}

function openMoodCheckin(){
  const state=readJson(STATE_KEY)||{};
  // Keep the snapshot writer disabled for the whole Home -> Mood navigation. A delayed
  // snapshot timer can otherwise run after stage='mood' is saved while the Home DOM is
  // still on screen, producing a Home-shaped snapshot that is incorrectly tagged Mood.
  try{sessionStorage.setItem(ROUTE_TRANSITION_KEY,'mood')}catch{}
  localStorage.removeItem(SNAPSHOT_KEY);
  localStorage.setItem(STATE_KEY,JSON.stringify({...state,stage:'mood',view:'home'}));
  location.reload();
}

function restoreForYou(button){
  if(!button?.hasAttribute(ORIGINAL_HTML_ATTR))return;
  const original=button.getAttribute(ORIGINAL_HTML_ATTR)||'';
  button.innerHTML=original;
  button.removeAttribute(ORIGINAL_HTML_ATTR);
  button.removeAttribute(BUTTON_ATTR);
  button.classList.remove('manual-checkin-button');
  button.setAttribute('data-for-you','');
  button.setAttribute('aria-label','Open For You');
  button.removeAttribute('title');
}

function syncButton(){
  const app=document.querySelector('#app');
  if(!app)return;

  const manual=app.querySelector(`[${BUTTON_ATTR}]`);
  if(!isDashboardHome()){
    restoreForYou(manual);
    return;
  }

  const home=app.querySelector('.home-screen,.tracking-home');
  const top=home?.querySelector('.topbar');
  if(!top)return;

  const button=top.querySelector('.checkin-trigger.for-you-trigger');
  if(!button)return;
  if(button.hasAttribute(BUTTON_ATTR))return;

  button.setAttribute(ORIGINAL_HTML_ATTR,button.innerHTML);
  button.setAttribute(BUTTON_ATTR,'');
  button.classList.add('manual-checkin-button');
  button.removeAttribute('data-for-you');
  button.setAttribute('aria-label','How are you now? Check in');
  button.setAttribute('title','How are you now?');
  button.innerHTML='<span class="material-symbols-rounded" aria-hidden="true">mood</span>';
}

let queued=false;
function queueSync(){
  if(queued)return;
  queued=true;
  queueMicrotask(()=>{queued=false;syncButton()});
}

document.addEventListener('click',event=>{
  const button=event.target.closest(`[${BUTTON_ATTR}]`);
  if(!button)return;
  event.preventDefault();
  event.stopImmediatePropagation();
  openMoodCheckin();
},true);

syncButton();
const app=document.querySelector('#app');
if(app)new MutationObserver(queueSync).observe(app,{childList:true,subtree:true});
window.addEventListener('storage',queueSync);
window.addEventListener('reclaim:reload-restored',queueSync);

// The inline boot skeleton has already rendered by the time this module executes, so it is
// safe to release the transition lock now. Future snapshots will describe the real Mood DOM.
try{sessionStorage.removeItem(ROUTE_TRANSITION_KEY)}catch{}

import './ui-polish.js?v=ui-polish-1';
