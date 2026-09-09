import { createInitialReductionPlan, buildWeeklyReview, applyWeeklyReview, getReductionProgress, summarizeToday } from './reduction-engine.js';

export function dayKey(value = new Date()) {
  const d = new Date(value);
  if (!Number.isFinite(+d)) return '';
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
export function shiftDay(key, offset) {
  const d = new Date(`${key}T12:00:00`);
  d.setDate(d.getDate()+offset);
  return dayKey(d);
}
export function validLogs(events = [], now = new Date()) {
  return events.filter(e => dayKey(e.at) && +new Date(e.at) <= +now && Number.isInteger(+e.cigarettes) && +e.cigarettes > 0);
}
export function dailySeries(state, length = 7, now = new Date(), end = dayKey(now)) {
  const events = validLogs(state.smokingEvents, now);
  return Array.from({length}, (_, i) => {
    const key = shiftDay(end, i-length+1), logs = events.filter(e => dayKey(e.at) === key);
    const count = logs.reduce((sum,e) => sum + +e.cigarettes, 0);
    const confirmation = state.dayConfirmations?.[key];
    // Explicitly untracked days and unfinished days are never evidence of success.
    const complete = confirmation === 'complete' || (confirmation === 'smoke_free' && count === 0);
    return {key, count, logs, complete, known: logs.length > 0 || complete,
      label: new Intl.DateTimeFormat(undefined,{weekday:'short'}).format(new Date(`${key}T12:00:00`)),
      closed: key < dayKey(now)};
  });
}
export function ensurePlan(state, now = new Date()) {
  if (state.profile.journeyMode !== 'reduce') return null;
  if (state.reductionPlan?.version === 1) {
    state.profile.dailyTarget = state.reductionPlan.currentTarget;
    return state.reductionPlan;
  }
  const days = dailySeries(state, 7, now, shiftDay(dayKey(now),-1)).filter(d=>d.complete);
  const plan = createInitialReductionPlan({smokingLogs:days.map(d=>d.count),onboardingEstimate:state.profile.cigarettesPerDay});
  state.reductionPlan = {...plan,version:1,baselineSource:days.length>=4?'confirmed logs':'your estimate',
    startedOn:dayKey(now),reviewStart:dayKey(now),history:[],targetHistory:[{from:dayKey(now),target:plan.currentTarget}]};
  state.profile.dailyTarget = plan.currentTarget;
  return state.reductionPlan;
}
export function switchJourney(state, nextMode, now = new Date()) {
  if (!['quit','reduce','track'].includes(nextMode)) return false;
  const previous = state.profile.journeyMode;
  if (previous !== nextMode && state.reductionPlan) {
    const plan = state.reductionPlan;
    if (previous === 'reduce' || nextMode === 'reduce') {
      plan.targetHistory = [...(plan.targetHistory||[]), {from:dayKey(now),target:nextMode==='reduce'?plan.currentTarget:null}];
    }
    if (nextMode === 'reduce') plan.reviewStart = dayKey(now);
  }
  state.profile.journeyMode = nextMode;
  return true;
}
export function reviewState(state, now = new Date()) {
  const plan = state.reductionPlan;
  if (!plan) return null;
  const dueOn = shiftDay(plan.reviewStart,7), today = dayKey(now), due = today >= dueOn;
  // After a long absence review the most recent seven closed days, never today's partial total.
  const days = dailySeries(state,7,now,shiftDay(today,-1)).filter(d=>d.key>=plan.reviewStart);
  const counts = days.filter(d=>d.complete).map(d=>d.count);
  const review = buildWeeklyReview({dailyCounts:counts,target:plan.currentTarget,previousReviewStatus:plan.lastReviewStatus});
  return {...review,counts,days,dueOn,due,windowKey:`${plan.reviewStart}:${today}`};
}
export function commitReview(state, choice = 'continue', now = new Date(), expectedWindow) {
  const review = reviewState(state,now), plan = state.reductionPlan;
  if (!review?.due || review.status === 'collect_more_data' || (expectedWindow && expectedWindow!==review.windowKey)) return false;
  if (review.action === 'offer_adjustment' && !['adjust','hold'].includes(choice)) return false;
  let next = applyWeeklyReview(plan,review.counts);
  if (review.action === 'offer_adjustment' && choice === 'hold') next.currentTarget = plan.currentTarget;
  const today = dayKey(now);
  next = {...next,reviewStart:today,history:[...(plan.history||[]),{
    reviewedOn:today,from:plan.reviewStart,target:plan.currentTarget,nextTarget:next.currentTarget,
    status:review.status,loggedDays:review.loggedDays,average:review.average,choice
  }],targetHistory:[...(plan.targetHistory||[]),{from:today,target:next.currentTarget}]};
  state.reductionPlan = next;
  state.profile.dailyTarget = next.currentTarget;
  return true;
}
export function targetOn(plan, key) {
  return [...(plan?.targetHistory||[])].reverse().find(item=>item.from<=key)?.target ?? null;
}
export function journeySummary(state, now = new Date()) {
  const days = dailySeries(state,7,now), closed = days.filter(d=>d.closed&&d.complete);
  const events = validLogs(state.smokingEvents,now), recent = events.filter(e=>dayKey(e.at)>=days[0].key);
  const total = recent.reduce((sum,e)=>sum + +e.cigarettes,0);
  const average = closed.length ? closed.reduce((sum,d)=>sum+d.count,0)/closed.length : null;
  const previous = dailySeries(state,7,now,shiftDay(days[0].key,-1)).filter(d=>d.complete);
  const previousAverage = previous.length>=4 ? previous.reduce((sum,d)=>sum+d.count,0)/previous.length : null;
  const change = closed.length>=4 && previousAverage!==null ? average-previousAverage : null;
  const plan = state.profile.journeyMode==='reduce' ? state.reductionPlan : null;
  const history = dailySeries(state,90,now,shiftDay(dayKey(now),-1));
  let consistency = 0, targetStreak = 0;
  for (const d of [...history].reverse()) { if (!d.complete) break; consistency++; }
  if (plan) for (const d of [...history].reverse()) {
    const target = targetOn(plan,d.key);
    if (!d.complete || target===null || d.count>target) break;
    targetStreak++;
  }
  const buckets = [0,0,0,0], labels = ['overnight (00–06)','morning (06–12)','afternoon (12–18)','evening (18–24)'];
  recent.forEach(e=>buckets[Math.floor(new Date(e.at).getHours()/6)] += +e.cigarettes);
  const enoughPattern = new Set(recent.map(e=>dayKey(e.at))).size>=3 && total>=5;
  const peak = Math.max(...buckets), peakIndexes = buckets.map((v,i)=>v===peak?i:-1).filter(i=>i>=0);
  const hardTime = enoughPattern && peakIndexes.length===1 ? {label:labels[peakIndexes[0]],count:peak,percent:Math.round(peak/total*100)} : null;
  const hardDay = closed.length>=4 ? [...closed].sort((a,b)=>b.count-a.count)[0] : null;
  const bestDay = closed.length>=4 ? [...closed].sort((a,b)=>a.count-b.count)[0] : null;
  const actualDays = plan ? closed.filter(d=>targetOn(plan,d.key)!==null) : [];
  return {days,closed,events,recent,total,average,change,consistency,targetStreak,hardTime,hardDay,bestDay,
    today:days.at(-1),last:[...events].sort((a,b)=>new Date(b.at)-new Date(a.at))[0],
    todayProgress:plan?summarizeToday({smoked:days.at(-1).count,target:plan.currentTarget}):null,
    progress:plan?getReductionProgress(plan):null,
    successDays:actualDays.filter(d=>d.count<=targetOn(plan,d.key)).length,targetDays:actualDays.length,
    actualReduction:plan&&closed.length>=4?Math.round((plan.baseline-average)/plan.baseline*100):null,
    review:plan?reviewState(state,now):null};
}
export function journeyCards(state, now = new Date()) {
  const s = journeySummary(state,now), cards=[];
  const card=(priority,icon,title,body,action,label)=>cards.push({priority,icon,title,body,action,label});
  if(s.todayProgress?.overBy)card('Act now','favorite','A harder day does not reset your progress',`You have logged ${s.todayProgress.overBy} above today’s target. Your target stays steady until review.`, 'start-reset','TAKE A BREATH');
  const cluster=s.recent.filter(e=>+now-new Date(e.at)<=2*3600000).reduce((n,e)=>n + +e.cigarettes,0);
  if(cluster>=3)card('Act now','pause_circle','Several cigarettes close together',`${cluster} cigarettes logged in the last two hours. Try a short pause or a change of place.`, 'start-reset','START A RESET');
  if(s.review?.due)card('Notice this','date_range',s.review.status==='collect_more_data'?'Your review needs more complete days':'Your stage review is ready',s.review.message,'review-target','REVIEW MY STAGE');
  const yesterday=shiftDay(dayKey(now),-1), d=dailySeries(state,1,now,yesterday)[0];
  if(!d.complete && (s.events.length||state.reductionPlan))card('Notice this','edit_note','Complete yesterday’s record','Confirm the full total, including zero, so missing logs never become progress.','confirm-yesterday','REVIEW YESTERDAY');
  if(s.hardTime)card('Notice this','schedule','Your busiest smoking window',`${s.hardTime.percent}% of cigarettes logged this week were in the ${s.hardTime.label}. A different routine may help here.`,'see-pattern','EXPLORE PATTERNS');
  if(s.consistency>=2)card('Celebrate progress','task_alt',`${s.consistency} complete days in a row`,'Honest, complete records make your patterns more useful.','see-pattern','SEE MY PATTERNS');
  if(!cards.length)card('Notice this','visibility','Your pattern starts with one log','Log each cigarette and confirm completed days. Insights appear as your history grows.','view-today','VIEW TODAY');
  return cards.slice(0,4);
}
// Apply pending changes over cloud history so offline edits/deletes survive reload.
export function overlaySmokingMutations(events, mutations = {}) {
  const result = [...events];
  for (const [id, mutation] of Object.entries(mutations)) {
    for(let i=result.length-1;i>=0;i--) if(result[i].cloudId===id) result.splice(i,1);
    if(mutation.kind!=='delete') result.push(mutation.event);
  }
  return result.sort((a,b)=>new Date(a.at)-new Date(b.at));
}
