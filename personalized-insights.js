(() => {
  const STORAGE_KEY = 'reclaim-state-v2';
  const TOOL_NAMES = { breathe:'Box breathing', timer:'Ride the wave', water:'Water reset', walk:'Take a short walk' };
  function readState(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')}catch{return {}}}
  function periodStart(period){const now=Date.now();if(period==='week')return now-7*864e5;if(period==='month')return now-30*864e5;return 0}
  function daypart(date){const hour=date.getHours();if(hour<5)return 'late night';if(hour<12)return 'morning';if(hour<17)return 'afternoon';if(hour<22)return 'evening';return 'late night'}
  function cravingData(){const state=readState(),period=state.insightPeriod||'week',cutoff=periodStart(period),all=Array.isArray(state.cravings)?state.cravings:[],cravings=all.filter(item=>{const at=new Date(item.at||item.createdAt||0).getTime();return Number.isFinite(at)&&at>=cutoff});return {cravings}}
  function patternInsight(cravings){
    if(cravings.length<3)return {part:null,title:'Still learning your rhythm',copy:'After a few more logged cravings, Reclaim can show when urges tend to appear.',counts:{}};
    const counts={morning:0,afternoon:0,evening:0,'late night':0};for(const craving of cravings)counts[daypart(new Date(craving.at||craving.createdAt))]++;
    const [part,count]=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0],pct=Math.round(count/cravings.length*100);
    return {part,title:`${part[0].toUpperCase()+part.slice(1)}s are your toughest window`,copy:`${count} of ${cravings.length} logged cravings happened in the ${part} (${pct}%).`,counts};
  }
  function toolInsight(cravings){
    const rated=cravings.filter(item=>item.tool&&item.feedback&&item.feedback!=='skip'),scores={yes:2,a_little:1,not_really:0},byTool=new Map();
    for(const item of rated){if(!(item.feedback in scores))continue;const r=byTool.get(item.tool)||{count:0,score:0};r.count++;r.score+=scores[item.feedback];byTool.set(item.tool,r)}
    const ranked=[...byTool.entries()].filter(([,r])=>r.count>=2).sort((a,b)=>b[1].score/b[1].count-a[1].score/a[1].count||b[1].count-a[1].count);
    if(!ranked.length)return {tool:null,title:rated.length?'A pattern is forming':'Keep using what works',copy:rated.length?`${rated.length} tool check-ins recorded. Reclaim will surface a favorite when the signal is clearer.`:'Optional feedback quietly teaches Reclaim which reset works best for you.'};
    const [tool,result]=ranked[0],positive=result.score>0,name=TOOL_NAMES[tool]||'Your reset';return {tool,title:positive?name:'Try a different reset',copy:positive?`Strongest response so far across ${result.count} uses.`:'Your recent feedback suggests trying another craving tool next time.'};
  }
  function resilienceInsight(cravings){const resisted=cravings.filter(item=>item.resisted).length,total=cravings.length,pct=total?Math.round(resisted/total*100):0;return {resisted,total,pct,title:total?`${resisted} of ${total} ridden out`:'No cravings logged',copy:total?'A record of your responses, not a score. Setbacks never erase progress.':'When an urge appears, logging it helps Reclaim learn without asking you to journal.'}}
  function rhythmBars(pattern){const labels=[['morning','MORNING'],['afternoon','AFTERNOON'],['evening','EVENING'],['late night','NIGHT']],max=Math.max(1,...Object.values(pattern.counts||{}));return `<div class="pattern-rhythm">${labels.map(([key,label])=>{const count=pattern.counts?.[key]||0,pct=count?Math.max(10,count/max*100):4;return `<div class="rhythm-row ${pattern.part===key?'active':''}"><span>${label}</span><i><b style="width:${pct}%"></b></i><strong>${count}</strong></div>`}).join('')}</div>`}
  function render(){
    const app=document.querySelector('#app'),screen=app?.querySelector('.screen'),brand=screen?.querySelector('.topbar .brand');if(!screen||brand?.textContent.trim()!=='INSIGHTS')return;const anchor=screen.querySelector('.period-caption');if(!anchor)return;
    const {cravings}=cravingData(),pattern=patternInsight(cravings),tool=toolInsight(cravings),response=resilienceInsight(cravings),signature=JSON.stringify([pattern,tool,response]);let block=screen.querySelector('#personalized-insights');if(!block){block=document.createElement('section');block.id='personalized-insights';block.className='personalized-insights';anchor.insertAdjacentElement('afterend',block)}if(block.dataset.signature===signature)return;block.dataset.signature=signature;
    block.innerHTML=`<div class="personalized-insights-heading"><div><div class="eyebrow">LEARNING FROM YOUR JOURNEY</div><h2>YOUR PATTERNS</h2></div><span class="insight-private">PRIVATE TO YOU</span></div>
      <article class="pattern-hero"><div class="pattern-copy"><div class="eyebrow">WHEN IT HITS</div><strong>${pattern.title}</strong><p>${pattern.copy}</p></div>${rhythmBars(pattern)}</article>
      <article class="what-works-card"><div class="works-icon">${tool.tool?'✓':'○'}</div><div><div class="eyebrow">WHAT WORKS FOR YOU</div><strong>${tool.title}</strong><p>${tool.copy}</p></div></article>
      <article class="response-strip"><div class="response-top"><div><div class="eyebrow">HOW YOU'RE RESPONDING</div><strong>${response.title}</strong></div>${response.total?`<span>${response.pct}%</span>`:''}</div>${response.total?`<div class="response-progress"><i style="width:${response.pct}%"></i></div>`:''}<p>${response.copy}</p></article>
      <p class="personalized-insights-note">No extra check-ins required. These patterns come from activity you already log in Reclaim.</p>`;
  }
  const observer=new MutationObserver(()=>queueMicrotask(render));function start(){const app=document.querySelector('#app');if(!app)return;observer.observe(app,{childList:true,subtree:true});render()}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
