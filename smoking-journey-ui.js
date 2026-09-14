import { sectionHeading } from './v2-presentation.js';
import { todayHero, todayNextStep } from './today-screen.js';
import {dayKey,shiftDay,ensurePlan,journeySummary,commitReview,targetOn} from './smoking-journey.js';
import {clearDayConfirmation,confirmationMutationToRow,normalizeReductionSync,planToRow,reviewToRow,setDayConfirmation} from './reduction-cloud.js';

export function createSmokingJourney(ctx) {
  const {esc,money,appIcon,shell,top,modal,closeModal,toast} = ctx;
  const state=()=>ctx.getState(), mode=()=>state().profile.journeyMode;
  const summary=()=>{ensurePlan(state());return journeySummary(state())};
  const save=()=>{
    // app.js owns the legacy projections; replace the smoked projection in the canonical list too.
    state().behaviorEvents=[...(state().behaviorEvents||[]).filter(e=>e.type!=='smoked'),
      ...(state().smokingEvents||[]).map(e=>({...e,type:'smoked'}))];
    ctx.save();
  };
  const button=(label,attr,cls='secondary')=>`<button class="${cls}" ${attr}>${label}</button>`;
  const stat=(label,value,detail='')=>`<article class="card sj-stat"><small>${label}</small><strong>${value}</strong><span>${detail}</span></article>`;
  const dateLabel=key=>new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric'}).format(new Date(`${key}T12:00:00`));
  const reductionPending=()=>{const r=state().reductionSync||{};return (r.planDirty?1:0)+(r.reviewsDirty?1:0)+Object.keys(r.confirmations||{}).length};
  const pendingChanges=()=>Object.keys(state().smokingMutations||{}).length+reductionPending();
  function week(s) {
    const max=Math.max(...s.days.map(d=>d.count),state().reductionPlan?.currentTarget||0,1);
    return `<article class="card sj-week"><div class="eyebrow">LAST 7 DAYS · TAP A DAY</div><div class="sj-bars">${s.days.map(d=>`<button data-smoking-day="${d.key}" aria-label="${d.label} ${dateLabel(d.key)}: ${d.known?d.count+' logged':'not tracked'}${d.complete?', complete':''}"><span class="sj-bar-space"><i style="height:${d.known?Math.max(3,d.count/max*100):0}%"></i></span><b>${d.known?d.count:'—'}</b><small>${d.label}</small><em>${d.complete?'✓':d.known?'partial':'—'}</em></button>`).join('')}</div><p class="muted small">✓ Confirmed total · partial = logs may be incomplete · — = unknown</p></article>`;
  }
  function planCard(s) {
    if(!s.progress)return '';
    const p=state().reductionPlan,r=s.review,cloud=Boolean(ctx.getSession()?.user);
    return `<article class="card sj-plan"><div class="eyebrow">YOUR REDUCE PLAN · STAGE ${p.stage}</div><div class="sj-plan-numbers"><span><small>BASELINE</small><strong>${p.baseline}</strong></span><b>→</b><span><small>DAILY TARGET</small><strong>${p.currentTarget}</strong></span></div><p class="muted small">Baseline from ${esc(p.baselineSource)}. Target is ${s.progress.percentReduced}% below baseline; this is your plan, not a claim about actual smoking.</p>${s.actualReduction!==null?`<p>Confirmed-day average: ${s.average.toFixed(1)} · ${Math.abs(s.actualReduction)}% ${s.actualReduction>=0?'below':'above'} baseline.</p>`:''}<p class="muted small">${r.due?'Review available':`Next review: ${dateLabel(r.dueOn)}`} · ${r.loggedDays}/4 complete days needed</p>${button('REVIEW MY STAGE','data-smoking-review')}${p.lastReview?`<p class="muted small">Last review: ${esc(p.lastReviewStatus.replaceAll('_',' '))}. Target ${p.currentTarget}/day.</p>`:''}<p class="sj-local-note">${cloud?'Plan history and completed-day records sync to your account.':'Plan history and completed-day records stay on this device until you sign in.'}</p></article>`;
  }
  function home() {
    const s=summary(),t=s.todayProgress, p=state().profile;
    const cost=s.today.count*(+p.pricePerPack/+p.cigarettesPerPack);
    const gap=s.last?Math.max(0,Math.floor((Date.now()-new Date(s.last.at))/60000)):null;
    const review=s.review;
    const pending=pendingChanges();
    const gapLabel=gap===null?'—':gap<60?gap+'m':Math.floor(gap/60)+'h '+gap%60+'m';
    return shell(`<section class="screen tracking-home sj-screen sj-today today-screen">${top('RECLAIM')}${todayHero(appIcon)}
      <div class="tracking-intro"><div class="sj-day-heading"><span class="eyebrow">${mode()==='reduce'?'SMOKE LESS':'YOUR SMOKING'}</span><span class="tracking-date">${esc(new Intl.DateTimeFormat(undefined,{weekday:'short',month:'short',day:'numeric'}).format(new Date()))}</span></div><h1>${s.today.count}<small>TODAY</small></h1></div>
      ${t?`<div class="sj-target"><strong>${t.smoked} of ${t.target} cigarettes</strong><span>${t.overBy?`${t.overBy} above target`:`${t.remaining} within your target`}</span><progress max="${Math.max(t.target,t.smoked,1)}" value="${t.smoked}" aria-label="Today's smoking versus target"></progress></div>`:'<p class="sj-observe">A little more awareness, one log at a time.</p>'}
      <div class="sj-log-block">${button(`${appIcon('add')} LOG A CIGARETTE`,'data-log-cigarette','secondary sj-quick-log')}<div class="sj-actions">${button('Add earlier','data-smoking-add','sj-text-action')}${button('Review today',`data-smoking-day="${dayKey()}"`,'sj-text-action')}</div></div>
      ${pending&&ctx.getSession()?.user?`<div class="sj-pending">${syncStatus()}</div>`:''}
      <dl class="sj-today-meta"><div><dt>Since last cigarette</dt><dd>${gapLabel}</dd></div><div><dt>Spent today</dt><dd>${money(cost)}</dd></div></dl>
      ${review?`<button class="sj-review-row" data-smoking-review><span>${appIcon('trending_down')}</span><span><strong>${review.due?'Your weekly review is ready':'Your next small step'}</strong><small>Stage ${state().reductionPlan.stage} · ${review.due?`${review.loggedDays} complete days`:`Review ${dateLabel(review.dueOn)}`}</small></span><b aria-hidden="true">›</b></button>`:''}
      <button class="sj-insight-row" data-smoking-for-you><span>${appIcon('lightbulb')}</span><span><small>FOR YOU</small><strong>${s.hardTime?`Your busiest window is ${esc(s.hardTime.label.split(' (')[0])}.`:'A little insight for your next step.'}</strong></span><b aria-hidden="true">›</b></button>
      ${todayNextStep(appIcon)}<details class="sj-storage-details"><summary>Storage & sync</summary>${syncStatus()}</details>
    </section>`);
  }

  function patterns() {
    const s=summary();
    const notes=[s.hardTime?`${s.hardTime.percent}% of this week’s logged cigarettes were in the ${s.hardTime.label}.`:'Log on at least 3 days (5 cigarettes total) to reveal a time-of-day pattern.',s.hardDay?`${s.hardDay.label} ${dateLabel(s.hardDay.key)} had the highest confirmed total (${s.hardDay.count}). This describes this week, not a recurring weekday pattern.`:'Confirm at least 4 completed days to compare daily totals.',s.change===null?'Week-to-week comparisons need 4 complete days in each week.':`Your confirmed-day average is ${Math.abs(s.change).toFixed(1)} cigarettes ${s.change<=0?'lower':'higher'} than the previous week. Different coverage can affect this comparison.`];
    return shell(`<section class="screen tracking-insights sj-screen">${top('YOUR PATTERNS')}<div class="eyebrow">${mode()==='reduce'?'YOUR REDUCTION JOURNEY':'OBSERVE AT YOUR OWN PACE'}</div>${sectionHeading('Notice.<br>Without judgment.','ritual-path')}<p class="muted">Patterns from your records. Incomplete days never count as smoke-free wins.</p><div class="sj-grid">${stat('COMPLETE-DAY AVERAGE',s.average===null?'—':s.average.toFixed(1),`${s.closed.length} complete past days this week`)}${stat('LOGGING CONSISTENCY',s.consistency+' days','Consecutive confirmed past days')}${s.progress?stat('DAYS WITHIN TARGET',`${s.successDays}/${s.targetDays}`,'Complete days with a known target')+stat('WITHIN-TARGET STREAK',s.targetStreak+' days','Uses each day’s target'):''}</div>${week(s)}${notes.map(text=>`<article class="card sj-note">${appIcon('lightbulb')}<p>${esc(text)}</p></article>`).join('')}${s.progress?`<article class="card sj-comparison"><div class="eyebrow">ACTUAL VS TARGET</div>${s.days.map(d=>{const t=targetOn(state().reductionPlan,d.key);return `<div><span>${d.label} ${dateLabel(d.key)}</span><strong>${d.known?d.count:'—'} / ${t??'—'}</strong><small>${d.complete?'complete':'incomplete'}</small></div>`}).join('')}</article>`:''}${planCard(s)}${button('REVIEW LOGS OR COMPLETE A DAY','data-smoking-add-day')}${button('CHANGE MY PACE','data-change-path')}</section>`);
  }
  function syncStatus(){
    const smokingPending=Object.keys(state().smokingMutations||{}).length,reducePending=reductionPending(),pending=smokingPending+reducePending;
    if(!ctx.getSession()?.user)return '<p class="sj-local-note">Records are saved on this device. Sign in to sync them across devices.</p>';
    if(pending)return `<p class="sj-local-note">${pending} change${pending===1?'':'s'} saved here, waiting to sync.</p>${button('RETRY SYNC','data-smoking-sync')}`;
    if((state().smokingEvents||[]).some(e=>!e.cloudId))return '<p class="sj-local-note">New changes are synced. Some earlier smoking logs are only on this device.</p>';
    return '<p class="sj-local-note">Smoking logs, Reduce plan and completed-day records are synced to your account.</p>';
  }
  let syncing=false;
  async function sync() {
    if(syncing||!ctx.getSession()?.user)return;
    syncing=true;
    const owner=ctx.getSession().user.id, current=state();
    try {
      for(const [id,job] of Object.entries(current.smokingMutations||{})) {
        if(ctx.getSession()?.user?.id!==owner||state()!==current)break;
        if(job.ownerId && job.ownerId!==owner)continue;
        try {
          if(job.kind==='delete')await ctx.api(`/rest/v1/smoking_events?id=eq.${encodeURIComponent(id)}&user_id=eq.${owner}`,{method:'DELETE',headers:{Prefer:'return=minimal'}});
          else await ctx.api('/rest/v1/smoking_events?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({id,user_id:owner,event_type:'smoked',smoked_at:job.event.at,cigarettes:job.event.cigarettes})});
          if(ctx.getSession()?.user?.id!==owner||state()!==current)break;
          if(current.smokingMutations[id]===job)delete current.smokingMutations[id];
          save();
        }catch{break;}
      }
    }finally{syncing=false;if(state()===current&&ctx.getSession()?.user?.id===owner&&mode()!=='quit'&&state().stage==='app')ctx.render();}
  }
  let syncingReduction=false;
  async function syncReduction() {
    if(syncingReduction||!ctx.getSession()?.user)return;
    syncingReduction=true;
    const owner=ctx.getSession().user.id,current=state();
    current.reductionSync=normalizeReductionSync(current.reductionSync);
    let changed=false;
    try {
      if(current.reductionSync.planDirty&&current.reductionPlan){
        const row=planToRow(current.reductionPlan,owner);
        if(row){
          await ctx.api('/rest/v1/reduction_plans?on_conflict=user_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(row)});
          if(ctx.getSession()?.user?.id!==owner||state()!==current)return;
          current.reductionSync.planDirty=false;changed=true;save();
        }
      }
      if(current.reductionSync.reviewsDirty){
        const rows=(current.reductionPlan?.history||[]).map(review=>reviewToRow(review,owner)).filter(Boolean);
        if(rows.length)await ctx.api('/rest/v1/reduction_reviews?on_conflict=user_id,reviewed_on,review_start',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(rows)});
        if(ctx.getSession()?.user?.id!==owner||state()!==current)return;
        current.reductionSync.reviewsDirty=false;changed=true;save();
      }
      for(const [day,job] of Object.entries(current.reductionSync.confirmations||{})){
        if(ctx.getSession()?.user?.id!==owner||state()!==current)break;
        try{
          if(job.kind==='delete')await ctx.api(`/rest/v1/daily_smoking_confirmations?user_id=eq.${owner}&day=eq.${encodeURIComponent(day)}`,{method:'DELETE',headers:{Prefer:'return=minimal'}});
          else{
            const row=confirmationMutationToRow(day,job,owner);
            if(!row)continue;
            await ctx.api('/rest/v1/daily_smoking_confirmations?on_conflict=user_id,day',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(row)});
          }
          if(ctx.getSession()?.user?.id!==owner||state()!==current)break;
          if(current.reductionSync.confirmations[day]===job){delete current.reductionSync.confirmations[day];changed=true;}
          save();
        }catch{break;}
      }
    }catch{}finally{syncingReduction=false;if(changed&&state()===current&&ctx.getSession()?.user?.id===owner&&mode()!=='quit'&&state().stage==='app')ctx.render();}
  }
  function syncAll(){void sync();void syncReduction();}
  function queue(id,kind,event){
    state().smokingMutations={...(state().smokingMutations||{}),[id]:{kind,event,ownerId:ctx.getSession()?.user?.id||null}};
  }
  function updateLog(existing,at,cigarettes) {
    const date=new Date(at),count=Number(cigarettes);
    if(!Number.isFinite(+date)||+date>Date.now()||!Number.isInteger(count)||count<1||count>100)throw new Error('Choose a past or current time and 1–100 cigarettes.');
    const id=existing?.cloudId||crypto.randomUUID(),event={at:date.toISOString(),cigarettes:count,cloudId:id};
    state().smokingEvents=(state().smokingEvents||[]).filter(e=>e!==existing);
    state().smokingEvents.push(event);
    // A correction invalidates the old completeness assertion until it is reconfirmed.
    clearDayConfirmation(state(),dayKey(event.at));
    if(existing&&dayKey(existing.at)!==dayKey(event.at))clearDayConfirmation(state(),dayKey(existing.at));
    queue(id,'upsert',event);save();ctx.render();syncAll();
  }
  function quickLog(){try{updateLog(null,new Date(),1);toast('Cigarette logged. Review today to edit or remove it.')}catch(e){toast(e.message)}}
  function editLog(existing=null,day=dayKey()) {
    closeModal();const d=existing?new Date(existing.at):day===dayKey()?new Date():new Date(`${day}T12:00:00`);
    const inputDate=dayKey(d),inputTime=`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    modal(`<div class="sj-modal"><div class="eyebrow">HONEST TRACKING</div><h2>${existing?'EDIT':'ADD'} A LOG</h2><form id="smoking-log-form" class="stack"><label>Date<input class="field" type="date" name="day" max="${dayKey()}" required value="${inputDate}"></label><label>Time<input class="field" type="time" name="time" required value="${inputTime}"></label><label>Cigarettes<input class="field" type="number" name="count" min="1" max="100" step="1" value="${existing?.cigarettes||1}" required></label><p class="muted small">Use the actual smoking time. Grouped logs count toward totals, but make time patterns less precise.</p><button class="primary">SAVE LOG</button></form>${existing?button('REMOVE THIS LOG','data-smoking-remove','danger'):''}</div>`);
    document.querySelector('#smoking-log-form').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target);try{updateLog(existing,`${f.get('day')}T${f.get('time')}`,f.get('count'));closeModal();toast('Log saved.')}catch(err){toast(err.message)}};
    document.querySelector('[data-smoking-remove]')?.addEventListener('click',()=>{
      state().smokingEvents=state().smokingEvents.filter(e=>e!==existing);
      if(existing.cloudId)queue(existing.cloudId,'delete');
      clearDayConfirmation(state(),dayKey(existing.at));save();closeModal();ctx.render();toast('Log removed.');syncAll();
    });
  }
  function dayDetail(key=dayKey()) {
    if(!dayKey(`${key}T12:00:00`)||key>dayKey())return;
    closeModal();const logs=(state().smokingEvents||[]).filter(e=>dayKey(e.at)===key).sort((a,b)=>new Date(b.at)-new Date(a.at));
    const count=logs.reduce((n,e)=>n + +e.cigarettes,0),cloud=Boolean(ctx.getSession()?.user);
    modal(`<div class="sj-modal"><div class="eyebrow">${dateLabel(key)} · YOUR RECORD</div><h2>${count} CIGARETTES</h2><div class="sj-log-list">${logs.length?logs.map((e,i)=>`<button class="secondary" data-smoking-edit="${i}"><span>${new Intl.DateTimeFormat(undefined,{hour:'numeric',minute:'2-digit'}).format(new Date(e.at))}</span><strong>${e.cigarettes} cigarette${e.cigarettes===1?'':'s'}</strong><small>EDIT</small></button>`).join(''):'<p class="muted">No cigarettes recorded. This is not automatically a smoke-free day.</p>'}</div>${button('ADD A MISSING LOG','data-smoking-missing')}<p class="muted small">Confirm only when this is the full day’s total. Adding or changing a log reopens the day.</p>${button(`CONFIRM ${count} AS FULL-DAY TOTAL`,'data-smoking-complete','primary')}${button('MARK DAY INCOMPLETE','data-smoking-incomplete')}<p class="sj-local-note">${cloud?'Completed-day status syncs to your account. Today is excluded from reviews until tomorrow.':'Completed-day status stays on this device until you sign in. Today is excluded from reviews until tomorrow.'}</p></div>`);
    document.querySelectorAll('[data-smoking-edit]').forEach(b=>b.onclick=()=>editLog(logs[+b.dataset.smokingEdit],key));
    document.querySelector('[data-smoking-missing]').onclick=()=>editLog(null,key);
    document.querySelector('[data-smoking-complete]').onclick=()=>{setDayConfirmation(state(),key,count?'complete':'smoke_free',count);save();closeModal();ctx.render();toast('Full-day total confirmed.');void syncReduction();};
    document.querySelector('[data-smoking-incomplete]').onclick=()=>{setDayConfirmation(state(),key,'untracked',count);save();closeModal();ctx.render();toast('Day marked incomplete.');void syncReduction();};
  }
  function chooseDay(){closeModal();modal(`<h2>REVIEW A DAY</h2><form id="smoking-day-form" class="stack"><label>Date<input class="field" name="day" type="date" max="${dayKey()}" value="${dayKey()}" required></label><button class="primary">OPEN DAY</button></form>`);document.querySelector('#smoking-day-form').onsubmit=e=>{e.preventDefault();dayDetail(new FormData(e.target).get('day'))};}
  function review() {
    if(mode()!=='reduce')return;
    closeModal();const s=summary(),r=s.review,p=state().reductionPlan;
    modal(`<div class="sj-modal"><div class="eyebrow">STAGE ${p.stage} · WEEKLY REVIEW</div><h2>${!r.due?'KEEP BUILDING.':r.status==='stable'?'STEADY PROGRESS.':r.status==='mixed'?'STAY WITH IT.':r.status==='struggling'?'GIVE IT TIME.':'A LITTLE MORE DATA.'}</h2><p class="muted">${r.due?esc(r.message):`Your seven-day review opens ${dateLabel(r.dueOn)}. Keep the ${p.currentTarget}/day target until then.`}</p><p>${r.loggedDays} complete past days · ${r.average===null?'No average yet':r.average.toFixed(1)+' cigarettes/day'}</p>${r.due&&r.status!=='collect_more_data'?`${r.action==='offer_adjustment'?button(`TRY ${r.nextTarget}/DAY FOR THE NEXT WEEK`,'data-smoking-apply="adjust"','primary')+button(`KEEP ${p.currentTarget}/DAY`,'data-smoking-apply="hold"'):button(r.action==='reduce'?`START NEXT STAGE · ${r.nextTarget}/DAY`:`KEEP ${p.currentTarget}/DAY FOR NEXT WEEK`,'data-smoking-apply="continue"','primary')}`:button('COMPLETE A PAST DAY','data-smoking-review-day')}${r.action==='offer_quit_transition'&&r.due?button('EXPLORE QUIT NOW','data-smoking-quit'):''}<p class="muted small">Targets never automatically fall below 1/day. A review uses only complete past days and can be applied once per week.</p>${(p.history||[]).length?`<details><summary>Past reviews</summary>${p.history.slice(-8).reverse().map(h=>`<p>${dateLabel(h.reviewedOn)} · ${esc(h.status)} · ${h.target} → ${h.nextTarget}/day</p>`).join('')}</details>`:''}</div>`);
    document.querySelectorAll('[data-smoking-apply]').forEach(b=>b.onclick=()=>{if(commitReview(state(),b.dataset.smokingApply,new Date(),r.windowKey)){save();closeModal();ctx.render();toast('Your next week is ready.');void ctx.persistProfile().catch(()=>toast('Plan saved here. Account target has not synced.'));void syncReduction();}});
    document.querySelector('[data-smoking-review-day]')?.addEventListener('click',chooseDay);
    document.querySelector('[data-smoking-quit]')?.addEventListener('click',()=>{closeModal();state().pathReturn='more';state().stage='path';save();ctx.render();});
  }
  function bind() {
    void syncReduction();
    if(mode()==='quit')return;
    document.querySelector('[data-log-cigarette]')?.addEventListener('click',quickLog);
    document.querySelectorAll('[data-smoking-day]').forEach(b=>b.onclick=()=>dayDetail(b.dataset.smokingDay));
    document.querySelectorAll('[data-smoking-review]').forEach(b=>b.onclick=review);
    document.querySelector('[data-smoking-for-you]')?.addEventListener('click',ctx.openForYou);
    document.querySelector('[data-smoking-add]')?.addEventListener('click',()=>editLog());
    document.querySelector('[data-smoking-add-day]')?.addEventListener('click',chooseDay);
    document.querySelector('[data-smoking-sync]')?.addEventListener('click',syncAll);
  }
  window.addEventListener('online',syncAll);
  return {home,patterns,bind,review,dayDetail,quickLog,sync,syncReduction,save};
}
