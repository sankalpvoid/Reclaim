const STATE_KEY='reclaim-state-v2';
const SESSION_KEY='reclaim-session-v1';
const RETURNING_KEY='reclaim-returning-welcome-v1';

function readJson(key,storage=localStorage){try{return JSON.parse(storage.getItem(key)||'null')}catch{return null}}
function writeState(patch={}){
  const state=readJson(STATE_KEY)||{};
  localStorage.setItem(STATE_KEY,JSON.stringify({...state,...patch}));
}
function escapeHtml(value=''){return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]))}
function progressSignal(payload,state){
  const quitAt=payload?.quitAt||state?.profile?.quitAt;
  const mode=payload?.journeyMode||state?.profile?.journeyMode;
  if(mode==='quit'&&quitAt){
    const elapsed=Math.max(0,Date.now()-new Date(quitAt).getTime());
    const hours=Math.floor(elapsed/36e5);
    if(hours>=48)return {value:`${Math.floor(hours/24)} DAYS`,copy:'You have already built real distance from your old routine.'};
    if(hours>=1)return {value:`${hours} ${hours===1?'HOUR':'HOURS'}`,copy:'Every hour counts. Pick up from where you left off.'};
  }
  if(mode==='reduce')return {value:'KEEP GOING',copy:'Your plan is still here. Check in, then keep the next choice small.'};
  return {value:'YOU’RE BACK',copy:'Your progress is saved. Take a quick moment to reconnect with your journey.'};
}
function signedInUserId(){return readJson(SESSION_KEY)?.user?.id||''}
function consume(){sessionStorage.removeItem(RETURNING_KEY)}
function routeWithBridge(bridge,stage){
  writeState({stage,view:'home'});
  consume();
  if(bridge){bridge.dataset.stage=stage;bridge.click();return}
  location.reload();
}
function render(){
  const payload=readJson(RETURNING_KEY,sessionStorage);
  if(!payload?.userId||payload.userId!==signedInUserId()){
    if(payload)consume();
    return false;
  }
  if(Date.now()-Number(payload.createdAt||0)>10*60*1000){consume();return false}

  const app=document.querySelector('#app');
  const bridge=document.querySelector('.intro-reference-cta[data-stage]');
  if(!app||!bridge)return false;
  const state=readJson(STATE_KEY)||{};
  const name=payload.name||state?.profile?.name||'there';
  const signal=progressSignal(payload,state);
  window.__reclaimReturningWelcome=true;

  app.innerHTML=`<main class="shell"><section class="screen full welcome-back-screen"><div class="welcome-back-top"><div class="brand">RECLAIM</div><div class="welcome-back-chip">Glad you’re here</div></div><div class="welcome-back-copy"><div class="eyebrow">YOUR JOURNEY CONTINUES</div><h1 class="welcome-back-title">WELCOME BACK,<br><span>${escapeHtml(String(name).toUpperCase())}.</span></h1></div><div class="welcome-back-pulse"><div class="welcome-back-pulse-label"><span>YOUR RECLAIM MOMENT</span><span>✦</span></div><div class="welcome-back-pulse-value">${escapeHtml(signal.value)}</div><p class="welcome-back-pulse-copy">${escapeHtml(signal.copy)}</p><div class="welcome-back-orb"></div></div><div class="welcome-back-actions"><p class="welcome-back-question">How are you feeling right now?</p><button class="welcome-back-checkin" data-returning-checkin><span class="welcome-back-checkin-copy"><strong>CHECK IN WITH YOURSELF</strong><small>Takes less than a minute</small></span><span class="welcome-back-checkin-arrow" aria-hidden="true">→</span></button><button class="welcome-back-skip" data-returning-skip>Skip for now <span>·</span> Go to dashboard</button></div></section></main>`;
  app.querySelector('[data-returning-checkin]')?.addEventListener('click',()=>routeWithBridge(bridge,'mood'));
  app.querySelector('[data-returning-skip]')?.addEventListener('click',()=>routeWithBridge(bridge,'app'));
  return true;
}

if(!render()){
  const app=document.querySelector('#app');
  if(app){
    const observer=new MutationObserver(()=>{if(render())observer.disconnect()});
    observer.observe(app,{childList:true,subtree:true});
    setTimeout(()=>observer.disconnect(),2500);
  }
}
