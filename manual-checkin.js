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

function currentLocalDateTimeValue(date=new Date()){const pad=n=>String(n).padStart(2,'0');return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`}
function wheel(name){return document.querySelector(`.quit-picker select[data-wheel="${name}"]`)}
function setWheelValue(name,value){const select=wheel(name);if(!select)return;const index=Array.from(select.options).findIndex(option=>option.value===String(value));if(index<0)return;select.selectedIndex=index;select.value=String(value)}
function selectedQuitDate(){const month=+wheel('month')?.value,day=+wheel('day')?.value,year=+wheel('year')?.value,minute=+wheel('minute')?.value,period=wheel('period')?.value;let hour=+wheel('hour')?.value%12;if(period==='PM')hour+=12;if(!Number.isFinite(year)||!Number.isFinite(month)||!Number.isFinite(day)||!Number.isFinite(hour)||!Number.isFinite(minute))return null;return new Date(year,month,day,hour,minute,0,0)}

function constrainQuitPickerFuture(){
  const now=new Date(),yearSelect=wheel('year'),monthSelect=wheel('month'),daySelect=wheel('day'),hourSelect=wheel('hour'),minuteSelect=wheel('minute'),periodSelect=wheel('period');
  if(!yearSelect||!monthSelect||!daySelect||!hourSelect||!minuteSelect||!periodSelect)return;
  Array.from(yearSelect.options).forEach(o=>o.disabled=+o.value>now.getFullYear());
  const year=+yearSelect.value;Array.from(monthSelect.options).forEach(o=>o.disabled=year===now.getFullYear()&&+o.value>now.getMonth());
  const month=+monthSelect.value,maxDay=new Date(year,month+1,0).getDate();Array.from(daySelect.options).forEach(o=>{const v=+o.value;o.disabled=v>maxDay||(year===now.getFullYear()&&month===now.getMonth()&&v>now.getDate())});
  const day=+daySelect.value,isToday=year===now.getFullYear()&&month===now.getMonth()&&day===now.getDate();
  Array.from(periodSelect.options).forEach(o=>o.disabled=isToday&&now.getHours()<12&&o.value==='PM');
  const period=periodSelect.value;Array.from(hourSelect.options).forEach(o=>{let h=(+o.value)%12;if(period==='PM')h+=12;o.disabled=isToday&&h>now.getHours()});
  let selectedHour=(+hourSelect.value)%12;if(period==='PM')selectedHour+=12;Array.from(minuteSelect.options).forEach(o=>o.disabled=isToday&&selectedHour===now.getHours()&&+o.value>now.getMinutes());
}

function rotateSelectToValue(select,value){
  if(!select)return;
  const options=Array.from(select.options),target=options.find(o=>o.value===String(value));
  if(!target)return;
  const targetIndex=options.indexOf(target);
  const reordered=[...options.slice(targetIndex).reverse(),...options.slice(0,targetIndex).reverse()];
  reordered.forEach(option=>select.appendChild(option));
  select.value=String(value);
  select.selectedIndex=0;
}

function initializeQuitPickerToNow(){
  const picker=document.querySelector('.quit-picker');if(!picker||picker.dataset.currentInitialized==='true')return;picker.dataset.currentInitialized='true';
  const now=new Date(),hour24=now.getHours(),hour12=hour24%12||12,period=hour24>=12?'PM':'AM';
  setWheelValue('month',now.getMonth());setWheelValue('day',now.getDate());setWheelValue('year',now.getFullYear());setWheelValue('hour',hour12);setWheelValue('minute',now.getMinutes());setWheelValue('period',period);
  constrainQuitPickerFuture();
  // Native list-style selects always open their visible viewport at the first option in Chromium.
  // Put the current value first instead of trying to force-scroll the browser's internal viewport.
  rotateSelectToValue(wheel('month'),now.getMonth());
  rotateSelectToValue(wheel('day'),now.getDate());
  rotateSelectToValue(wheel('year'),now.getFullYear());
  rotateSelectToValue(wheel('hour'),hour12);
  rotateSelectToValue(wheel('minute'),now.getMinutes());
  rotateSelectToValue(wheel('period'),period);
  constrainQuitPickerFuture();
  picker.querySelectorAll('select[data-wheel]').forEach(select=>select.addEventListener('change',constrainQuitPickerFuture));
}

let queued=false;function queueSync(){if(queued)return;queued=true;queueMicrotask(()=>{queued=false;syncButton();initializeQuitPickerToNow()})}

document.addEventListener('click',event=>{
  const quitPickerButton=event.target.closest('[data-open-quit-picker]');
  if(quitPickerButton){const now=new Date(),input=document.querySelector('#quit-at-value'),label=document.querySelector('[data-quit-date-label]');if(input)input.value=currentLocalDateTimeValue(now);if(label)label.textContent=new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(now)}

  const apply=event.target.closest('[data-apply-quit-date]');
  if(apply){const chosen=selectedQuitDate();if(chosen&&chosen.getTime()>Date.now()){event.preventDefault();event.stopImmediatePropagation();const now=new Date(),h=now.getHours();setWheelValue('month',now.getMonth());setWheelValue('day',now.getDate());setWheelValue('year',now.getFullYear());setWheelValue('hour',h%12||12);setWheelValue('minute',now.getMinutes());setWheelValue('period',h>=12?'PM':'AM');constrainQuitPickerFuture();apply.textContent='FUTURE TIME NOT ALLOWED';setTimeout(()=>{if(document.body.contains(apply))apply.textContent='SET THIS MOMENT'},1400);return}}

  const button=event.target.closest(`[${BUTTON_ATTR}]`);if(!button)return;event.preventDefault();event.stopImmediatePropagation();openMoodCheckin()
},true);

syncButton();const app=document.querySelector('#app');if(app)new MutationObserver(queueSync).observe(app,{childList:true,subtree:true});new MutationObserver(()=>initializeQuitPickerToNow()).observe(document.body,{childList:true,subtree:true});window.addEventListener('storage',queueSync);window.addEventListener('reclaim:reload-restored',queueSync);
