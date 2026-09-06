import './ui-polish.js';

const HERO_ART_STYLESHEET_ID='reclaim-hero-art-only';
if(!document.getElementById(HERO_ART_STYLESHEET_ID)){
  const link=document.createElement('link');
  link.id=HERO_ART_STYLESHEET_ID;
  link.rel='stylesheet';
  link.href='hero-art-only.css?v=3';
  document.head.appendChild(link);
}

/* Material Symbols are ligature text until their webfont is ready. Keep them hidden
   during that short window so names such as "home", "mood" and "payments" never flash. */
function revealMaterialSymbols(){
  document.documentElement.classList.add('reclaim-icons-ready');
}
if(document.fonts?.load){
  let settled=false;
  document.fonts.load('24px "Material Symbols Rounded"','home mood payments favorite bolt my_location')
    .then(faces=>{
      if(faces.length){settled=true;revealMaterialSymbols()}
      else return document.fonts.ready.then(()=>{settled=true;revealMaterialSymbols()});
    })
    .catch(()=>{});
  // Accessibility/usable fallback if the external font host is unavailable.
  setTimeout(()=>{if(!settled)revealMaterialSymbols()},5000);
}else{
  revealMaterialSymbols();
}

const STATE_KEY='reclaim-state-v2';
const SESSION_KEY='reclaim-session-v1';
const SNAPSHOT_KEY='reclaim-page-skeleton-v1';
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
  // Snapshot capture also runs during pagehide/visibilitychange. Mark the live Home shell
  // as an ineligible snapshot source before changing the route, otherwise that later hook
  // can save Home geometry under the mood route after an earlier clear.
  const liveShell=document.querySelector('#app .shell')||document.querySelector('#app .home-screen')||document.querySelector('#app .tracking-home');
  if(liveShell)liveShell.classList.add('reclaim-snapshot-host');
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

function currentLocalDateTimeValue(){
  const d=new Date();
  const pad=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function centerQuitPickerWheels(){
  const selects=document.querySelectorAll('.quit-picker select[data-wheel]');
  if(!selects.length)return;
  selects.forEach(select=>{
    const option=select.options[select.selectedIndex];
    if(!option)return;
    const top=option.offsetTop-(select.clientHeight-option.offsetHeight)/2;
    select.scrollTop=Math.max(0,top);
  });
}

let queued=false;
function queueSync(){
  if(queued)return;
  queued=true;
  queueMicrotask(()=>{queued=false;syncButton()});
}

document.addEventListener('click',event=>{
  const quitPickerButton=event.target.closest('[data-open-quit-picker]');
  if(quitPickerButton){
    const input=document.querySelector('#quit-at-value');
    if(input)input.value=currentLocalDateTimeValue();
    const label=document.querySelector('[data-quit-date-label]');
    if(label)label.textContent=new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date());
    // app.js creates the wheel modal later in this same click. Once it exists,
    // move each list so its selected current value is visibly centered instead
    // of showing the first option (Jan / 1 / 2006 / 01 / 00 / AM).
    requestAnimationFrame(()=>requestAnimationFrame(centerQuitPickerWheels));
  }

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
