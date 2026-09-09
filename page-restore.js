(()=>{
  const SNAPSHOT_KEY='reclaim-live-page-v1';
  const STATE_KEY='reclaim-state-v2';
  const SESSION_KEY='reclaim-session-v1';

  function parse(key,fallback=null){
    try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}
  }

  function userId(){
    const session=parse(SESSION_KEY,{});
    return session?.user?.id||session?.user_id||session?.id||null;
  }

  function matchesStoredStage(app,state){
    if(!app?.firstElementChild||!state)return false;
    const stage=state.stage||'intro';
    if(stage==='intro')return Boolean(app.querySelector('.intro-reference'));
    if(stage==='auth')return Boolean(app.querySelector('#auth-form'));
    if(stage==='path')return Boolean(app.querySelector('.path-screen'));
    if(stage==='app')return Boolean(app.querySelector('.shell'))&&!app.querySelector('.intro-reference,#auth-form,.path-screen');
    return !app.querySelector('.intro-reference');
  }

  function capture(){
    const app=document.getElementById('app');
    const state=parse(STATE_KEY,{});
    if(!matchesStoredStage(app,state))return;

    const clone=app.cloneNode(true);
    clone.querySelectorAll('.toast,.modal,[data-snapshot-ignore]').forEach(el=>el.remove());
    clone.querySelectorAll('script').forEach(el=>el.remove());

    const html=clone.innerHTML;
    if(!html||html.length>900000)return;

    try{
      localStorage.setItem(SNAPSHOT_KEY,JSON.stringify({
        version:1,
        userId:userId(),
        stage:state.stage||'intro',
        view:state.view||null,
        capturedAt:Date.now(),
        html
      }));
    }catch{}
  }

  const app=document.getElementById('app');
  if(!app)return;

  let timer=0;
  const schedule=()=>{
    clearTimeout(timer);
    timer=setTimeout(capture,220);
  };

  const observer=new MutationObserver(schedule);
  observer.observe(app,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style']});
  schedule();
  addEventListener('pagehide',capture);
  addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')capture()});
})();