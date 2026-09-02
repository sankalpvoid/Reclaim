// Reclaim session bootstrap.
// Runs after app.js but before the lifecycle/check-in bridge. Its only job is to make
// reload restoration deterministic while keeping genuine returns subject to the
// lifecycle rules in checkin-sync.js.

const STATE_KEY='reclaim-state-v2';
const SESSION_KEY='reclaim-session-v1';
const LIFECYCLE_KEY='reclaim-lifecycle-v1';
const RESTORABLE_STAGES=new Set(['app','support','mood','path','setup']);

function readJson(key){
  try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}
}

function decodeSub(token=''){
  try{
    const payload=token.split('.')[1];
    if(!payload)return '';
    const normalized=payload.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(payload.length/4)*4,'=');
    return JSON.parse(atob(normalized))?.sub||'';
  }catch{return ''}
}

function navigationType(){
  return performance.getEntriesByType?.('navigation')?.[0]?.type||'navigate';
}

function signedInContext(){
  const session=readJson(SESSION_KEY)||{};
  const token=session.access_token||'';
  const userId=session.user?.id||decodeSub(token);
  return {token,userId};
}

function normalizeLifecycleOwner(userId){
  if(!userId)return;
  const lifecycle=readJson(LIFECYCLE_KEY)||{};
  if(lifecycle.userId&&lifecycle.userId!==userId){
    localStorage.setItem(LIFECYCLE_KEY,JSON.stringify({userId,lastActiveAt:0}));
  }
}

function clickStage(stage){
  const bridge=document.querySelector('.intro-reference-cta[data-stage]');
  if(!bridge)return false;
  window.__reclaimReloadStage=stage;
  window.__reclaimReloadRestoredAt=Date.now();
  bridge.dataset.stage=stage;
  bridge.click();
  document.dispatchEvent(new CustomEvent('reclaim:reload-restored',{detail:{stage}}));
  return true;
}

function restoreReload(){
  if(navigationType()!=='reload')return false;
  const {token,userId}=signedInContext();
  if(!token||!userId)return false;
  normalizeLifecycleOwner(userId);

  const state=readJson(STATE_KEY)||{};
  const stage=RESTORABLE_STAGES.has(state.stage)?state.stage:null;
  if(!stage)return false;
  if(clickStage(stage))return true;

  const app=document.querySelector('#app');
  if(!app)return false;
  const observer=new MutationObserver(()=>{
    if(clickStage(stage))observer.disconnect();
  });
  observer.observe(app,{childList:true,subtree:true});
  setTimeout(()=>observer.disconnect(),2500);
  return true;
}

const {userId}=signedInContext();
normalizeLifecycleOwner(userId);
restoreReload();
