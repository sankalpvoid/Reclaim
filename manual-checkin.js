import './ui-polish.js';

const HERO_ART_STYLESHEET_ID='reclaim-hero-art-only';
if(!document.getElementById(HERO_ART_STYLESHEET_ID)){
  const link=document.createElement('link');
  link.id=HERO_ART_STYLESHEET_ID;
  link.rel='stylesheet';
  link.href='hero-art-only.css?v=3';
  document.head.appendChild(link);
}

const QUIT_WHEEL_STYLESHEET_ID='reclaim-quit-wheel-styles';
if(!document.getElementById(QUIT_WHEEL_STYLESHEET_ID)){
  const link=document.createElement('link');
  link.id=QUIT_WHEEL_STYLESHEET_ID;
  link.rel='stylesheet';
  link.href='manual-checkin.css?v=quit-wheel-7';
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

const WHEEL_ITEM_HEIGHT=48;
const pad2=n=>String(n).padStart(2,'0');
function localDateTimeValue(date){return `${date.getFullYear()}-${pad2(date.getMonth()+1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`}
function daysInMonth(year,month){return new Date(year,month+1,0).getDate()}
function closeQuitWheelPicker(){document.querySelector('.reclaim-quit-wheel-modal')?.remove()}

function openQuitWheelPicker(){
  closeQuitWheelPicker();
  const hidden=document.querySelector('#quit-at-value');
  const label=document.querySelector('[data-quit-date-label]');
  if(!hidden||!label)return;

  const now=new Date();
  now.setSeconds(0,0);
  const selected={month:now.getMonth(),day:now.getDate(),year:now.getFullYear(),hour:now.getHours()%12||12,minute:now.getMinutes(),period:now.getHours()>=12?'PM':'AM'};
  const monthNames=Array.from({length:12},(_,i)=>new Intl.DateTimeFormat(undefined,{month:'short'}).format(new Date(2020,i,1)).toUpperCase());
  const years=Array.from({length:21},(_,i)=>now.getFullYear()-20+i);
  let modal;

  const valuesFor=name=>name==='month'?Array.from({length:12},(_,i)=>i):name==='day'?Array.from({length:daysInMonth(selected.year,selected.month)},(_,i)=>i+1):name==='year'?years:name==='hour'?Array.from({length:12},(_,i)=>i+1):name==='minute'?Array.from({length:60},(_,i)=>i):['AM','PM'];
  const formatValue=(name,value)=>name==='month'?monthNames[value]:(name==='hour'||name==='minute'?pad2(value):String(value));
  const candidateDate=()=>{let h=selected.hour%12;if(selected.period==='PM')h+=12;return new Date(selected.year,selected.month,selected.day,h,selected.minute,0,0)};
  function wheelMarkup(name){return `<div class="reclaim-wheel" data-quit-wheel="${name}" role="listbox" aria-label="${name}"><div class="reclaim-wheel-pad"></div>${valuesFor(name).map(value=>`<div class="reclaim-wheel-item" data-value="${value}" role="option">${formatValue(name,value)}</div>`).join('')}<div class="reclaim-wheel-pad"></div></div>`}

  modal=document.createElement('div');
  modal.className='reclaim-quit-wheel-modal';
  modal.innerHTML=`<div class="reclaim-quit-wheel-card" role="dialog" aria-modal="true" aria-labelledby="reclaim-quit-wheel-title"><button type="button" class="reclaim-quit-wheel-close" aria-label="Close">×</button><div class="reclaim-quit-wheel-eyebrow">QUIT DATE AND TIME</div><h2 id="reclaim-quit-wheel-title">WHEN DID YOUR<br>RECLAIM BEGIN?</h2><p class="reclaim-quit-wheel-copy">Roll each column to set the moment your live calculations begin.</p><div class="reclaim-wheel-labels"><span>MONTH</span><span>DAY</span><span>YEAR</span></div><div class="reclaim-wheel-row" data-wheel-row="date">${wheelMarkup('month')}${wheelMarkup('day')}${wheelMarkup('year')}</div><div class="reclaim-wheel-labels reclaim-wheel-labels-time"><span>HOUR</span><span>MINUTE</span><span>AM / PM</span></div><div class="reclaim-wheel-row" data-wheel-row="time">${wheelMarkup('hour')}${wheelMarkup('minute')}${wheelMarkup('period')}</div><div class="reclaim-quit-wheel-note">Future dates and times are unavailable.</div><button type="button" class="reclaim-quit-wheel-apply">SET THIS MOMENT</button></div>`;
  document.body.appendChild(modal);

  function getWheel(name){return modal.querySelector(`[data-quit-wheel="${name}"]`)}
  function itemIndexFor(wheel,value){return [...wheel.querySelectorAll('.reclaim-wheel-item')].findIndex(item=>item.dataset.value===String(value))}
  function paintWheel(wheel,index){wheel.querySelectorAll('.reclaim-wheel-item').forEach((item,i)=>{item.classList.toggle('is-selected',i===index);item.setAttribute('aria-selected',i===index?'true':'false')})}
  function centerWheel(name,behavior='auto'){
    const wheel=getWheel(name);if(!wheel)return;
    const index=itemIndexFor(wheel,selected[name]);if(index<0)return;
    wheel.classList.add('is-positioning');
    wheel.style.scrollSnapType='none';
    wheel.scrollTop=index*WHEEL_ITEM_HEIGHT;
    paintWheel(wheel,index);
    requestAnimationFrame(()=>{wheel.style.scrollSnapType='y mandatory';wheel.classList.remove('is-positioning')});
  }
  function rebuildDayWheel(){
    const old=getWheel('day');if(!old)return;
    const max=daysInMonth(selected.year,selected.month);if(selected.day>max)selected.day=max;
    const holder=document.createElement('div');holder.innerHTML=wheelMarkup('day');old.replaceWith(holder.firstElementChild);
    const fresh=getWheel('day');wireWheel(fresh);centerWheel('day');
  }
  function resetToNow(){
    selected.month=now.getMonth();selected.day=now.getDate();selected.year=now.getFullYear();selected.hour=now.getHours()%12||12;selected.minute=now.getMinutes();selected.period=now.getHours()>=12?'PM':'AM';
    rebuildDayWheel();['month','year','hour','minute','period'].forEach(name=>centerWheel(name));
  }
  function settleWheel(wheel){
    if(wheel.classList.contains('is-positioning'))return;
    const items=[...wheel.querySelectorAll('.reclaim-wheel-item')];if(!items.length)return;
    const index=Math.max(0,Math.min(items.length-1,Math.round(wheel.scrollTop/WHEEL_ITEM_HEIGHT)));
    const name=wheel.dataset.quitWheel,raw=items[index].dataset.value;
    selected[name]=name==='period'?raw:Number(raw);paintWheel(wheel,index);
    wheel.scrollTo({top:index*WHEEL_ITEM_HEIGHT,behavior:'smooth'});
    if(name==='month'||name==='year')rebuildDayWheel();
    if(candidateDate().getTime()>now.getTime())resetToNow();
  }
  function wireWheel(wheel){
    let timer;
    wheel.addEventListener('scroll',()=>{if(wheel.classList.contains('is-positioning'))return;clearTimeout(timer);timer=setTimeout(()=>settleWheel(wheel),180)},{passive:true});
    wheel.addEventListener('click',event=>{const item=event.target.closest('.reclaim-wheel-item');if(!item)return;const items=[...wheel.querySelectorAll('.reclaim-wheel-item')],index=items.indexOf(item);if(index<0)return;wheel.scrollTo({top:index*WHEEL_ITEM_HEIGHT,behavior:'smooth'});clearTimeout(timer);timer=setTimeout(()=>settleWheel(wheel),220)});
  }

  modal.querySelectorAll('.reclaim-wheel').forEach(wireWheel);
  requestAnimationFrame(()=>requestAnimationFrame(()=>['month','day','year','hour','minute','period'].forEach(name=>centerWheel(name))));
  modal.querySelector('.reclaim-quit-wheel-close').onclick=closeQuitWheelPicker;
  modal.addEventListener('click',event=>{if(event.target===modal)closeQuitWheelPicker()});
  modal.querySelector('.reclaim-quit-wheel-apply').onclick=()=>{const chosen=candidateDate();if(chosen.getTime()>Date.now()){resetToNow();return}hidden.value=localDateTimeValue(chosen);hidden.dispatchEvent(new Event('input',{bubbles:true}));hidden.dispatchEvent(new Event('change',{bubbles:true}));label.textContent=new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(chosen);closeQuitWheelPicker()};
}

let queued=false;function queueSync(){if(queued)return;queued=true;queueMicrotask(()=>{queued=false;syncButton()})}
document.addEventListener('click',event=>{const quitPickerButton=event.target.closest('[data-open-quit-picker]');if(quitPickerButton){event.preventDefault();event.stopImmediatePropagation();openQuitWheelPicker();return}const button=event.target.closest(`[${BUTTON_ATTR}]`);if(!button)return;event.preventDefault();event.stopImmediatePropagation();openMoodCheckin()},true);
syncButton();const app=document.querySelector('#app');if(app)new MutationObserver(queueSync).observe(app,{childList:true,subtree:true});window.addEventListener('storage',queueSync);window.addEventListener('reclaim:reload-restored',queueSync);
