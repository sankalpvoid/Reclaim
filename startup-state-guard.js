(()=>{
  const STATE_KEY='reclaim-state-v2';
  const FAKE_HASH='#access_token=';

  // app.js still contains a legacy startup line that forces every normal load
  // back to the intro screen. On a real OAuth callback we leave the hash alone.
  const currentHash=new URLSearchParams(location.hash.slice(1));
  if(currentHash.has('access_token'))return;

  let state=null;
  try{state=JSON.parse(localStorage.getItem(STATE_KEY)||'null')}catch{}

  // New visitors should still see the intro. Returning users should keep the
  // exact stage/view already stored by Reclaim.
  if(!state||!state.stage||state.stage==='intro')return;

  const originalHash=location.hash;
  history.replaceState(history.state,'',`${location.pathname}${location.search}${FAKE_HASH}`);

  const cleanup=()=>{
    if(location.hash!==FAKE_HASH)return;
    history.replaceState(history.state,'',`${location.pathname}${location.search}${originalHash}`);
  };

  // Parser-inserted module scripts finish before DOMContentLoaded, so the
  // temporary empty access_token is present only while app.js evaluates.
  addEventListener('DOMContentLoaded',cleanup,{once:true});
  setTimeout(cleanup,5000);
})();