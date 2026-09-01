(()=>{
const STORAGE='reclaim-state-v2';
const TRIGGERS=[['stress','STRESS'],['after_food','AFTER FOOD'],['social','SOCIAL'],['bored','BORED'],['alcohol','ALCOHOL'],['routine','ROUTINE']];
function load(){try{return JSON.parse(localStorage.getItem(STORAGE)||'{}')}catch{return {}}}
function save(s){localStorage.setItem(STORAGE,JSON.stringify(s))}
function mode(){return load()?.profile?.journeyMode||'quit'}
function latestUnlabeled(){const s=load(),items=s.smokingEvents||[];for(let i=items.length-1;i>=0;i--){if(!items[i].trigger)return {s,item:items[i]}}return null}
function close(){document.querySelector('.journey-log-sheet')?.remove()}
function show(){if(mode()==='quit')return;close();const found=latestUnlabeled();if(!found)return;document.body.insertAdjacentHTML('beforeend',`<div class="journey-log-sheet"><div class="journey-log-panel"><div class="journey-log-grip"></div><div class="eyebrow">OPTIONAL · ONE TAP</div><h2>CIGARETTE LOGGED.</h2><p>What was happening around this one?</p><div class="journey-trigger-grid">${TRIGGERS.map(([key,label])=>`<button data-journey-trigger="${key}">${label}</button>`).join('')}</div><button class="journey-trigger-skip" data-journey-trigger-skip>SKIP</button></div></div>`);
 document.querySelectorAll('[data-journey-trigger]').forEach(btn=>btn.onclick=()=>{const current=latestUnlabeled();if(current){current.item.trigger=btn.dataset.journeyTrigger;current.item.contextCapturedAt=new Date().toISOString();save(current.s)}close()});
 document.querySelector('[data-journey-trigger-skip]').onclick=close;
 document.querySelector('.journey-log-sheet').onclick=e=>{if(e.target.classList.contains('journey-log-sheet'))close()};
}
document.addEventListener('click',e=>{if(e.target.closest('[data-log-cigarette]'))setTimeout(show,120)},true);
})();