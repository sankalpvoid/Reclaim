import './ui-polish.js';

const HERO_ART_STYLESHEET_ID='reclaim-hero-art-only';
if(!document.getElementById(HERO_ART_STYLESHEET_ID)){
  const link=document.createElement('link');
  link.id=HERO_ART_STYLESHEET_ID;
  link.rel='stylesheet';
  link.href='hero-art-only.css?v=3';
  document.head.appendChild(link);
}

const QUIT_PICKER_STYLESHEET_ID='reclaim-quit-picker-styles';
if(!document.getElementById(QUIT_PICKER_STYLESHEET_ID)){
  const link=document.createElement('link');
  link.id=QUIT_PICKER_STYLESHEET_ID;
  link.rel='stylesheet';
  link.href='manual-checkin.css?v=quit-dial-2';
  document.head.appendChild(link);
}

function revealMaterialSymbols(){document.documentElement.classList.add('reclaim-icons-ready')}
if(document.fonts?.load){let settled=false;document.fonts.load('24px "Material Symbols Rounded"','home mood payments favorite bolt my_location calendar_month chevron_left chevron_right').then(faces=>{if(faces.length){settled=true;revealMaterialSymbols()}else return document.fonts.ready.then(()=>{settled=true;revealMaterialSymbols()})}).catch(()=>{});setTimeout(()=>{if(!settled)revealMaterialSymbols()},5000)}else revealMaterialSymbols();

const STATE_KEY='reclaim-state-v2',SESSION_KEY='reclaim-session-v1',SNAPSHOT_KEY='reclaim-page-skeleton-v1',BUTTON_ATTR='data-manual-mood-checkin',ORIGINAL_HTML_ATTR='data-original-for-you-html';
function readJson(key){try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}}
function isDashboardHome(){const state=readJson(STATE_KEY)||{},session=readJson(SESSION_KEY);return Boolean(session?.access_token&&state.stage==='app'&&(state.view||'home')==='home')}
function openMoodCheckin(){const state=readJson(STATE_KEY)||{},liveShell=document.querySelector('#app .shell')||document.querySelector('#app .home-screen')||document.querySelector('#app .tracking-home');if(liveShell)liveShell.classList.add('reclaim-snapshot-host');localStorage.removeItem(SNAPSHOT_KEY);localStorage.setItem(STATE_KEY,JSON.stringify({...state,stage:'mood',view:'home'}));location.reload()}
function restoreForYou(button){if(!button?.hasAttribute(ORIGINAL_HTML_ATTR))return;button.innerHTML=button.getAttribute(ORIGINAL_HTML_ATTR)||'';button.removeAttribute(ORIGINAL_HTML_ATTR);button.removeAttribute(BUTTON_ATTR);button.classList.remove('manual-checkin-button');button.setAttribute('data-for-you','');button.setAttribute('aria-label','Open For You');button.removeAttribute('title')}
function syncButton(){const app=document.querySelector('#app');if(!app)return;const manual=app.querySelector(`[${BUTTON_ATTR}]`);if(!isDashboardHome()){restoreForYou(manual);return}const home=app.querySelector('.home-screen,.tracking-home'),top=home?.querySelector('.topbar'),button=top?.querySelector('.checkin-trigger.for-you-trigger');if(!button||button.hasAttribute(BUTTON_ATTR))return;button.setAttribute(ORIGINAL_HTML_ATTR,button.innerHTML);button.setAttribute(BUTTON_ATTR,'');button.classList.add('manual-checkin-button');button.removeAttribute('data-for-you');button.setAttribute('aria-label','How are you now? Check in');button.setAttribute('title','How are you now?');button.innerHTML='<span class="material-symbols-rounded" aria-hidden="true">mood</span>'}

const pad2=n=>String(n).padStart(2,'0');
function localDateTimeValue(date){return `${date.getFullYear()}-${pad2(date.getMonth()+1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`}
function closeQuitMomentPicker(){document.querySelector('.reclaim-time-modal')?.remove()}

function openQuitMomentPicker(){
  closeQuitMomentPicker();
  const hidden=document.querySelector('#quit-at-value');
  const label=document.querySelector('[data-quit-date-label]');
  if(!hidden||!label)return;

  const now=new Date();now.setSeconds(0,0);
  let selected=new Date(now);
  let dragging=false;
  let calendarCursor=new Date(selected.getFullYear(),selected.getMonth(),1);
  let modal;

  const preset=(key,icon,text)=>`<button type="button" class="reclaim-time-preset" data-time-preset="${key}"><span class="material-symbols-rounded" aria-hidden="true">${icon}</span><span>${text}</span></button>`;
  modal=document.createElement('div');
  modal.className='reclaim-time-modal';
  modal.innerHTML=`<div class="reclaim-time-card" role="dialog" aria-modal="true" aria-labelledby="reclaim-time-title"><button type="button" class="reclaim-time-close" aria-label="Close">×</button><div class="reclaim-time-brand"><span class="reclaim-time-brand-mark">✦</span><span>RECLAIM</span></div><h2 id="reclaim-time-title">WHEN DID YOUR<br><em>RECLAIM</em> BEGIN?</h2><p class="reclaim-time-copy">Choose a quick moment or fine-tune the time.</p><div class="reclaim-time-presets">${preset('now','bolt','Just Now')}${preset('morning','wb_twilight','This Morning')}${preset('yesterday','dark_mode','Yesterday')}</div><button type="button" class="reclaim-date-trigger" data-date-trigger><span class="material-symbols-rounded" aria-hidden="true">calendar_month</span><span class="reclaim-date-trigger-copy"><strong data-date-trigger-label></strong><small>CHANGE DATE</small></span><span class="reclaim-date-trigger-arrow">›</span></button><div class="reclaim-calendar" data-calendar hidden><div class="reclaim-calendar-head"><button type="button" data-cal-prev aria-label="Previous month"><span class="material-symbols-rounded">chevron_left</span></button><div class="reclaim-calendar-title"><span data-cal-month></span><select data-cal-year aria-label="Year"></select></div><button type="button" data-cal-next aria-label="Next month"><span class="material-symbols-rounded">chevron_right</span></button></div><div class="reclaim-calendar-weekdays"><span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span></div><div class="reclaim-calendar-grid" data-cal-grid></div></div><div class="reclaim-time-dial" data-time-dial tabindex="0" aria-label="Adjust time"><div class="reclaim-time-ring"></div><div class="reclaim-time-progress"></div><div class="reclaim-time-hand"><span></span></div><div class="reclaim-time-center"><div class="reclaim-time-value"><span data-time-clock>10:57</span><button type="button" data-time-period>AM</button></div><div class="reclaim-time-rule"></div><div class="reclaim-time-date" data-time-date-label></div><div class="reclaim-time-hint">Drag the ring · scroll for 5 min</div></div></div><div class="reclaim-time-note">Future dates and times are unavailable.</div><button type="button" class="reclaim-time-apply">SET THIS MOMENT</button></div>`;
  document.body.appendChild(modal);

  const dial=modal.querySelector('[data-time-dial]');
  const clock=modal.querySelector('[data-time-clock]');
  const periodButton=modal.querySelector('[data-time-period]');
  const dateLabel=modal.querySelector('[data-time-date-label]');
  const dateTrigger=modal.querySelector('[data-date-trigger]');
  const dateTriggerLabel=modal.querySelector('[data-date-trigger-label]');
  const calendar=modal.querySelector('[data-calendar]');
  const calMonth=modal.querySelector('[data-cal-month]');
  const calYear=modal.querySelector('[data-cal-year]');
  const calGrid=modal.querySelector('[data-cal-grid]');

  for(let y=now.getFullYear()-20;y<=now.getFullYear();y++)calYear.insertAdjacentHTML('beforeend',`<option value="${y}">${y}</option>`);

  function clampFuture(){if(selected.getTime()>now.getTime())selected=new Date(now)}
  function renderCalendar(){
    const year=calendarCursor.getFullYear(),month=calendarCursor.getMonth();
    calMonth.textContent=new Intl.DateTimeFormat(undefined,{month:'long'}).format(calendarCursor);
    calYear.value=String(year);
    const firstDay=new Date(year,month,1).getDay();
    const days=new Date(year,month+1,0).getDate();
    let html='';
    for(let i=0;i<firstDay;i++)html+='<span class="reclaim-cal-empty"></span>';
    for(let day=1;day<=days;day++){
      const candidate=new Date(year,month,day,selected.getHours(),selected.getMinutes(),0,0);
      const isFuture=candidate.getTime()>now.getTime();
      const isSelected=year===selected.getFullYear()&&month===selected.getMonth()&&day===selected.getDate();
      const isToday=year===now.getFullYear()&&month===now.getMonth()&&day===now.getDate();
      html+=`<button type="button" class="reclaim-cal-day${isSelected?' is-selected':''}${isToday?' is-today':''}" data-cal-day="${day}" ${isFuture?'disabled':''}>${day}</button>`;
    }
    calGrid.innerHTML=html;
  }
  function updateUI(){
    clampFuture();
    const h24=selected.getHours(),h12=h24%12||12,minutes=selected.getMinutes();
    const minutes12=(h24%12)*60+minutes;
    const angle=minutes12/720*360;
    dial.style.setProperty('--dial-angle',`${angle}deg`);
    clock.textContent=`${pad2(h12)}:${pad2(minutes)}`;
    periodButton.textContent=h24>=12?'PM':'AM';
    const formatted=new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',year:'numeric'}).format(selected);
    dateLabel.textContent=formatted;
    dateTriggerLabel.textContent=formatted;
    renderCalendar();
  }
  function setTimeFromAngle(event){
    const rect=dial.getBoundingClientRect(),cx=rect.left+rect.width/2,cy=rect.top+rect.height/2;
    const dx=event.clientX-cx,dy=event.clientY-cy;
    let deg=Math.atan2(dy,dx)*180/Math.PI+90;if(deg<0)deg+=360;
    let minutes12=Math.round((deg/360)*720);if(minutes12>=720)minutes12=0;
    const period=selected.getHours()>=12?12:0;
    const hour12=Math.floor(minutes12/60)%12;
    selected.setHours(period+hour12,minutes12%60,0,0);
    clampFuture();updateUI();
  }
  function nudge(minutes){selected=new Date(selected.getTime()+minutes*60000);clampFuture();updateUI()}
  function applyPreset(key){
    const next=new Date(now);
    if(key==='morning'){next.setHours(8,0,0,0);if(next>now)next.setTime(now.getTime())}
    if(key==='yesterday')next.setDate(next.getDate()-1);
    selected=next;calendarCursor=new Date(selected.getFullYear(),selected.getMonth(),1);updateUI();
    modal.querySelectorAll('[data-time-preset]').forEach(btn=>btn.classList.toggle('is-active',btn.dataset.timePreset===key));
  }
  function changeMonth(delta){
    const next=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()+delta,1);
    const maxMonth=new Date(now.getFullYear(),now.getMonth(),1);
    if(next>maxMonth)return;
    if(next.getFullYear()<now.getFullYear()-20)return;
    calendarCursor=next;renderCalendar();
  }

  dial.addEventListener('pointerdown',event=>{dragging=true;dial.setPointerCapture?.(event.pointerId);setTimeFromAngle(event)});
  dial.addEventListener('pointermove',event=>{if(dragging)setTimeFromAngle(event)});
  dial.addEventListener('pointerup',()=>{dragging=false});
  dial.addEventListener('pointercancel',()=>{dragging=false});
  dial.addEventListener('wheel',event=>{event.preventDefault();nudge(event.deltaY>0?5:-5)},{passive:false});
  dial.addEventListener('keydown',event=>{if(event.key==='ArrowUp'||event.key==='ArrowRight'){event.preventDefault();nudge(5)}if(event.key==='ArrowDown'||event.key==='ArrowLeft'){event.preventDefault();nudge(-5)}});
  modal.querySelectorAll('[data-time-preset]').forEach(button=>button.onclick=()=>applyPreset(button.dataset.timePreset));
  periodButton.onclick=()=>{selected.setHours((selected.getHours()+12)%24);clampFuture();updateUI()};
  dateTrigger.onclick=()=>{calendar.hidden=!calendar.hidden;dateTrigger.classList.toggle('is-open',!calendar.hidden);if(!calendar.hidden){calendarCursor=new Date(selected.getFullYear(),selected.getMonth(),1);renderCalendar()}};
  modal.querySelector('[data-cal-prev]').onclick=()=>changeMonth(-1);
  modal.querySelector('[data-cal-next]').onclick=()=>changeMonth(1);
  calYear.onchange=()=>{const y=Number(calYear.value);calendarCursor=new Date(y,calendarCursor.getMonth(),1);const maxMonth=new Date(now.getFullYear(),now.getMonth(),1);if(calendarCursor>maxMonth)calendarCursor=maxMonth;renderCalendar()};
  calGrid.onclick=event=>{const button=event.target.closest('[data-cal-day]');if(!button||button.disabled)return;selected.setFullYear(calendarCursor.getFullYear(),calendarCursor.getMonth(),Number(button.dataset.calDay));clampFuture();calendar.hidden=true;dateTrigger.classList.remove('is-open');updateUI()};
  modal.querySelector('.reclaim-time-close').onclick=closeQuitMomentPicker;
  modal.addEventListener('click',event=>{if(event.target===modal)closeQuitMomentPicker()});
  modal.querySelector('.reclaim-time-apply').onclick=()=>{clampFuture();hidden.value=localDateTimeValue(selected);hidden.dispatchEvent(new Event('input',{bubbles:true}));hidden.dispatchEvent(new Event('change',{bubbles:true}));label.textContent=new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(selected);closeQuitMomentPicker()};
  updateUI();
}

let queued=false;function queueSync(){if(queued)return;queued=true;queueMicrotask(()=>{queued=false;syncButton()})}
document.addEventListener('click',event=>{const quitPickerButton=event.target.closest('[data-open-quit-picker]');if(quitPickerButton){event.preventDefault();event.stopImmediatePropagation();openQuitMomentPicker();return}const button=event.target.closest(`[${BUTTON_ATTR}]`);if(!button)return;event.preventDefault();event.stopImmediatePropagation();openMoodCheckin()},true);
syncButton();
const app=document.querySelector('#app');if(app)new MutationObserver(queueSync).observe(app,{childList:true,subtree:true});
window.addEventListener('storage',queueSync);
window.addEventListener('reclaim:reload-restored',queueSync);
