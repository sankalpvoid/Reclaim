(()=>{
const STORAGE='reclaim-state-v2';
function state(){try{return JSON.parse(localStorage.getItem(STORAGE)||'{}')}catch{return {}}}
function mode(){return state()?.profile?.journeyMode||'quit'}
function events(){return state()?.smokingEvents||[]}
function qty(e){return +(e.cigarettes??e.quantity??1)||1}
function at(e){return new Date(e.at||e.occurredAt||Date.now())}
function dayKey(d){return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`}
function todayCount(){const k=dayKey(new Date());return events().filter(e=>dayKey(at(e))===k).reduce((n,e)=>n+qty(e),0)}
function commonWindow(){const es=events().slice(-40);if(es.length<4)return 'Still learning';const buckets={Morning:0,Afternoon:0,Evening:0,'Late night':0};es.forEach(e=>{const h=at(e).getHours();buckets[h<12?'Morning':h<17?'Afternoon':h<22?'Evening':'Late night']+=qty(e)});return Object.entries(buckets).sort((a,b)=>b[1]-a[1])[0][0]}
function enhance(){const screen=document.querySelector('.tracking-home');if(!screen)return;const m=mode();if(m==='quit')return;screen.classList.toggle('journey-reduce',m==='reduce');screen.classList.toggle('journey-track',m==='track');const intro=screen.querySelector('.tracking-intro');if(!intro||intro.dataset.v2)return;intro.dataset.v2='1';const s=state(),count=todayCount(),baseline=+s?.profile?.cigarettesPerDay||0,target=Math.max(0,+s?.profile?.dailyTarget||0);const eyebrow=intro.querySelector('.eyebrow');const title=intro.querySelector('h1');if(m==='reduce'){
 if(eyebrow)eyebrow.textContent='TODAY VS YOUR TARGET';
 if(title)title.innerHTML=`${count}<small>OF ${target||'—'} CIGARETTES</small>`;
 const context=screen.querySelector('.tracking-context');if(context){const left=Math.max(0,target-count),pct=baseline?Math.max(0,Math.round((baseline-count)/baseline*100)):0;context.innerHTML=`<span>${count<=target?`${left} remaining within today’s target`:`${count-target} over today’s target`}</span><span>${baseline&&count<baseline?`${pct}% below your usual daily count so far`:'Progress is measured over time'}</span>`}
 const weekly=screen.querySelector('.weekly-pattern header span');if(weekly)weekly.textContent='Progress, not perfection';
}else{
 if(eyebrow)eyebrow.textContent='TODAY, OBSERVED';
 if(title)title.innerHTML=`${count}<small>CIGARETTES LOGGED</small>`;
 const context=screen.querySelector('.tracking-context');if(context)context.innerHTML=`<span>No target. No judgement.</span><span>Most common window: ${commonWindow()}</span>`;
 const labels=[...screen.querySelectorAll('.tracking-stats .stat-label')];if(labels[0])labels[0].textContent='Estimated spend today';if(labels[2])labels[2].textContent='Cigarettes · 7 days';if(labels[3])labels[3].textContent='7-day daily average';
 const weekly=screen.querySelector('.weekly-pattern header span');if(weekly)weekly.textContent='Notice, don’t judge';
}
 const log=screen.querySelector('.log-cigarette strong');if(log)log.textContent='LOG A CIGARETTE';
}
const app=document.getElementById('app');if(app)new MutationObserver(enhance).observe(app,{childList:true,subtree:true});enhance();
})();