const STATE_KEY='reclaim-state-v2';
const SESSION_KEY='reclaim-session-v1';
const CARD_ATTR='data-manual-mood-checkin';

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
  localStorage.setItem(STATE_KEY,JSON.stringify({...state,stage:'mood',view:'home'}));
  location.reload();
}

function cardMarkup(){
  return `<aside class="manual-checkin-card" ${CARD_ATTR} aria-label="Mood check-in">
    <div class="manual-checkin-icon" aria-hidden="true"><span class="material-symbols-rounded">favorite</span></div>
    <div class="manual-checkin-copy">
      <span class="manual-checkin-kicker">QUICK CHECK-IN</span>
      <strong>How are you now?</strong>
      <small>A few seconds helps Reclaim understand your day better.</small>
    </div>
    <button type="button" class="manual-checkin-action" data-manual-checkin-open aria-label="Check in with how you feel now">
      <span>CHECK IN</span><span class="material-symbols-rounded" aria-hidden="true">arrow_forward</span>
    </button>
  </aside>`;
}

function syncCard(){
  const app=document.querySelector('#app');
  if(!app)return;
  const existing=app.querySelector(`[${CARD_ATTR}]`);
  if(!isDashboardHome()){
    existing?.remove();
    return;
  }
  if(existing)return;

  const hero=app.querySelector('.hero');
  const screen=hero?.closest('.screen')||app.querySelector('.screen');
  if(!screen)return;

  const holder=document.createElement('div');
  holder.innerHTML=cardMarkup().trim();
  const card=holder.firstElementChild;
  if(hero)hero.insertAdjacentElement('beforebegin',card);
  else screen.querySelector('.topbar')?.insertAdjacentElement('afterend',card) || screen.prepend(card);
  card.querySelector('[data-manual-checkin-open]')?.addEventListener('click',openMoodCheckin);
}

let queued=false;
function queueSync(){
  if(queued)return;
  queued=true;
  queueMicrotask(()=>{queued=false;syncCard()});
}

syncCard();
const app=document.querySelector('#app');
if(app){
  new MutationObserver(queueSync).observe(app,{childList:true,subtree:true});
}
window.addEventListener('storage',queueSync);
window.addEventListener('reclaim:reload-restored',queueSync);
