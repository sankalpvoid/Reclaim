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
    if(hours>=48)return `${Math.floor(hours/24)} days reclaimed so far. Your progress is still here.`;
    if(hours>=1)return `${hours} ${hours===1?'hour':'hours'} reclaimed so far. Your progress is still here.`;
  }
  return 'Your progress is still here. Take a moment to check in with yourself.';
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
  window.__reclaimReturningWelcome=true;

  app.innerHTML=`<main class="shell"><section class="screen full"><div class="brand">RECLAIM</div><div style="margin-top:58px"><div class="eyebrow">YOUR JOURNEY CONTINUES</div><h1>WELCOME BACK,<br>${escapeHtml(String(name).toUpperCase())}.</h1><p class="muted" style="margin-top:18px">${escapeHtml(progressSignal(payload,state))}</p></div><div class="spacer"></div><p class="muted small" style="text-align:center;margin-bottom:12px">How are you feeling right now?</p><button class="primary" data-returning-checkin>CHECK IN</button><button class="secondary" data-returning-skip style="margin-top:10px">GO TO DASHBOARD</button></section></main>`;
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
