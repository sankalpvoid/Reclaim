import './ui-polish.js';

const HERO_ART_STYLESHEET_ID='reclaim-hero-art-only';
if(!document.getElementById(HERO_ART_STYLESHEET_ID)){
  const link=document.createElement('link');
  link.id=HERO_ART_STYLESHEET_ID;
  link.rel='stylesheet';
  link.href='hero-art-only.css?v=3';
  document.head.appendChild(link);
}

function revealMaterialSymbols(){document.documentElement.classList.add('reclaim-icons-ready')}
if(document.fonts?.load){let settled=false;document.fonts.load('24px "Material Symbols Rounded"','home mood payments favorite bolt my_location').then(faces=>{if(faces.length){settled=true;revealMaterialSymbols()}else return document.fonts.ready.then(()=>{settled=true;revealMaterialSymbols()})}).catch(()=>{});setTimeout(()=>{if(!settled)revealMaterialSymbols()},5000)}else revealMaterialSymbols();

const STATE_KEY='reclaim-state-v2',SESSION_KEY='reclaim-session-v1',SNAPSHOT_KEY='reclaim-page-skeleton-v1',BUTTON_ATTR='data-manual-mood-checkin',ORIGINAL_HTML_ATTR='data-original-for-you-html';
function readJson(key){try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}}
function isDashboardHome(){const state=readJson(STATE_KEY)||{},session=readJson(SESSION_KEY);return Boolean(session?.access_token&&state.stage==='app'&&(state.view||'home')==='home')}
function openMoodCheckin(){const state=readJson(STATE_KEY)||{},liveShell=document.querySelector('#app .shell')||document.querySelector('#app .home-screen')||document.querySelector('#app .tracking-home');if(liveShell)liveShell.classList.add('reclaim-snapshot-host');localStorage.removeItem(SNAPSHOT_KEY);localStorage.setItem(STATE_KEY,JSON.stringify({...state,stage:'mood',view:'home'}));location.reload()}
function restoreForYou(button){if(!button?.hasAttribute(ORIGINAL_HTML_ATTR))return;button.innerHTML=button.getAttribute(ORIGINAL_HTML_ATTR)||'';button.removeAttribute(ORIGINAL_HTML_ATTR);button.removeAttribute(BUTTON_ATTR);button.classList.remove('manual-checkin-button');button.setAttribute('data-for-you','');button.setAttribute('aria-label','Open For You');button.removeAttribute('title')}
function syncButton(){const app=document.querySelector('#app');if(!app)return;const manual=app.querySelector(`[${BUTTON_ATTR}]`);if(!isDashboardHome()){restoreForYou(manual);return}const home=app.querySelector('.home-screen,.tracking-home'),top=home?.querySelector('.topbar'),button=top?.querySelector('.checkin-trigger.for-you-trigger');if(!button||button.hasAttribute(BUTTON_ATTR))return;button.setAttribute(ORIGINAL_HTML_ATTR,button.innerHTML);button.setAttribute(BUTTON_ATTR,'');button.classList.add('manual-checkin-button');button.removeAttribute('data-for-you');button.setAttribute('aria-label','How are you now? Check in');button.setAttribute('title','How are you now?');button.innerHTML='<span class="material-symbols-rounded" aria-hidden="true">mood</span>'}

function currentLocalDateTimeValue(date=new Date()){
  const pad=n=>String(n).padStart(2,'0');
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function closeReliableQuitPicker(){document.querySelector('.reliable-quit-picker-modal')?.remove()}

function openReliableQuitPicker(){
  closeReliableQuitPicker();
  const hidden=document.querySelector('#quit-at-value');
  const label=document.querySelector('[data-quit-date-label]');
  if(!hidden||!label)return;

  const now=new Date();
  const nowValue=currentLocalDateTimeValue(now);
  const modal=document.createElement('div');
  modal.className='reliable-quit-picker-modal';
  modal.innerHTML=`
    <div class="reliable-quit-picker-card" role="dialog" aria-modal="true" aria-labelledby="reliable-quit-title">
      <button type="button" class="reliable-quit-close" aria-label="Close">×</button>
      <div class="reliable-quit-eyebrow">QUIT DATE AND TIME</div>
      <h2 id="reliable-quit-title">WHEN DID YOUR<br>RECLAIM BEGIN?</h2>
      <p>Choose the moment your live calculations begin.</p>
      <label class="reliable-quit-field-label" for="reliable-quit-datetime">DATE & TIME</label>
      <input id="reliable-quit-datetime" class="reliable-quit-datetime" type="datetime-local" step="60" value="${nowValue}" max="${nowValue}">
      <small class="reliable-quit-note">Future dates and times are not allowed.</small>
      <button type="button" class="reliable-quit-apply">SET THIS MOMENT</button>
    </div>`;
  document.body.appendChild(modal);

  const picker=modal.querySelector('#reliable-quit-datetime');
  const close=()=>closeReliableQuitPicker();
  modal.querySelector('.reliable-quit-close').onclick=close;
  modal.addEventListener('click',event=>{if(event.target===modal)close()});
  modal.querySelector('.reliable-quit-apply').onclick=()=>{
    const chosen=new Date(picker.value);
    if(!picker.value||Number.isNaN(chosen.getTime()))return;
    if(chosen.getTime()>Date.now()){
      picker.value=currentLocalDateTimeValue(new Date());
      picker.max=picker.value;
      return;
    }
    hidden.value=picker.value;
    hidden.dispatchEvent(new Event('input',{bubbles:true}));
    hidden.dispatchEvent(new Event('change',{bubbles:true}));
    label.textContent=new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(chosen);
    close();
  };
}

let queued=false;function queueSync(){if(queued)return;queued=true;queueMicrotask(()=>{queued=false;syncButton()})}

document.addEventListener('click',event=>{
  const quitPickerButton=event.target.closest('[data-open-quit-picker]');
  if(quitPickerButton){
    event.preventDefault();
    event.stopImmediatePropagation();
    openReliableQuitPicker();
    return;
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
