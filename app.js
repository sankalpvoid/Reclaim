import { sectionHeading, toolArtwork } from './v2-presentation.js';
import { todayHero, todayNextStep } from './today-screen.js';
import './cloud-bootstrap.js?v=cloud-bootstrap-2';
import { ensurePlan, journeyCards, dayKey, shiftDay, switchJourney } from './smoking-journey.js';
import { createSmokingJourney } from './smoking-journey-ui.js';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import { refreshStoredSession, readStoredSession } from './session-refresh.js';
const $ = (s, root=document) => root.querySelector(s);
const STORAGE='reclaim-state-v2', SESSION='reclaim-session-v1', THEME_STORAGE='reclaim-theme-v1';
let theme=localStorage.getItem(THEME_STORAGE)==='light'?'light':'dark';
function applyTheme(next=theme){theme=next==='light'?'light':'dark';document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme;const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=theme==='light'?'#f8f6fc':'#000000'}
if(new URLSearchParams(location.search).get('theme-preview')==='light')theme='light';
applyTheme();
const now = new Date();
const COUNTRIES=[['IN','India','INR','en-IN'],['US','United States','USD','en-US'],['GB','United Kingdom','GBP','en-GB'],['CA','Canada','CAD','en-CA'],['AU','Australia','AUD','en-AU'],['NZ','New Zealand','NZD','en-NZ'],['AE','United Arab Emirates','AED','en-AE'],['SA','Saudi Arabia','SAR','en-SA'],['QA','Qatar','QAR','en-QA'],['SG','Singapore','SGD','en-SG'],['MY','Malaysia','MYR','en-MY'],['JP','Japan','JPY','ja-JP'],['CN','China','CNY','zh-CN'],['KR','South Korea','KRW','ko-KR'],['PH','Philippines','PHP','en-PH'],['ID','Indonesia','IDR','id-ID'],['TH','Thailand','THB','th-TH'],['VN','Vietnam','VND','vi-VN'],['PK','Pakistan','PKR','en-PK'],['BD','Bangladesh','BDT','bn-BD'],['LK','Sri Lanka','LKR','en-LK'],['NP','Nepal','NPR','en-NP'],['ZA','South Africa','ZAR','en-ZA'],['NG','Nigeria','NGN','en-NG'],['KE','Kenya','KES','en-KE'],['BR','Brazil','BRL','pt-BR'],['MX','Mexico','MXN','es-MX'],['AR','Argentina','ARS','es-AR'],['CH','Switzerland','CHF','de-CH'],['SE','Sweden','SEK','sv-SE'],['NO','Norway','NOK','nb-NO'],['DK','Denmark','DKK','da-DK'],['PL','Poland','PLN','pl-PL'],['TR','Turkey','TRY','tr-TR'],['IL','Israel','ILS','he-IL'],['DE','Germany','EUR','de-DE'],['FR','France','EUR','fr-FR'],['ES','Spain','EUR','es-ES'],['IT','Italy','EUR','it-IT'],['NL','Netherlands','EUR','nl-NL']];
const STAGE_CIRCLES=[
  {key:'first72',id:'00000000-0000-0000-0000-000000000010',label:'First 72h',title:'FIRST 72 HOURS',min:0,max:2,copy:'Stay close. Focus on the next small decision.'},
  {key:'firstWeek',id:'00000000-0000-0000-0000-000000000011',label:'First week',title:'FIRST WEEK',min:3,max:6,copy:'Compare notes with people building their first rhythm.'},
  {key:'firstMonth',id:'00000000-0000-0000-0000-000000000012',label:'First month',title:'FIRST MONTH',min:7,max:29,copy:'Protect new routines and make progress visible.'},
  {key:'beyond',id:'00000000-0000-0000-0000-000000000001',label:'30+ days',title:'30 DAYS & BEYOND',min:30,max:Infinity,copy:'Keep growing—and leave a light on for people behind you.'}
];
const seed={stage:'intro',view:'home',authMode:'signup',profile:{name:'',journeyMode:'quit',quitAt:new Date().toISOString(),cigarettesPerDay:20,dailyTarget:15,pricePerPack:300,cigarettesPerPack:20,minutesPerCigarette:11,country:'IN',currency:'₹',currencyCode:'INR',attemptNumber:1,bestStreakSeconds:0},smokingEvents:[],checkins:[],cravings:[],goals:[{id:'camera',name:'New Camera',target:15000}],posts:[{id:'maya-story',userId:'seed-maya',initial:'M',name:'Maya',days:31,text:'One month today. The difficult evenings became easier when I stopped trying to fight the whole future and focused on the next ten minutes.',topic:'win',circleId:'00000000-0000-0000-0000-000000000001',cheers:18,cheered:false,featured:true,replyCount:2,createdAt:new Date(now-2*36e5).toISOString()},{id:'rohan-story',userId:'seed-rohan',initial:'R',name:'Rohan',days:9,text:'Walked through my usual smoke break today. Small win, but it felt huge.',topic:'win',circleId:'00000000-0000-0000-0000-000000000012',cheers:11,cheered:false,replyCount:1,createdAt:new Date(now-5*36e5).toISOString()}],replies:[{id:'seed-reply-1',postId:'maya-story',userId:'seed-nia',name:'Nia',text:'The next ten minutes idea helped me tonight. Thank you.',createdAt:new Date(now-70*60e3).toISOString()},{id:'seed-reply-2',postId:'maya-story',userId:'seed-omar',name:'Omar',text:'One decision at a time. Congratulations on the month.',createdAt:new Date(now-35*60e3).toISOString()},{id:'seed-reply-3',postId:'rohan-story',userId:'seed-maya',name:'Maya',text:'Changing the usual break routine is a huge win.',createdAt:new Date(now-3*36e5).toISOString()}],savedPostIds:[],blockedUsers:[],reportedTargets:[],communityReports:[],communityFilter:'all',communityView:'feed',communityStage:null,communityStageTouched:false,challengeCompletions:[]};
let state=load(); let session=loadSession(); let breathing=null; let cravingTimer=null;
const smokingJourney=createSmokingJourney({getState:()=>state,getSession:()=>session,save,render,api,persistProfile,esc,money,appIcon,shell,top,modal,closeModal,toast,openForYou});
const previousVisitAt=state.lastVisitAt||null;
state.lastVisitAt=new Date().toISOString();
save();
function loadSession(){try{return JSON.parse(localStorage.getItem(SESSION)||'null')}catch{return null}}
function saveSession(value){session=value;if(value)localStorage.setItem(SESSION,JSON.stringify(value));else localStorage.removeItem(SESSION)}
function authHeaders(){const h={apikey:SUPABASE_KEY,'Content-Type':'application/json'};if(session?.access_token)h.Authorization=`Bearer ${session.access_token}`;return h}
async function refreshSession(){try{session=await refreshStoredSession(session?.refresh_token);return session}catch(error){if(!readStoredSession())session=null;throw error}}
async function acceptOAuth(){const p=new URLSearchParams(location.hash.slice(1)),token=p.get('access_token'),refresh=p.get('refresh_token');if(!token)return false;history.replaceState({},'',location.pathname);try{const r=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${token}`}});if(!r.ok)return false;const user=await r.json();if(!user?.id||!refresh)return false;saveSession({access_token:token,refresh_token:refresh,user});state.stage='setup';save();return true}catch{return false}}
async function api(path,options={}){const {_retried,...requestOptions}=options,r=await fetch(`${SUPABASE_URL}${path}`,{...requestOptions,headers:{...authHeaders(),...(requestOptions.headers||{})}});const body=await r.text();let data;try{data=body?JSON.parse(body):null}catch{data=body}if(!r.ok){const message=data?.msg||data?.message||data?.error_description||data?.hint||`Request failed (${r.status})`;if((r.status===401||r.status===403)&&!_retried&&session?.refresh_token&&/jwt|token|expired/i.test(message)){await refreshSession();return api(path,{...requestOptions,_retried:true})}throw new Error(message)}return data}
function load(){try{const stored=JSON.parse(localStorage.getItem(STORAGE)||'{}'),loaded={...seed,...stored};delete loaded.celebration;delete loaded.celebratedMilestones;loaded.profile={...seed.profile,...(loaded.profile||{})};loaded.smokingEvents=loaded.smokingEvents||[];loaded.posts=(loaded.posts||[]).map((post,index)=>({...post,topic:post.topic||'win',circleId:post.circleId||circleForDays(+post.days||0).id,createdAt:post.createdAt||new Date(Date.now()-(index+2)*36e5).toISOString(),cheered:!!post.cheered}));loaded.replies=loaded.replies||[];loaded.savedPostIds=loaded.savedPostIds||[];loaded.blockedUsers=loaded.blockedUsers||[];loaded.reportedTargets=loaded.reportedTargets||[];loaded.communityReports=loaded.communityReports||[];loaded.challengeCompletions=loaded.challengeCompletions||[];return loaded}catch{return structuredClone(seed)}}
function save(){if(state.stage!=='setup'&&state.stage!=='path')ensurePlan(state);localStorage.setItem(STORAGE,JSON.stringify(state))}
function esc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function metrics(){const p=state.profile;const ms=Math.max(0,Date.now()-new Date(p.quitAt).getTime());const days=ms/864e5;const avoided=days*p.cigarettesPerDay;const saved=avoided*(p.pricePerPack/p.cigarettesPerPack);return {ms,days,avoided,saved,minutes:avoided*p.minutesPerCigarette}}
function journeyMode(){return state.profile.journeyMode||'quit'}
function journeyLabel(mode=journeyMode()){return ({quit:'Quit now',reduce:'Smoke less',track:'Understand my smoking'}[mode]||'Quit now')}
function smokingStats(){const events=state.smokingEvents||[],today=localDateKey(new Date()),todayEvents=events.filter(event=>localDateKey(new Date(event.at))===today),count=items=>items.reduce((sum,event)=>sum+(+event.cigarettes||1),0),todayCount=count(todayEvents),priceEach=(+state.profile.pricePerPack||0)/(+state.profile.cigarettesPerPack||1),days=Array.from({length:7},(_,index)=>{const date=new Date();date.setHours(0,0,0,0);date.setDate(date.getDate()-(6-index));const key=localDateKey(date);return {key,label:new Intl.DateTimeFormat(undefined,{weekday:'short'}).format(date).slice(0,1),count:count(events.filter(event=>localDateKey(new Date(event.at))===key))}}),weekCount=days.reduce((sum,day)=>sum+day.count,0),average=weekCount/7,last=[...events].sort((a,b)=>new Date(b.at)-new Date(a.at))[0];return {todayCount,todayCost:todayCount*priceEach,weekCount,weekCost:weekCount*priceEach,average,days,last}}
function countForDate(date){const key=localDateKey(date);return (state.smokingEvents||[]).filter(event=>localDateKey(new Date(event.at))===key).reduce((sum,event)=>sum+(+event.cigarettes||1),0)}
function forYouCards(){
  if(journeyMode()!=='quit')return state.stage==='app'?journeyCards(state):[];
  const card=(priority,icon,title,body,action,label)=>({priority,icon,title,body,action,label});
  if(new URLSearchParams(location.search).get('for-you-preview')==='all')return [
    card('Act now','warning','A tight cluster just appeared','Three cigarettes were logged close together. A short interruption now may help break the pattern.','start-reset','START A RESET'),
    card('Notice this','date_range','Your seven-day progress review is ready','See the choices, patterns and progress that shaped this week.','open-review','OPEN REVIEW'),
    card('Celebrate progress','savings','One pack away from 50% of New Camera','Skipping the cost of one pack would move this dream to its next funding checkpoint.','view-dream','VIEW DREAM')
  ];
  if(state.stage!=='app')return [];
  const mode=journeyMode(),stats=smokingStats(),profile=state.profile,events=[...(state.smokingEvents||[])].sort((a,b)=>new Date(a.at)-new Date(b.at)),nowMs=Date.now(),act=[],notice=[],celebrate=[];

  if(events.length>=3){const recent=events.slice(-3).map(event=>new Date(event.at).getTime());if(nowMs-recent[2]<3*36e5&&recent[2]-recent[0]<=2*36e5)act.push(card('Act now','warning','A tight cluster just appeared','Three cigarettes were logged close together. A short interruption now may help break the pattern.','start-reset','START A RESET'))}
  if(mode==='reduce'){
    const remaining=Math.max(0,(+profile.dailyTarget||0)-stats.todayCount);
    if(remaining<=2&&remaining>0)act.push(card('Act now','track_changes',`${remaining} cigarette${remaining===1?'':'s'} left in today’s target`,'You are close to the limit you chose for today.','view-today','VIEW TODAY'));
  }
  if(mode!=='quit'){
    const yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);const key=localDateKey(yesterday),confirmed=state.dayConfirmations?.[key];
    if(!countForDate(yesterday)&&!confirmed&&(events.length||Object.keys(state.dayConfirmations||{}).length))act.push(card('Act now','event_busy','Yesterday is still unclear','Was it smoke-free, or did you simply not track it? Confirming keeps your patterns honest.','confirm-yesterday','CONFIRM YESTERDAY'));
  }
  const relapseDays=(state.relapses||[]).map(item=>Math.round((+item.streakSeconds||0)/86400)).filter(days=>days>=3),currentDay=Math.floor(metrics().days);
  if(relapseDays.length){const difficult=relapseDays.at(-1);if(currentDay>=difficult-2&&currentDay<=difficult)act.push(card('Act now','shield','Prepare for a familiar difficult point',`A previous attempt became difficult around day ${difficult}. You are approaching that point again—with more information this time.`,'prepare-plan','PREPARE A PLAN'))}

  if(previousVisitAt){const gapDays=Math.floor((nowMs-new Date(previousVisitAt).getTime())/864e5);if(gapDays>=2)notice.push(card('Notice this','history','Welcome back',`Here is what changed during your last ${gapDays} days away from Reclaim.`,'catch-up','CATCH UP'))}
  const ownPostIds=new Set((state.posts||[]).filter(post=>post.userId&&post.userId===session?.user?.id).map(post=>String(post.id))),unreadReplies=(state.replies||[]).filter(reply=>ownPostIds.has(String(reply.postId))&&reply.userId!==session?.user?.id&&!(state.readReplyIds||[]).includes(String(reply.id)));
  if(unreadReplies.length)notice.push(card('Notice this','mark_chat_unread',`${unreadReplies.length} new ${unreadReplies.length===1?'reply':'replies'} to your story`,'Someone in your stage circle responded to something you shared.','read-reply','READ REPLIES'));
  const lastReview=state.lastWeeklyReviewAt?new Date(state.lastWeeklyReviewAt).getTime():0,hasWeek=metrics().days>=7||events.some(event=>nowMs-new Date(event.at).getTime()<7*864e5);
  if(hasWeek&&nowMs-lastReview>=7*864e5)notice.push(card('Notice this','date_range','Your seven-day progress review is ready','See the choices, patterns and progress that shaped this week.','open-review','OPEN REVIEW'));
  if(mode==='reduce'){
    const observed=Array.from({length:14},(_,index)=>{const date=new Date();date.setHours(0,0,0,0);date.setDate(date.getDate()-index);const key=localDateKey(date),count=countForDate(date);return {count,known:count>0||Boolean(state.dayConfirmations?.[key])}}).filter(day=>day.known);
    if(observed.length>=10&&observed.every(day=>day.count<=(+profile.dailyTarget||0)))notice.push(card('Notice this','tune','Your target may be ready for review','You have stayed within your daily target across two weeks of recorded days. A small reduction may now feel realistic.','review-target','REVIEW TARGET'));
  }
  const stage=circleForDays(Math.floor(metrics().days)),stageLearning=(state.posts||[]).filter(post=>String(post.circleId||'')===stage.id&&['craving','advice'].includes(post.topic));
  if(stageLearning.length)notice.push(card('Notice this','groups','People at your stage are sharing what helped',`${stageLearning.length} relevant ${stageLearning.length===1?'story is':'stories are'} available in ${stage.label.toLowerCase()}.`,'view-stories','VIEW STORIES'));
  if((state.cravings||[]).length>=3&&!(state.cravings||[]).some(craving=>craving.tool==='timer'))notice.push(card('Notice this','waves','A useful tool is still unexplored','You have logged several cravings but have not tried Ride the Wave yet.','try-wave','TRY IT'));

  if(mode!=='quit'){
    const distinctDays=new Set(events.filter(event=>nowMs-new Date(event.at).getTime()<7*864e5).map(event=>localDateKey(new Date(event.at))));const fewer=Math.max(0,Math.round((+profile.cigarettesPerDay||0)*7-stats.weekCount));
    if(fewer>=2&&distinctDays.size>=4)celebrate.push(card('Celebrate progress','trending_down',`${fewer} fewer cigarettes than your usual week`,'Your recorded choices are moving below your baseline. See which days made the difference.','see-pattern','SEE WHAT CHANGED'));
  }
  const goal=(state.goals||[])[0],m=metrics();
  if(goal){const marks=[25,50,75,100],pct=m.saved/(+goal.target||1)*100,next=marks.find(mark=>pct<mark),packCost=+profile.pricePerPack||0;if(next&&m.saved+packCost>=+goal.target*next/100)celebrate.push(card('Celebrate progress','savings',`One pack away from ${next}% of ${goal.name}`,`Skipping the cost of one pack would move this dream to its next funding checkpoint.`,'view-dream','VIEW DREAM'))}

  return [act[0],notice[0],celebrate[0]].filter(Boolean);
}
function countryInfo(code=state.profile.country){return COUNTRIES.find(x=>x[0]===code)||COUNTRIES[0]}
function countryFromCurrency(symbol){return ({'₹':'IN','$':'US','£':'GB','€':'DE','¥':'JP','₩':'KR','₱':'PH','₺':'TR','₪':'IL'}[symbol]||'IN')}
function currencySymbol(code){const [, ,currency,locale]=countryInfo(code);return new Intl.NumberFormat(locale,{style:'currency',currency,currencyDisplay:'narrowSymbol',maximumFractionDigits:0}).formatToParts(0).find(x=>x.type==='currency')?.value||currency}
function money(v){const [, ,currency,locale]=countryInfo(state.profile.country||countryFromCurrency(state.profile.currency));return new Intl.NumberFormat(locale,{style:'currency',currency,currencyDisplay:'narrowSymbol',maximumFractionDigits:0}).format(Math.floor(v))}
function countryOptions(selected){return COUNTRIES.map(([code,name])=>`<option value="${code}" ${code===selected?'selected':''}>${name}</option>`).join('')}
function appIcon(name,label=''){return `<span class="material-symbols-rounded app-icon"${label?` aria-label="${esc(label)}"`:' aria-hidden="true"'}>${name}</span>`}
const icons={home:'home',health:'favorite',momentum:'bolt',dreams:'my_location',insights:'monitoring',more:'more_horiz'};
function top(title,back=false,bare=false){const hasSignal=forYouCards().length>0;if(bare&&!back)return `<header class="topbar"><span class="icon-btn" aria-hidden="true" style="visibility:hidden"></span><div class="brand">${title}</div><span class="icon-btn" aria-hidden="true" style="visibility:hidden"></span></header>`;return `<header class="topbar"><button class="icon-btn menu-trigger" ${back?`data-back="true" aria-label="Go back"`:'data-menu aria-label="Open menu"'}>${back?'‹':'<span></span><span></span><span></span>'}</button><div class="brand">${title}</div>${bare?'<span class="icon-btn" aria-hidden="true" style="visibility:hidden"></span>':`<button class="icon-btn checkin-trigger for-you-trigger" data-for-you aria-label="Open For You">${appIcon('notifications')}${hasSignal?'<i aria-hidden="true"></i>':''}</button>`}</header>`}
function nav(){const items=journeyMode()==='quit'?[['home','HOME'],['health','HEALTH'],['momentum','MOMENTUM'],['dreams','DREAMS'],['more','MORE']]:[['home','TODAY'],['insights','PATTERNS'],['more','MORE']];return `<nav class="nav ${journeyMode()==='quit'?'':'tracking-nav'}">${items.map(([view,label])=>`<button data-view="${view}" class="${state.view===view?'active':''}">${appIcon(icons[view])}<small>${label}</small></button>`).join('')}</nav><button class="fab" data-view="craving" aria-label="Open craving support">${appIcon('add')}</button>`}
function shell(content,withNav=true){return `<main class="shell ${content.includes('intro-reference')?'':'reclaim-v2'}">${content}${withNav?nav():''}</main>`}
function intro(){const nextStage=session?.access_token?'mood':'auth';return shell(`<section class="screen full intro intro-reference" aria-label="Reclaim. Take back your time. Take back your health. Namaste. Welcome to Reclaim. You've got the strength to change. We're here to walk the journey with you."><div class="intro-reference-crop" aria-hidden="true"><img src="assets/namaste-intro-reference.jpg" alt=""></div><button class="intro-reference-cta" data-stage="${nextStage}" aria-label="Begin journey"><span>BEGIN JOURNEY</span></button></section>`,false)}
function auth(){return shell(`<section class="screen full auth-screen"><div class="brand">RECLAIM</div><div style="margin-top:44px"><div class="auth-toggle"><button data-auth="signup" class="${state.authMode==='signup'?'active':''}">Create account</button><button data-auth="login" class="${state.authMode==='login'?'active':''}">Log in</button></div>${sectionHeading(state.authMode==='signup'?'Your next<br>chapter.':'Welcome<br>back.')}<p class="muted">A private place to reclaim your time, health and money.</p><form id="auth-form" class="stack">${state.authMode==='signup'   ? `<label>Name<input class="field" name="name" value="" required placeholder="Your name" autocomplete="name"></label>`   : '' }<label>Email<input class="field" name="email" type="email" required autocomplete="email" placeholder="you@example.com"></label><label>Password<input class="field" name="password" type="password" minlength="6" required placeholder="6+ characters"></label><button class="primary">${state.authMode==='signup'?'CREATE ACCOUNT':'LOG IN'}</button><button type="button" class="secondary" data-google>CONTINUE WITH GOOGLE</button></form><p class="muted small">Your account keeps your progress safe and in sync across devices.</p></div></section>`,false)}
function choosePath(){const current=journeyMode();return shell(`<section class="screen full path-screen">${top('CHOOSE YOUR PACE',state.pathReturn==='more',true)}<div class="path-heading"><div class="eyebrow">No pressure. You can change this later.</div>${sectionHeading('Find your<br>own pace.')}<p class="muted">Reclaim will shape the experience around where you are—not where you think you should be.</p></div><div class="path-options"><button class="path-card ${current==='quit'?'selected':''}" data-journey-mode="quit"><span class="path-icon">${appIcon('flag')}</span><span><strong>QUIT NOW</strong><small>Build a smoke-free streak and see what you reclaim.</small></span><b>${current==='quit'?'✓':'›'}</b></button><button class="path-card ${current==='reduce'?'selected':''}" data-journey-mode="reduce"><span class="path-icon">${appIcon('trending_down')}</span><span><strong>SMOKE LESS</strong><small>Track each cigarette and work toward a gentler daily target.</small></span><b>${current==='reduce'?'✓':'›'}</b></button><button class="path-card ${current==='track'?'selected':''}" data-journey-mode="track"><span class="path-icon">${appIcon('visibility')}</span><span><strong>UNDERSTAND MY SMOKING</strong><small>Notice your pattern without committing to quitting yet.</small></span><b>${current==='track'?'✓':'›'}</b></button></div><p class="path-note">Every path is private. Every honest log counts as useful information.</p></section>`,false)}
function toLocalDateTimeInput(value){
  const d = value ? new Date(value) : new Date();
  const pad = n => String(n).padStart(2, '0');

  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function setup(){const p=state.profile,mode=journeyMode(),selected=p.country||countryFromCurrency(p.currency),info=countryInfo(selected),tracking=mode!=='quit',quitValue=toLocalDateTimeInput(p.quitAt),quitLabel=new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(p.quitAt));return shell(`<section class="screen full setup-screen">${top(tracking?'YOUR TRACKING PLAN':'YOUR QUIT PLAN',false,state.pathReturn!=='more')}<div class="setup-mode"><span>${appIcon(tracking?'monitoring':'flag')}</span><div><small>YOUR PACE</small><strong>${journeyLabel(mode)}</strong></div><button type="button" data-change-path>CHANGE</button></div>${sectionHeading('Make it<br>yours.')}<p class="muted">${tracking?'A few details turn each quick log into a useful pattern.':'These details power your live Reclaim calculations.'}</p><form id="setup-form" class="stack">${tracking?'':`<label>Your quit date and time<input id="quit-at-value" name="quitAt" type="hidden" required value="${quitValue}"><button class="field quit-date-trigger" type="button" data-open-quit-picker><span><small>QUIT STARTED</small><strong data-quit-date-label>${quitLabel}</strong></span>${appIcon('calendar_month')}</button></label>`}<label>Country<select class="field" name="country" required>${countryOptions(selected)}</select><small class="currency-preview" id="currency-preview">Currency: ${info[2]} (${currencySymbol(selected)})</small></label><label>${tracking?'Your usual cigarettes per day':'Cigarettes per day'}<input class="field" name="cigarettesPerDay" type="number" min="1" max="100" required value="${p.cigarettesPerDay}"></label>${mode==='reduce'?`<article class="card"><strong>${state.reductionPlan?'Current target: '+state.reductionPlan.currentTarget+'/day':'A gentle target, based on your baseline'}</strong><p class="muted small">${state.reductionPlan?'Your plan advances through weekly reviews on Today. Editing these inputs preserves your plan history.':'We use at least 4 confirmed recent days when available; otherwise your usual count. The first target is about 10% lower, with a minimum step of 1. Weekly reviews never automatically go below 1/day.'}</p></article>`:''}<label>Price per pack<input class="field" name="pricePerPack" type="number" min="0" step="0.01" required value="${p.pricePerPack}"></label><label>Cigarettes per pack<input class="field" name="cigarettesPerPack" type="number" min="1" required value="${p.cigarettesPerPack}"></label><div class="spacer"></div><button class="primary">SAVE & CONTINUE</button></form></section>`,false)}
function mood(){return shell(`<section class="screen full mood-screen"><div class="brand">RECLAIM</div>${sectionHeading('How are<br>you today?')}<p class="muted">Your journey matters.<br>Let's keep going.</p><div class="stack" style="margin-top:25px">${[['great','🙂','I’m feeling great','Let’s keep the streak alive!'],['okay','😐','I’m okay','Getting there.'],['struggling','☹','I’m struggling','Need some support.'],['craving','✹','I’m having strong cravings','Help me get through this!']].map(x=>`<button class="card mood" data-mood="${x[0]}"><span class="mood-icon">${x[1]}</span><span><strong>${x[2]}</strong><small>${x[3]}</small></span></button>`).join('')}</div><div class="spacer"></div><p class="muted small" style="text-align:center">You're not alone. We’ve got you.</p></section>`,false)}
function strugglingSupport(){
  const m = metrics();
  const t = elapsedParts(m.ms);

  const smokeFreeTime =
    t.days > 0
      ? `${t.days} DAY${t.days === 1 ? '' : 'S'}`
      : t.hours > 0
        ? `${t.hours} HOUR${t.hours === 1 ? '' : 'S'}`
        : `${Math.max(1,t.minutes)} MIN`;

  return shell(`
    <section class="screen full struggling-support">
      ${top('RECLAIM', true)}

      <div style="margin-top:30px">
        <p class="muted small">RIGHT NOW</p>

        ${sectionHeading('Room for<br>a hard day.')}

        <p class="muted">
          You don't have to fix the whole day.<br>
          Look at what you've already reclaimed.
        </p>
      </div>

      <div class="stack" style="margin-top:28px">

        <div class="card" style="text-align:center">
          <strong style="font-size:32px">${Math.floor(m.avoided)}</strong>
          <small style="display:block">CIGARETTES AVOIDED</small>
        </div>

        <div class="card" style="text-align:center">
          <strong style="font-size:32px">${money(m.saved)}</strong>
          <small style="display:block">MONEY RECLAIMED</small>
        </div>

        <div class="card" style="text-align:center">
          <strong style="font-size:32px">${smokeFreeTime}</strong>
          <small style="display:block">SMOKE-FREE</small>
        </div>

      </div>

      <h2 style="margin-top:36px">WHAT WOULD<br>HELP RIGHT NOW?</h2>

      <div class="stack" style="margin-top:18px">

        <button class="card" data-support="reset">
          <strong>60-SECOND RESET</strong>
          <small style="display:block">Clear my head</small>
        </button>

        <button class="card" data-support="circle">
          <strong>MY CIRCLE</strong>
          <small style="display:block">Talk to people who get it</small>
        </button>

        <button class="card" data-support="craving">
          <strong>CRAVING HELP</strong>
          <small style="display:block">I think I might smoke</small>
        </button>

      </div>

      <button
        class="secondary"
        data-support="dashboard"
        style="margin-top:20px;width:100%"
      >
        TAKE ME TO MY DASHBOARD
      </button>

      <div style="height:30px"></div>
    </section>
  `, false);
}
function elapsedParts(ms){const total=Math.max(0,Math.floor(ms/1000));return {days:Math.floor(total/86400),hours:Math.floor(total%86400/3600),minutes:Math.floor(total%3600/60),seconds:total%60}}
function elapsedMarkup(ms){const t=elapsedParts(ms);return `<span><b>${t.days}</b><small>days</small></span><span><b>${String(t.hours).padStart(2,'0')}</b><small>hours</small></span><span><b>${String(t.minutes).padStart(2,'0')}</b><small>minutes</small></span><span><b>${String(t.seconds).padStart(2,'0')}</b><small>seconds</small></span>`}
function homeClockMarkup(ms){const t=elapsedParts(ms);return `<span>${String(t.hours).padStart(2,'0')} HOURS</span><i>·</i><span>${String(t.minutes).padStart(2,'0')} MIN</span><i>·</i><span>${String(t.seconds).padStart(2,'0')} SEC</span>`}
function metricIcon(type){if(type==='money')return appIcon('payments');const paths={cigarette:'<path d="M3 15h14v4H3zM17 15h4v4h-4zM16 10c0-2 2-2 2-4M20 10c0-2 2-2 2-4"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',heart:'<path d="M12 20s-8-4.7-8-10c0-4.8 6.2-6.2 8-2.5C13.8 3.8 20 5.2 20 10c0 5.3-8 10-8 10Z"/><path d="M6.5 12h3l1.2-2.4 2.1 4.8 1.3-2.4h3.4"/>'};return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[type]}</svg>`}
function runnerArt(){return `<picture class="hero-artwork"><img class="runner-art runner-art-dark" src="assets/runner-smoke-v3-web.png" alt="" aria-hidden="true"><img class="runner-art runner-art-light" src="assets/runner-smoke-light.jpg
" alt="A meditating figure gently dissolving into violet particles"></picture>`}
function trackingHome(){return smokingJourney.home()}
function home(){if(journeyMode()!=='quit')return trackingHome();const m=metrics(),t=elapsedParts(m.ms);return shell(`<section class="screen home-screen today-screen">${top('RECLAIM')}${todayHero(appIcon)}<div class="today-quit-summary"><div class="home-hero-copy"><div class="eyebrow">YOUR JOURNEY</div><div class="home-days" id="smoke-free-days">${t.days}</div><div class="hero-label">DAYS SMOKE-FREE</div></div><div class="home-live-clock" id="smoke-free-clock">${homeClockMarkup(m.ms)}</div></div><div class="stat-grid home-stats"><div class="card stat"><div class="stat-icon">${metricIcon('money')}</div><div class="stat-value">${money(m.saved)}</div><div class="stat-label">Money reclaimed</div></div><div class="card stat"><div class="stat-icon">${metricIcon('cigarette')}</div><div class="stat-value">${Math.floor(m.avoided)}</div><div class="stat-label">Cigarettes avoided</div></div><div class="card stat"><div class="stat-icon">${metricIcon('clock')}</div><div class="stat-value">${formatMinutes(m.minutes)}</div><div class="stat-label">Time reclaimed</div></div><div class="card stat"><div class="stat-icon">${metricIcon('heart')}</div><div class="stat-value">${state.cravings.filter(c=>c.resisted).length}</div><div class="stat-label">Cravings ridden out</div></div></div>${todayNextStep(appIcon)}</section>`)}
function formatMinutes(v){if(v<60)return `${Math.floor(v)}m`;const h=Math.floor(v/60);return h<48?`${h}h`:`${Math.floor(h/24)}d`}
const milestones=[{h:.333,time:'20 min',title:'Heart rate begins to drop',text:'Your heart rate starts moving down after your last cigarette.',source:'CDC'},{h:24,time:'24 hr',title:'Blood nicotine reaches zero',text:'The nicotine level in your blood drops to zero.',source:'CDC'},{h:72,time:'Several days',title:'Carbon monoxide falls',text:'Blood carbon monoxide drops to the level of someone who does not smoke.',source:'CDC'},{h:336,time:'2–12 weeks',title:'Circulation improves',text:'Circulation improves and lung function may increase.',source:'ACS'},{h:720,time:'1–12 months',title:'Breathing symptoms decrease',text:'Coughing and shortness of breath decrease; lung cilia begin regaining normal function.',source:'ACS'},{h:8760,time:'1–2 years',title:'Heart-attack risk drops sharply',text:'Compared with continuing to smoke, the risk of heart attack drops sharply.',source:'CDC'}];
function nextMilestone(ms){return milestones.find(x=>ms<x.h*36e5)||milestones.at(-1)}
function healthSvg(type){const paths={heart:`<path d="M12 21s-7-4.35-9.3-8.25C.6 9.2 2.3 5 6.5 5c2.15 0 3.6 1.25 4.5 2.55C11.9 6.25 13.35 5 15.5 5c4.2 0 5.9 4.2 3.8 7.75C17 16.65 12 21 12 21Z"/><path d="M5 12h3l1.1-2.4 2 5.2 1.6-3.2H17"/>`,lungs:`<path d="M11 4v8c-1.4-1.6-2.7-4.9-4-4.2-2.1 1.1-3.8 5.7-3.6 9.1.1 2 1.3 3.1 3.2 3.1 2.2 0 3.8-1.7 4.4-4.2M13 4v8c1.4-1.6 2.7-4.9 4-4.2 2.1 1.1 3.8 5.7 3.6 9.1-.1 2-1.3 3.1-3.2 3.1-2.2 0-3.8-1.7-4.4-4.2"/><path d="M8 9c-.2 3.1-1.2 5.4-3.3 7.3M16 9c.2 3.1 1.2 5.4 3.3 7.3"/>`,drop:`<path d="M12 2S5.2 10.1 5.2 15.1a6.8 6.8 0 0 0 13.6 0C18.8 10.1 12 2 12 2Z"/><path d="M8.6 15.3c.2 1.7 1.2 2.7 2.8 3"/>`,shield:`<path d="M12 2.5 20 6v5.6c0 5-3.2 8.2-8 10-4.8-1.8-8-5-8-10V6l8-3.5Z"/><path d="M12 17s-4-2.5-4-5.3c0-2.6 3.1-3.6 4-1.7.9-1.9 4-1 4 1.7 0 2.8-4 5.3-4 5.3Z"/>`};return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[type]||paths.shield}</svg>`}
function healthIcon(x,i){const s=(x.title+' '+x.text).toLowerCase();if(s.includes('heart')||s.includes('blood pressure'))return healthSvg('heart');if(s.includes('carbon')||s.includes('oxygen')||s.includes('lung')||s.includes('breath')||s.includes('cough')||s.includes('circulation'))return healthSvg('lungs');if(s.includes('nicotine')||s.includes('taste')||s.includes('smell'))return healthSvg('drop');return healthSvg(i>3?'shield':['heart','lungs','drop','lungs'][i%4])}
function healthProgress(ms,items){const hours=ms/36e5,nextIndex=items.findIndex(x=>hours<x.h);if(nextIndex<0)return {percent:100,label:'All listed milestones reached'};const previous=nextIndex?items[nextIndex-1].h:0,next=items[nextIndex].h;return {percent:Math.max(0,Math.min(100,(hours-previous)/(next-previous)*100)),label:`Progress toward ${items[nextIndex].time}`}}
function health(){const ms=metrics().ms,items=state.remoteMilestones?.length?state.remoteMilestones.map(x=>({h:x.minutes_after_quitting/60,time:x.title,title:x.title,text:x.description})):milestones,p=healthProgress(ms,items);return shell(`<section class="screen health-screen">${top('HEALTH RECOVERY')}<div class="health-aura"></div>${sectionHeading('Room for<br>recovery.','ritual-path')}<p class="muted">An evidence-informed timeline based on time since your quit date.</p><div class="card live-recovery"><div class="recovery-pulse">♥</div><div><div class="eyebrow">Live recovery journey</div><strong>${p.label}</strong></div><div class="live-progress"><span id="health-progress" style="width:${p.percent}%"></span></div><small id="health-progress-label">${p.percent.toFixed(1)}% of this interval</small></div><div class="timeline visual-timeline">${items.map((x,i)=>`<article class="milestone ${ms>=x.h*36e5?'done':''}"><div class="dot health-icon">${healthIcon(x,i)}</div><div><h3>${x.time}${x.title===x.time?'':` · ${x.title}`}</h3><p>${x.text}</p><small class="milestone-state">${ms>=x.h*36e5?'MILESTONE REACHED':'AHEAD'}</small></div></article>`).join('')}</div><div class="source">Recovery varies by person. These are estimates, not medical measurements or advice. Sources are checked against <a href="https://www.cdc.gov/tobacco/about/benefits-of-quitting.html" target="_blank">CDC guidance</a>.</div></section>`)}
const achievementDefs=[{days:1,icon:'flare',title:'First Light',copy:'Your first smoke-free day.'},{days:3,icon:'schedule',title:'72 Hours',copy:'Three determined days.'},{days:7,icon:'workspace_premium',title:'First Week',copy:'Seven days of choosing yourself.'},{days:14,icon:'military_tech',title:'Two Weeks',copy:'Momentum is becoming identity.'},{days:30,icon:'star',title:'One Month',copy:'A full month reclaimed.'},{days:90,icon:'trophy',title:'Quarter Strong',copy:'Ninety days of forward motion.'}];
const toolNames={breathe:'Box breathing',timer:'Ride the wave',water:'Water reset',walk:'Short walk'};
function ordinal(n){const mod100=n%100;return `${n}${mod100>=11&&mod100<=13?'th':({1:'st',2:'nd',3:'rd'}[n%10]||'th')}`}
function momentum(){const m=metrics(),d=Math.floor(m.days),tab=state.momentumTab||'streaks',attempt=Math.max(1,+state.profile.attemptNumber||1),setbacks=Math.max(0,attempt-1),bestMs=Math.max(m.ms,(+state.profile.bestStreakSeconds||0)*1000),bestDays=bestMs/864e5,bestProgress=bestMs?Math.min(100,m.ms/bestMs*100):100,next=achievementDefs.find(a=>d<a.days)||achievementDefs.at(-1),weekAgo=Date.now()-7*864e5,checkins=state.checkins.filter(x=>new Date(x.at).getTime()>=weekAgo).length,cravingWins=state.cravings.filter(x=>x.resisted&&new Date(x.at).getTime()>=weekAgo).length;return shell(`<section class="screen momentum-screen">${top('MOMENTUM')}<div class="neon-haze"></div><div class="tabs"><button data-momentum-tab="streaks" class="${tab==='streaks'?'active':''}">Resilience</button><button data-momentum-tab="achievements" class="${tab==='achievements'?'active':''}">Achievements</button></div>${tab==='streaks'?`<div class="momentum-intro"><div class="eyebrow">Your comeback record</div>${sectionHeading('Keep<br>returning.','ritual-path')}<p>Momentum is not perfection. It is how quickly you choose yourself again.</p></div><article class="attempt-hero attempt-story"><span class="attempt-story-icon">${appIcon(setbacks?'restart_alt':'flag')}</span><div class="attempt-copy"><span>${setbacks?'YOUR COMEBACK STORY':'YOUR FIRST COMMITMENT'}</span><strong>${setbacks?`${setbacks} setback${setbacks===1?'':'s'} survived. You returned every time.`:'You chose to reclaim your health.'}</strong><p>${elapsedParts(m.ms).days}d ${elapsedParts(m.ms).hours}h into your current run</p></div></article><div class="record-grid"><article class="record-card"><span class="record-icon">${appIcon('emoji_events')}</span><div><small>PERSONAL BEST</small><strong>${bestDays<1?`${Math.max(1,Math.floor(bestMs/36e5))}h`:`${Math.floor(bestDays)} days`}</strong></div></article><article class="record-card"><span class="record-icon">${appIcon('favorite')}</span><div><small>COMEBACKS</small><strong>${setbacks}</strong></div></article></div><article class="record-chase card"><header><div><small>CHASING YOUR BEST</small><strong>${bestProgress>=100?'You are setting your record now.':`${bestProgress.toFixed(0)}% of your personal best`}</strong></div><span>${Math.floor(m.days)} / ${Math.max(1,Math.floor(bestDays))} days</span></header><div class="progress"><span style="width:${bestProgress}%"></span></div></article><div class="resilience-grid"><article><strong>${checkins}</strong><span>check-ins this week</span></article><article><strong>${cravingWins}</strong><span>cravings ridden out</span></article></div><article class="card neon-card next-checkpoint"><span class="record-icon">${appIcon('flag')}</span><div><div class="eyebrow">Next checkpoint</div><strong>${d>=achievementDefs.at(-1).days?'Keep building your personal record':`${next.title} · ${Math.max(0,next.days-d)} days to go`}</strong></div></article><button class="secondary setback-button" data-log-setback>${appIcon('restart_alt')} LOG A SETBACK</button><p class="setback-note">No shame, no erased progress. Logging a setback starts a new attempt and protects your personal best.</p>`:`<div class="achievement-summary"><div><div class="eyebrow">Achievement vault</div><h1>${achievementDefs.filter(a=>d>=a.days).length}<small> / ${achievementDefs.length}</small></h1></div><p>Every badge stays unlocked—even if a new attempt begins.</p></div><div class="achievement-grid">${achievementDefs.map(a=>`<article class="achievement-card ${d>=a.days?'unlocked':'locked'}"><div class="achievement-icon">${appIcon(a.icon)}</div><div><div class="eyebrow">${d>=a.days?'Unlocked':`${a.days} days`}</div><strong>${a.title}</strong><p>${a.copy}</p></div></article>`).join('')}</div><div class="card neon-card"><strong>${achievementDefs.filter(a=>d>=a.days).length} of ${achievementDefs.length} unlocked</strong><div class="progress"><span style="width:${achievementDefs.filter(a=>d>=a.days).length/achievementDefs.length*100}%"></span></div></div>`}</section>`)}
function trendSeries(period){const p=state.profile,quit=new Date(p.quitAt).getTime(),now=Date.now(),priceEach=p.pricePerPack/p.cigarettesPerPack;let points;if(period==='month')points=Array.from({length:7},(_,i)=>now-(6-i)*5*864e5);else if(period==='all'){const span=Math.max(now-quit,864e5);points=Array.from({length:7},(_,i)=>quit+span*i/6)}else points=Array.from({length:7},(_,i)=>now-(6-i)*864e5);return points.map((at,i)=>{const days=Math.max(0,(at-quit)/864e5),avoided=days*p.cigarettesPerDay;let label;if(period==='week')label=new Intl.DateTimeFormat(undefined,{weekday:'short'}).format(new Date(at)).slice(0,1);else label=new Intl.DateTimeFormat(undefined,{day:'numeric',month:'short'}).format(new Date(at));return {label,avoided,saved:avoided*priceEach}})}
function insightBars(series,key,formatter){const max=Math.max(...series.map(x=>x[key]),1);return `<div class="meaningful-chart">${series.map(x=>{const value=x[key],height=value<=0?2:Math.max(8,value/max*100);return `<div class="chart-point" title="${formatter(value)}"><span class="chart-value">${formatter(value)}</span><i style="height:${height}%"></i><small>${x.label}</small></div>`}).join('')}</div>`}
function trackingInsights(){return smokingJourney.patterns()}
function insights(){if(journeyMode()!=='quit')return trackingInsights();const m=metrics(),period=state.insightPeriod||'week',series=trendSeries(period),description=period==='week'?'the last seven days':period==='month'?'the last 30 days':'your complete quit journey';return shell(`<section class="screen insights-screen">${top('INSIGHTS')}${sectionHeading('See your<br>small shifts.')}<div class="tabs"><button data-insight-period="week" class="${period==='week'?'active':''}">Week</button><button data-insight-period="month" class="${period==='month'?'active':''}">Month</button><button data-insight-period="all" class="${period==='all'?'active':''}">All time</button></div><div class="period-caption">Showing ${description}</div><div class="stack"><div class="card"><div class="eyebrow">Estimated money reclaimed</div><div class="goal-value">${money(m.saved)}</div><p class="muted small">Cumulative savings across ${description}.</p>${insightBars(series,'saved',v=>money(v))}</div><div class="card"><div class="eyebrow">Estimated cigarettes avoided</div><div class="goal-value">${Math.floor(m.avoided)}</div><p class="muted small">Cumulative cigarettes not smoked, based on your ${state.profile.cigarettesPerDay}/day baseline.</p>${insightBars(series,'avoided',v=>Math.floor(v).toLocaleString())}</div><div class="card"><div class="eyebrow">Time reclaimed</div><div class="goal-value">${formatMinutes(m.minutes)}</div><p class="muted small">Estimated at ${state.profile.minutesPerCigarette} minutes per cigarette, including the smoking break.</p></div><div class="card"><strong>Discipline today,<br>freedom tomorrow.</strong><p class="purple small">— You’ve got this.</p></div></div></section>`)}
function cravingRecommendation(){const rated=state.cravings.filter(item=>item.tool&&item.feedback);if(rated.length<3)return null;const scores={yes:2,a_little:1,not_really:0},byTool=new Map();for(const item of rated){const result=byTool.get(item.tool)||{tool:item.tool,count:0,score:0};result.count++;result.score+=scores[item.feedback]??0;byTool.set(item.tool,result)}return [...byTool.values()].filter(item=>item.count>=2&&item.score>0).sort((a,b)=>b.score/b.count-a.score/a.count||b.count-a.count)[0]||null}
function craving(){const recommended=cravingRecommendation(),tools=[{key:'breathe',icon:'◯',name:'Box breathing',time:'4 min',copy:'Follow a paced inhale, hold, exhale and hold cycle.'},{key:'timer',icon:'⌁',name:'Ride the wave',time:'5 min',copy:'Start a quiet countdown and watch the urge change.'},{key:'water',icon:'♢',name:'Water reset',time:'1 min',copy:'Drink a glass of water slowly and change rooms.'},{key:'walk',icon:'↗',name:'Take a short walk',time:'5 min',copy:'Move your body and break the cue-response loop.'}].sort((a,b)=>(b.key===recommended?.tool)-(a.key===recommended?.tool));return shell(`<section class="screen full craving-support">${top('CRAVING SUPPORT',true)}${sectionHeading('One urge.<br>One small step.')}<p class="muted">Cravings pass. Choose one small action to ride this one out.</p><div class="stack" style="margin-top:18px">${tools.map(tool=>`<button type="button" class="card tool-card ${tool.key===recommended?.tool?'recommended':''}" data-tool="${tool.key}">${toolArtwork(tool.key)}${tool.key===recommended?.tool?'<div class="tool-recommendation">WORKED FOR YOU BEFORE</div>':''}<header><strong>${tool.icon} ${tool.name}</strong><span>${tool.time} →</span></header><p>${tool.copy}</p></button>`).join('')}</div><button class="secondary craving-log-button" data-craving-log="false">LOG WITHOUT EXERCISE</button></section>`,false)}
function timeAgo(value){const seconds=Math.max(1,Math.floor((Date.now()-new Date(value||Date.now()).getTime())/1000));if(seconds<60)return 'just now';if(seconds<3600)return `${Math.floor(seconds/60)}m ago`;if(seconds<86400)return `${Math.floor(seconds/3600)}h ago`;return `${Math.floor(seconds/86400)}d ago`}
function topicLabel(topic){return ({win:'Small win',craving:'Craving support',advice:'What helped',reflection:'Reflection'}[topic]||'Story')}
function circleForDays(days){return STAGE_CIRCLES.find(circle=>days>=circle.min&&days<=circle.max)||STAGE_CIRCLES.at(-1)}
function isModerator(){return ['moderator','admin'].includes(session?.user?.app_metadata?.community_role)}
function activeCircle(){const matched=circleForDays(Math.floor(metrics().days)),selected=STAGE_CIRCLES.find(circle=>circle.key===state.communityStage);return state.communityStageTouched&&selected?selected:matched}
function weekKey(date=new Date()){const d=new Date(date.getFullYear(),date.getMonth(),date.getDate()),day=(d.getDay()+6)%7;d.setDate(d.getDate()-day);return localDateKey(d)}
function currentChallenge(){const remote=state.communityChallenges?.find(item=>item.weekStart===weekKey());if(remote)return remote;return {id:`local-${weekKey()}`,weekStart:weekKey(),title:'THE THREE-MINUTE RESET',description:'When a craving arrives, pause for three minutes before deciding what comes next. Share the pause, not private details.',badgeName:'Pause With Power',targetCount:1,completionCount:(state.challengeCompletions||[]).filter(x=>x.weekStart===weekKey()).length,completed:(state.challengeCompletions||[]).some(x=>x.weekStart===weekKey()&&x.userId===(session?.user?.id||'local'))}}
function postCard(p,{library=false}={}){const own=p.userId&&p.userId===session?.user?.id,saved=(state.savedPostIds||[]).includes(String(p.id)),replyCount=+p.replyCount||0;return `<article class="feed-post ${p.featured?'featured':''} ${own?'own':''}">${String(p.userId||'').startsWith('seed-')?'<div class="featured-label">EXAMPLE STORY · NOT A REAL MEMBER</div>':p.featured?'<div class="featured-label">FEATURED STORY</div>':''}<header><div class="avatar">${esc(p.initial||p.name?.[0]||'R')}</div><div class="post-author"><strong>${esc(p.name||'Community member')}</strong><div class="post-meta">${Math.max(0,+p.days||0)} days smoke-free · ${timeAgo(p.createdAt)}</div></div>${own?'<span class="own-badge">YOU</span>':''}<button class="post-more" data-post-actions="${esc(p.id)}" aria-label="Post actions">${appIcon('more_vert')}</button></header><span class="topic-pill">${topicLabel(p.topic)}</span><p>${esc(p.text)}</p><footer><button class="cheer-button ${p.cheered?'cheered':''}" data-cheer="${esc(p.id)}" aria-pressed="${!!p.cheered}">${appIcon('celebration')} <span>${p.cheered?'CHEERED':'CHEER'} · ${+p.cheers||0}</span></button><button class="reply-preview" data-open-thread="${esc(p.id)}">${appIcon('chat_bubble')} <span>${replyCount} ${replyCount===1?'REPLY':'REPLIES'}</span></button><button class="save-post ${saved?'saved':''}" data-save-post="${esc(p.id)}" aria-pressed="${saved}" aria-label="${saved?'Remove from':'Save to'} What helped me">${appIcon(saved?'bookmark':'bookmark_add')}</button></footer>${library?'<div class="library-note">SAVED TO WHAT HELPED ME</div>':''}</article>`}
function challengeCard(){const challenge=currentChallenge(),done=!!challenge.completed,count=+challenge.completionCount||0;return `<article class="community-challenge ${done?'completed':''}"><header><div class="challenge-icon">${appIcon(done?'workspace_premium':'flag')}</div><div><div class="eyebrow">This week · shared challenge</div><h2>${esc(challenge.title)}</h2></div></header><p>${esc(challenge.description)}</p><div class="challenge-progress"><span>${appIcon('groups')} <strong>${count.toLocaleString()}</strong> completed together</span><span>${esc(challenge.badgeName)} badge</span></div><button class="${done?'secondary':'primary'}" data-complete-challenge ${done?'disabled':''}>${done?`${appIcon('verified')} BADGE EARNED`:'MARK CHALLENGE COMPLETE'}</button></article>`}
function circles(){const all=(state.posts||[]).filter(p=>!(state.blockedUsers||[]).some(b=>String(b.userId)===String(p.userId))&&!(state.reportedTargets||[]).includes(`post:${p.id}`)),filter=state.communityFilter||'all',view=state.communityView||'feed',circle=activeCircle(),matched=circleForDays(Math.floor(metrics().days)),stagePosts=all.filter(p=>String(p.circleId||circleForDays(+p.days||0).id)===circle.id),feedPosts=filter==='all'?stagePosts:stagePosts.filter(p=>p.topic===filter),saved=new Set((state.savedPostIds||[]).map(String)),libraryPosts=all.filter(p=>saved.has(String(p.id))),posts=view==='library'?libraryPosts:feedPosts,totalCheers=stagePosts.reduce((sum,p)=>sum+(+p.cheers||0),0),currentDays=Math.floor(metrics().days);return shell(`<section class="screen circles-screen">${top('RECLAIM CIRCLES')}<div class="circles-aura"></div><div class="circles-intro"><div><div class="eyebrow">Stage-matched support</div>${sectionHeading('Better,<br>together.','ritual-path')}</div><button class="circle-mark" data-community-safety aria-label="Community safety">${appIcon('shield_person')}</button></div><p class="circles-copy">Real stories from people rebuilding the same habit. Replies are public; reports, blocks and saved posts stay private.</p><div class="community-view-tabs"><button data-community-view="feed" class="${view==='feed'?'active':''}">${appIcon('groups')} MY CIRCLE</button><button data-community-view="library" class="${view==='library'?'active':''}">${appIcon('bookmarks')} WHAT HELPED ME <b>${saved.size}</b></button></div>${view==='feed'?`<div class="stage-selector" role="tablist" aria-label="Quit stage circles">${STAGE_CIRCLES.map(item=>`<button role="tab" data-community-stage="${item.key}" aria-selected="${circle.key===item.key}" class="${circle.key===item.key?'active':''}"><span>${item.label}</span>${matched.key===item.key?'<small>YOUR STAGE</small>':''}</button>`).join('')}</div><p class="stage-context">${appIcon('auto_awesome')} Stories are sorted by the smoke-free stage when they were shared.</p><div class="community-stats"><span><strong>${stagePosts.length}</strong><small>STORIES</small></span><span><strong>${totalCheers}</strong><small>CHEERS</small></span><span><strong>${currentDays}</strong><small>YOUR DAY</small></span></div><button class="primary share-story" data-share-story>${appIcon('edit_square')} SHARE YOUR STORY</button><div class="community-actions"><button data-view="craving">${appIcon('health_and_safety')}<span><strong>Need support now?</strong><small>Open the craving toolkit</small></span><b>›</b></button></div><div class="community-filter" role="tablist" aria-label="Filter community stories">${[['all','All'],['win','Wins'],['craving','Support'],['advice','Advice']].map(([key,label])=>`<button role="tab" data-community-filter="${key}" aria-selected="${filter===key}" class="${filter===key?'active':''}">${label}</button>`).join('')}</div>`:`<article class="library-hero"><span>${appIcon('auto_stories')}</span><div><div class="eyebrow">Your private support library</div><h2>WHAT HELPED ME</h2><p>Save advice, reminders and stories you want nearby during a difficult moment.</p></div></article>`}<div class="community-feed">${posts.length?posts.map(p=>postCard(p,{library:view==='library'})).join(''):`<article class="community-empty"><div>${appIcon(view==='library'?'bookmark_add':'forum')}</div><h2>${view==='library'?'YOUR LIBRARY IS READY':'NO STORIES HERE YET'}</h2><p>${view==='library'?'Tap the bookmark on any useful post and it will appear here.':'Be the first person to share something useful in this circle.'}</p>${view==='feed'?'<button class="secondary" data-share-story>SHARE YOUR STORY</button>':''}</article>`}</div></section>`)}
function goalIcon(name){const s=name.toLowerCase();if(s.includes('camera'))return '▣';if(s.includes('vacation')||s.includes('trip')||s.includes('travel'))return '♨';if(s.includes('bike'))return '◇';return '✦'}
function localDateKey(date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`}
function dateFromKey(key){const [year,month,day]=String(key).split('-').map(Number);return new Date(year,month-1,day)}
function savingsDayStats(date){const p=state.profile,start=new Date(date.getFullYear(),date.getMonth(),date.getDate()),end=new Date(date.getFullYear(),date.getMonth(),date.getDate()+1),quit=new Date(p.quitAt),now=new Date(),isFuture=start>now,actualEnd=new Date(Math.min(end.getTime(),now.getTime())),actualMs=Math.max(0,actualEnd-Math.max(start.getTime(),quit.getTime())),projectedMs=Math.max(0,end-Math.max(start.getTime(),quit.getTime())),dayMs=end-start,fraction=(isFuture?projectedMs:actualMs)/dayMs,dailyCigarettes=+p.cigarettesPerDay||0,dailyMoney=dailyCigarettes*((+p.pricePerPack||0)/(+p.cigarettesPerPack||1));return {isFuture,isBefore:end<=quit,fraction,saved:fraction*dailyMoney,avoided:fraction*dailyCigarettes}}
function savingsCalendar(){const now=new Date(),currentMonth=localDateKey(new Date(now.getFullYear(),now.getMonth(),1)).slice(0,7),cursor=/^\d{4}-\d{2}$/.test(state.calendarMonth||'')?state.calendarMonth:currentMonth,[year,monthNumber]=cursor.split('-').map(Number),month=monthNumber-1,days=new Date(year,month+1,0).getDate(),start=(new Date(year,month,1).getDay()+6)%7,cells=[],monthStats={saved:0,avoided:0,funded:0};let selectedKey=state.selectedSavingsDay;if(!selectedKey||!selectedKey.startsWith(`${cursor}-`)){selectedKey=cursor===currentMonth?localDateKey(now):`${cursor}-01`}for(let i=0;i<start;i++)cells.push('<span class="calendar-blank" aria-hidden="true"></span>');for(let day=1;day<=days;day++){const date=new Date(year,month,day),key=localDateKey(date),stats=savingsDayStats(date),isToday=key===localDateKey(now),isSelected=key===selectedKey;if(!stats.isFuture){monthStats.saved+=stats.saved;monthStats.avoided+=stats.avoided;if(stats.fraction>0)monthStats.funded++}const classes=[stats.fraction>0&&!stats.isFuture?'funded':'',stats.isFuture?'future':'',stats.isBefore?'before':'',isToday?'today':'',isSelected?'selected':''].filter(Boolean).join(' ');cells.push(`<button class="${classes}" data-calendar-day="${key}" aria-label="View savings for ${new Intl.DateTimeFormat(undefined,{dateStyle:'long'}).format(date)}" aria-pressed="${isSelected}"><span>${day}</span>${stats.fraction>0?'<i></i>':''}</button>`)}const selectedDate=dateFromKey(selectedKey),selected=savingsDayStats(selectedDate),selectedLabel=new Intl.DateTimeFormat(undefined,{weekday:'long',month:'long',day:'numeric'}).format(selectedDate),detail=selected.isBefore?`<p>Your quit journey had not started yet on this date.</p>`:`<div class="calendar-detail-stats"><span><small>${selected.isFuture?'PROJECTED SAVINGS':'MONEY RECLAIMED'}</small><strong>${money(selected.saved)}</strong></span><span><small>${selected.isFuture?'PROJECTED AVOIDED':'CIGARETTES AVOIDED'}</small><strong>${selected.avoided<10?selected.avoided.toFixed(1):Math.floor(selected.avoided).toLocaleString()}</strong></span></div><p>${selected.isFuture?'A full smoke-free day based on your current quit-plan baseline.':'Calculated from the smoke-free portion of this day.'}</p>`;return `<section class="calendar" aria-label="Savings calendar"><header class="calendar-heading"><div><div class="eyebrow">Savings explorer</div><strong>${new Intl.DateTimeFormat(undefined,{month:'long',year:'numeric'}).format(new Date(year,month,1))}</strong></div><div class="calendar-controls"><button data-calendar-shift="-1" aria-label="Previous month">‹</button><button data-calendar-shift="1" aria-label="Next month">›</button></div></header><div class="calendar-summary"><span><small>RECLAIMED THIS MONTH</small><strong>${money(monthStats.saved)}</strong></span><span><small>CIGARETTES AVOIDED</small><strong>${Math.floor(monthStats.avoided).toLocaleString()}</strong></span><span><small>FUNDED DAYS</small><strong>${monthStats.funded}</strong></span></div><div class="weekdays">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(x=>`<small>${x}</small>`).join('')}</div><div class="calendar-grid">${cells.join('')}</div>${cursor!==currentMonth?'<button class="calendar-today-link" data-calendar-today>JUMP TO THIS MONTH</button>':''}<article class="calendar-detail"><header><span class="calendar-detail-icon">${selected.isFuture?'↗':selected.isBefore?'○':'✓'}</span><div><small>${selected.isFuture?'FUTURE PROJECTION':selected.isBefore?'BEFORE YOUR QUIT DATE':'DAILY CONTRIBUTION'}</small><strong>${selectedLabel}</strong></div></header>${detail}</article><div class="calendar-legend"><span><i class="funded"></i>Funded</span><span><i class="future"></i>Projected</span><span><i class="selected"></i>Selected</span></div></section>`}
function dreamRoadmap(goal,m,daily){const target=Math.max(1,+goal.target||1),saved=Math.min(target,m.saved),pct=saved/target*100,remaining=Math.max(0,target-saved),days=daily>0?Math.ceil(remaining/daily):0,nextMarks=[25,50,75,100],next=nextMarks.find(mark=>pct<mark)||100,amount=Math.max(0,target*next/100-saved),nextDays=daily>0?Math.ceil(amount/daily):0,arrival=new Date(Date.now()+days*864e5);return `<article class="card dream-roadmap"><header><span>${appIcon('route')}</span><div><div class="eyebrow">Your funding path</div><h2>${remaining?`${money(remaining)} TO GO`:'DREAM FUNDED'}</h2></div></header><div class="roadmap-track"><span style="width:${Math.min(100,pct)}%"></span>${nextMarks.map(mark=>`<i class="${pct>=mark?'reached':''}" style="left:${mark}%"><b>${mark}%</b></i>`).join('')}</div><div class="roadmap-next"><small>NEXT MEANINGFUL STEP</small><strong>${remaining?`${next}% funded in about ${nextDays} smoke-free day${nextDays===1?'':'s'}`:'You turned skipped cigarettes into something real.'}</strong></div>${remaining?`<div class="roadmap-arrival"><span>${appIcon('event_available')}</span><div><small>ESTIMATED FULLY FUNDED</small><strong>${new Intl.DateTimeFormat(undefined,{month:'long',year:'numeric'}).format(arrival)}</strong></div></div>`:''}</article>`}
function dreams(){const m=metrics(),daily=state.profile.cigarettesPerDay*(state.profile.pricePerPack/state.profile.cigarettesPerPack),lastMood=state.checkins.at(-1)?.mood,goals=state.goals||[];return shell(`<section class="screen dream-screen">${top('SAVINGS GOAL TRACKER')}${sectionHeading('Make room<br>for more.','ritual-path')}<p class="dream-status">${lastMood==='craving'?'I’m feeling a craving — remember what you’re reclaiming.':'Every smoke-free day funds something real.'}</p><div class="stack">${goals.length?goals.map((g,index)=>{const pct=Math.min(100,m.saved/g.target*100),remaining=Math.max(0,g.target-m.saved),days=daily>0?Math.ceil(remaining/daily):0;return `<article class="card goal-card"><header><div class="goal-icon">${goalIcon(g.name)}</div><div><h2>${esc(g.name)}</h2><span>${money(m.saved)} saved automatically</span></div><button class="goal-delete" data-delete-goal="${esc(g.id)}" aria-label="Delete ${esc(g.name)} goal">DELETE</button></header><div class="progress goal-progress"><span style="width:${pct}%"></span></div><div class="goal-meta"><span><small>PROGRESS</small><strong>${pct.toFixed(0)}%</strong></span><span><small>TARGET</small><strong>${money(g.target)}</strong></span></div><div class="goal-eta">${remaining?`About ${days.toLocaleString()} smoke-free days to go at your current baseline.`:'Goal fully funded — you made this happen.'}</div></article>${index===0?dreamRoadmap(g,m,daily):''}`}).join(''):`<article class="card empty-goals"><div class="goal-icon dream-goal-icon">${appIcon('my_location')}</div><h2>CHOOSE YOUR NEXT DREAM</h2><p>Your smoke-free savings will fund it automatically.</p></article>`}<button class="secondary" data-add-goal>+ ADD A SAVINGS GOAL</button></div></section>`)}
function more(){const tracking=journeyMode()!=='quit';return shell(`<section class="screen more-screen">${top('MORE')}${sectionHeading('Your<br>Reclaim.')}<div class="stack"><div class="card appearance-card"><div class="appearance-copy"><span class="appearance-icon">${appIcon(theme==='light'?'light_mode':'dark_mode')}</span><span><strong>Appearance</strong><small>Choose the look that feels comfortable.</small></span></div><div class="theme-toggle" role="group" aria-label="Choose appearance"><button type="button" data-theme-choice="light" aria-pressed="${theme==='light'}" class="${theme==='light'?'active':''}">${appIcon('light_mode')}<span>Light</span></button><button type="button" data-theme-choice="dark" aria-pressed="${theme==='dark'}" class="${theme==='dark'?'active':''}">${appIcon('dark_mode')}<span>Dark</span></button></div></div><div class="card"><div class="eyebrow">Cloud account</div><strong>${session?'Signed in':'Not signed in'}</strong>${session?'':`<p class="muted small">Sign in to sync this device’s progress securely.</p><div class="account-actions"><button class="primary" data-open-auth="login">LOG IN</button><button class="secondary" data-open-auth="signup">CREATE ACCOUNT</button></div>`}</div><div class="card"><div class="eyebrow">Privacy</div><strong>Anonymous usage stats</strong><p class="muted small">Helps improve Reclaim. Never includes your notes or personal details. Also off if your browser sends Do Not Track.</p><button type="button" class="secondary" data-analytics-toggle>${localStorage.getItem('reclaim-analytics-optout-v1')==='1'?'TURN ON':'TURN OFF'}</button></div><button class="card mood journey-setting" data-change-path><span class="mood-icon">${appIcon(tracking?'route':'flag')}</span><span><strong>My pace</strong><small>${journeyLabel()} · Change whenever you are ready</small></span></button>${tracking?'':`<button class="card mood" data-view="circles"><span class="mood-icon">◎</span><span><strong>Community Circles</strong><small>People near your stage</small></span></button>`}<button class="card mood" data-view="insights"><span class="mood-icon">⌁</span><span><strong>${tracking?'Smoking patterns':'Insights'}</strong><small>${tracking?'Review daily counts, spending and your weekly pattern':'Review savings, cigarettes avoided and time reclaimed'}</small></span></button><button class="card mood" data-edit-profile><span class="mood-icon">⚙</span><span><strong>${tracking?'Tracking plan & calculations':'Quit plan & calculations'}</strong><small>Edit your inputs and country</small></span></button>${session?'<button class="secondary" data-signout>SIGN OUT</button>':''}</div><p class="source" style="margin-top:24px">Reclaim supports behavior change but does not diagnose, treat, or replace professional medical care. If you feel unwell or need quitting support, contact a qualified clinician or local stop-smoking service.</p></section>`)}
function render(){let out,params=new URLSearchParams(location.search),uiPreview=params.get('ui-preview');if(uiPreview==='setup')out=setup();else if(['home','momentum','dreams','circles','more'].includes(uiPreview))out=({home,momentum,dreams,circles,more})[uiPreview]();else if(params.has('journey-preview'))out=choosePath();else if(state.stage==='intro'||params.has('intro-preview'))out=intro();else if(state.stage==='auth')out=auth();else if(state.stage==='setup')out=setup();else if(state.stage==='mood')out=mood();
else if(state.stage==='path')out=choosePath();
else if(state.stage==='support')out=strugglingSupport();
else out=({home,health,momentum,insights,craving,circles,dreams,more}[state.view]||home)();$('#app').innerHTML=out;bind();startClock()}
let clockTimer;
function startClock(){clearInterval(clockTimer);const clock=$('#smoke-free-clock'),days=$('#smoke-free-days'),progress=$('#health-progress'),progressLabel=$('#health-progress-label');if(!clock&&!progress)return;const tick=()=>{const ms=metrics().ms;if(clock)clock.innerHTML=homeClockMarkup(ms);if(days)days.textContent=elapsedParts(ms).days;if(progress){const items=state.remoteMilestones?.length?state.remoteMilestones.map(x=>({h:x.minutes_after_quitting/60,time:x.title})):milestones,p=healthProgress(ms,items);progress.style.width=`${p.percent}%`;if(progressLabel)progressLabel.textContent=`${p.percent.toFixed(2)}% of this interval`}};tick();clockTimer=setInterval(tick,1000)}
async function authenticate(form){
  const d=Object.fromEntries(new FormData(form)),signup=state.authMode==='signup',email=String(d.email||'').trim().toLowerCase(),password=String(d.password||''),name=String(d.name||'').trim(),emailPattern=/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;
  if(!emailPattern.test(email)){toast('Enter a valid email address.');return}
  if(signup&&!name){toast('Enter your name.');return}
  if(password.length<6){toast('Password must be at least 6 characters.');return}
  if(signup){state.profile.name=name;state.profile.quitAt=new Date().toISOString()}
  try{const data=await api(signup?'/auth/v1/signup':'/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email,password,data:signup?{display_name:name}:undefined})});if(data.access_token){saveSession(data);await hydrate();state.stage=signup?'path':'mood';save();render()}else toast('Check your email to confirm your account.')}catch(e){toast(e.message)}
}
async function hydrateCommunity(){if(!session?.user)return false;try{const [rows,cheers]=await Promise.all([api('/rest/v1/circle_posts?select=id,circle_id,user_id,body,topic,author_name,smoke_free_days,is_featured,created_at&order=created_at.desc&limit=100',{method:'GET'}),api('/rest/v1/post_cheers?select=post_id,user_id',{method:'GET'})]),counts=new Map(),mine=new Set();for(const cheer of cheers){counts.set(cheer.post_id,(counts.get(cheer.post_id)||0)+1);if(cheer.user_id===session.user.id)mine.add(cheer.post_id)}state.posts=rows.map(row=>({id:row.id,circleId:row.circle_id||circleForDays(+row.smoke_free_days||0).id,userId:row.user_id,name:row.author_name||'Community member',initial:(row.author_name||'R').slice(0,1).toUpperCase(),days:+row.smoke_free_days||0,text:row.body,topic:row.topic||'reflection',cheers:counts.get(row.id)||0,cheered:mine.has(row.id),featured:!!row.is_featured,replyCount:0,createdAt:row.created_at}));state.communityCloudReady=true;try{const uid=session.user.id,reportQuery=isModerator()?'/rest/v1/community_reports?select=id,reporter_id,post_id,reply_id,reason,details,status,created_at&order=created_at.desc&limit=200':`/rest/v1/community_reports?reporter_id=eq.${uid}&select=id,reporter_id,post_id,reply_id,reason,details,status,created_at`,[replies,saved,blocks,reports,challenges,completions]=await Promise.all([api('/rest/v1/post_replies?select=id,post_id,user_id,body,author_name,created_at&order=created_at.asc&limit=300',{method:'GET'}),api(`/rest/v1/saved_posts?user_id=eq.${uid}&select=post_id`,{method:'GET'}),api(`/rest/v1/user_blocks?blocker_id=eq.${uid}&select=blocked_id,blocked_name`,{method:'GET'}),api(reportQuery,{method:'GET'}),api('/rest/v1/community_challenges?select=id,week_start,title,description,badge_name,target_count&order=week_start.desc&limit=8',{method:'GET'}),api('/rest/v1/challenge_completions?select=challenge_id,user_id',{method:'GET'})]),replyCounts=new Map(),completionCounts=new Map(),myCompletions=new Set();state.replies=replies.map(reply=>{replyCounts.set(reply.post_id,(replyCounts.get(reply.post_id)||0)+1);return {id:reply.id,postId:reply.post_id,userId:reply.user_id,name:reply.author_name||'Community member',text:reply.body,createdAt:reply.created_at}});state.posts.forEach(post=>post.replyCount=replyCounts.get(post.id)||0);state.savedPostIds=saved.map(item=>String(item.post_id));state.blockedUsers=blocks.map(item=>({userId:String(item.blocked_id),name:item.blocked_name||'Community member'}));state.communityReports=reports.map(item=>({id:item.id,reporterId:item.reporter_id,postId:item.post_id,replyId:item.reply_id,reason:item.reason,details:item.details,status:item.status,createdAt:item.created_at}));state.reportedTargets=reports.filter(item=>item.reporter_id===uid).flatMap(item=>[item.post_id?`post:${item.post_id}`:null,item.reply_id?`reply:${item.reply_id}`:null].filter(Boolean));for(const completion of completions){completionCounts.set(completion.challenge_id,(completionCounts.get(completion.challenge_id)||0)+1);if(completion.user_id===uid)myCompletions.add(completion.challenge_id)}state.communityChallenges=challenges.map(item=>({id:item.id,weekStart:item.week_start,title:item.title,description:item.description,badgeName:item.badge_name,targetCount:+item.target_count||1,completionCount:completionCounts.get(item.id)||0,completed:myCompletions.has(item.id)}));state.communityUpgradeReady=true}catch(error){state.communityUpgradeReady=false;if(!/post_replies|saved_posts|user_blocks|community_reports|community_challenges|challenge_completions|schema cache|PGRST/i.test(error.message))console.warn('Community upgrade hydration:',error.message)}return true}catch(error){state.communityCloudReady=false;state.communityUpgradeReady=false;if(!/circle_posts|post_cheers|schema cache|PGRST/i.test(error.message))console.warn('Community hydration:',error.message);return false}}
async function hydrate(){if(!session)return;try{const u=await api('/auth/v1/user',{method:'GET'});session.user=u;saveSession(session);const [profiles,health,goals,remoteCravings,remoteSmoking]=await Promise.all([api(`/rest/v1/profiles?id=eq.${u.id}&select=*`,{method:'GET'}),api('/rest/v1/health_milestones?select=*&order=minutes_after_quitting.asc',{method:'GET'}),api(`/rest/v1/savings_goals?user_id=eq.${u.id}&select=*`,{method:'GET'}),api(`/rest/v1/smoking_events?user_id=eq.${u.id}&event_type=eq.craving&select=id,smoked_at,created_at,resisted,toolkit,tool_feedback&order=smoked_at.asc`,{method:'GET'}),api(`/rest/v1/smoking_events?user_id=eq.${u.id}&event_type=eq.smoked&select=id,smoked_at,created_at,cigarettes&order=created_at.asc`,{method:'GET'})]);if(profiles[0]){const p=profiles[0],country=p.country||countryFromCurrency(p.currency_symbol||state.profile.currency);state.profile={...state.profile,name:p.display_name||state.profile.name,journeyMode:p.journey_mode||state.profile.journeyMode,dailyTarget:p.daily_target==null?state.profile.dailyTarget:+p.daily_target,quitAt:p.quit_date||p.quit_at||state.profile.quitAt,cigarettesPerDay:+p.cigarettes_per_day||state.profile.cigarettesPerDay,pricePerPack:p.price_per_pack==null?state.profile.pricePerPack:+p.price_per_pack,cigarettesPerPack:+p.cigarettes_per_pack||state.profile.cigarettesPerPack,minutesPerCigarette:+p.minutes_per_cigarette||state.profile.minutesPerCigarette,country,currency:p.currency_symbol||currencySymbol(country),currencyCode:countryInfo(country)[2],attemptNumber:+p.attempt_number||state.profile.attemptNumber||1,bestStreakSeconds:+p.best_streak_seconds||state.profile.bestStreakSeconds||0}}state.remoteMilestones=health;state.goals=goals.map(g=>({id:g.id,name:g.name,target:+g.target_amount}));const localCravings=state.cravings.filter(item=>!item.cloudId),localSmoking=(state.smokingEvents||[]).filter(item=>!item.cloudId);state.cravings=[...remoteCravings.map(row=>({at:row.smoked_at||row.created_at,resisted:!!row.resisted,tool:row.toolkit,feedback:row.tool_feedback,cloudId:row.id})),...localCravings].sort((a,b)=>new Date(a.at)-new Date(b.at));state.smokingEvents=[...remoteSmoking.map(row=>({at:row.smoked_at||row.created_at,cigarettes:+row.cigarettes||1,cloudId:row.id})),...localSmoking].sort((a,b)=>new Date(a.at)-new Date(b.at));await hydrateCommunity();save()}catch(e){console.warn('Cloud hydration:',e.message)}}
async function persistProfile(){if(!session?.user)return true;const country=state.profile.country||'IN',payload={id:session.user.id,display_name:String(state.profile.name||'').trim().slice(0,80)||null,journey_mode:journeyMode(),daily_target:+state.profile.dailyTarget||null,quit_date:new Date(state.profile.quitAt).toISOString(),cigarettes_per_day:state.profile.cigarettesPerDay,price_per_pack:state.profile.pricePerPack,cigarettes_per_pack:state.profile.cigarettesPerPack,minutes_per_cigarette:state.profile.minutesPerCigarette,currency_symbol:currencySymbol(country),country,attempt_number:Math.max(1,+state.profile.attemptNumber||1),best_streak_seconds:Math.max(0,Math.floor(+state.profile.bestStreakSeconds||0))};const request=body=>api('/rest/v1/profiles?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(body)});try{await request(payload);return true}catch(error){if(/display_name|journey_mode|daily_target|country|attempt_number|best_streak_seconds|schema cache|PGRST204/i.test(error.message)){const {display_name:unusedName,journey_mode:unusedMode,daily_target:unusedTarget,country:unused,attempt_number:unusedAttempt,best_streak_seconds:unusedBest,...compatible}=payload;await request(compatible);return false}throw error}}

function bind(){
  document.querySelectorAll('[data-open-auth]').forEach(el=>el.onclick=()=>{state.authMode=el.dataset.openAuth;state.stage='auth';save();render()});
  document.querySelectorAll('[data-stage]').forEach(el=>el.onclick=()=>{const url=new URL(location.href);url.searchParams.delete('intro-preview');history.replaceState({},'',url.pathname+url.search+url.hash);state.stage=el.dataset.stage;save();render()});
  document.querySelectorAll('[data-journey-mode]').forEach(el=>el.onclick=()=>{const url=new URL(location.href);url.searchParams.delete('journey-preview');history.replaceState({},'',url.pathname+url.search+url.hash);switchJourney(state,el.dataset.journeyMode);state.stage='setup';save();render()});
  document.querySelectorAll('[data-change-path]').forEach(el=>el.onclick=()=>{state.pathReturn=state.stage==='app'?'more':null;state.stage='path';save();render()});
  document.querySelectorAll('[data-view]').forEach(el=>el.onclick=()=>{state.stage='app';state.view=el.dataset.view;save();render()});
  document.querySelectorAll('[data-analytics-toggle]').forEach(el=>el.onclick=()=>{const off=localStorage.getItem('reclaim-analytics-optout-v1')==='1';if(off)localStorage.removeItem('reclaim-analytics-optout-v1');else localStorage.setItem('reclaim-analytics-optout-v1','1');render();toast(off?'Usage stats on.':'Usage stats off.')});
  document.querySelectorAll('[data-theme-choice]').forEach(el=>el.onclick=()=>{localStorage.setItem(THEME_STORAGE,el.dataset.themeChoice);applyTheme(el.dataset.themeChoice);render()});
  document.querySelectorAll('[data-auth]').forEach(el=>el.onclick=()=>{state.authMode=el.dataset.auth;render()});
  document.querySelectorAll('[data-insight-period]').forEach(el=>el.onclick=()=>{state.insightPeriod=el.dataset.insightPeriod;save();render()});
  document.querySelectorAll('[data-momentum-tab]').forEach(el=>el.onclick=()=>{state.momentumTab=el.dataset.momentumTab;save();render()});
  document.querySelectorAll('[data-community-filter]').forEach(el=>el.onclick=()=>{state.communityFilter=el.dataset.communityFilter;save();render()});
  document.querySelectorAll('[data-community-view]').forEach(el=>el.onclick=()=>{state.communityView=el.dataset.communityView;save();render()});
  document.querySelectorAll('[data-community-stage]').forEach(el=>el.onclick=()=>{state.communityStage=el.dataset.communityStage;state.communityStageTouched=true;state.communityFilter='all';save();render()});
  document.querySelectorAll('[data-share-story]').forEach(el=>el.onclick=openCommunityComposer);
  document.querySelectorAll('[data-cheer]').forEach(el=>el.onclick=()=>toggleCheer(el.dataset.cheer));
  document.querySelectorAll('[data-save-post]').forEach(el=>el.onclick=()=>toggleSavedPost(el.dataset.savePost));
  document.querySelectorAll('[data-open-thread]').forEach(el=>el.onclick=()=>openThread(el.dataset.openThread));
  document.querySelectorAll('[data-post-actions]').forEach(el=>el.onclick=()=>openPostActions(el.dataset.postActions));
  $('[data-complete-challenge]')?.addEventListener('click',completeChallenge);
  $('[data-community-safety]')?.addEventListener('click',openCommunitySafety);
  document.querySelectorAll('[data-delete-goal]').forEach(el=>el.onclick=()=>confirmDeleteGoal(el.dataset.deleteGoal));
  document.querySelectorAll('[data-calendar-shift]').forEach(el=>el.onclick=()=>{const today=new Date(),current=/^\d{4}-\d{2}$/.test(state.calendarMonth||'')?dateFromKey(`${state.calendarMonth}-01`):new Date(today.getFullYear(),today.getMonth(),1),next=new Date(current.getFullYear(),current.getMonth()+(+el.dataset.calendarShift),1);state.calendarMonth=localDateKey(next).slice(0,7);state.selectedSavingsDay=`${state.calendarMonth}-01`;save();render()});
  document.querySelectorAll('[data-calendar-day]').forEach(el=>el.onclick=()=>{state.selectedSavingsDay=el.dataset.calendarDay;state.calendarMonth=state.selectedSavingsDay.slice(0,7);save();render()});
  $('[data-calendar-today]')?.addEventListener('click',()=>{const today=new Date();state.calendarMonth=localDateKey(today).slice(0,7);state.selectedSavingsDay=localDateKey(today);save();render()});
  $('[data-log-setback]')?.addEventListener('click',openSetback);
  $('[data-menu]')?.addEventListener('click',openMenu);
  $('[data-for-you]')?.addEventListener('click',openForYou);
  $('[data-open-quit-picker]')?.addEventListener('click',openQuitDatePicker);
  $('[data-back="true"]')?.addEventListener('click',()=>{   if(state.returnToSupport){     state.returnToSupport = false;     state.stage = 'support';   } else {     state.stage = 'app';     state.view = 'home';   }   save();   render(); });
  $('#auth-form')?.addEventListener('submit',async e=>{e.preventDefault();const b=e.target.querySelector('button.primary'),label=b?.textContent;if(b){b.disabled=true;b.textContent='PLEASE WAIT…'}try{await authenticate(e.target)}finally{if(b&&b.isConnected){b.disabled=false;b.textContent=label}}});
  $('[data-google]')?.addEventListener('click',()=>{location.href=`${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(location.origin+location.pathname)}`});
  $('[name="country"]')?.addEventListener('change',e=>{const info=countryInfo(e.target.value);$('#currency-preview').textContent=`Currency: ${info[2]} (${currencySymbol(e.target.value)})`});
  $('#setup-form')?.addEventListener('submit',async e=>{e.preventDefault();const sb=e.target.querySelector('button[type="submit"],button.primary');if(sb){sb.disabled=true;sb.textContent='SAVING…'}const d=Object.fromEntries(new FormData(e.target)),country=d.country||'IN';state.profile={...state.profile,...d,country,currency:currencySymbol(country),currencyCode:countryInfo(country)[2],quitAt:d.quitAt||state.profile.quitAt,cigarettesPerDay:+d.cigarettesPerDay,dailyTarget:d.dailyTarget==null?state.profile.dailyTarget:+d.dailyTarget,pricePerPack:+d.pricePerPack,cigarettesPerPack:+d.cigarettesPerPack};ensurePlan(state);state.communityStageTouched=false;try{const synced=await persistProfile();state.stage=state.pathReturn==='more'?'app':'mood';state.view=state.pathReturn==='more'?'home':state.view;state.pathReturn=null;save();render();if(!synced)toast('Saved on this device. Some details will sync when you reconnect.')}catch(err){if(sb){sb.disabled=false;sb.textContent='SAVE & CONTINUE'}toast(err.message)}});
  document.querySelectorAll('[data-mood]').forEach(el=>el.onclick=()=>{   const mood = el.dataset.mood;    state.checkins.push({     mood,     at:new Date().toISOString()   });    if(mood === 'struggling'){     state.stage = 'support';   } else if(mood === 'craving'){     state.stage = 'app';     state.view = 'craving';   } else {     state.stage = 'app';     state.view = 'home';   }    save();   render(); });
  document.querySelectorAll('[data-support]').forEach(el=>el.onclick=()=>{
  const action = el.dataset.support;

  if(action === 'reset'){
  state.returnToSupport = true;
  state.stage = 'app';
  state.view = 'craving';
  save();
  render();
  openTool('breathe');
  return;
}

if(action === 'circle'){
  state.returnToSupport = true;
  state.stage = 'app';
  state.view = 'circles';
}

if(action === 'craving'){
  state.returnToSupport = true;
  state.stage = 'app';
  state.view = 'craving';
}

  if(action === 'dashboard'){
    state.stage = 'app';
    state.view = 'home';
  }

  save();
  render();
});
  document.querySelectorAll('[data-tool]').forEach(el=>el.onclick=()=>openTool(el.dataset.tool));
  $('[data-edit-profile]')?.addEventListener('click',()=>{state.pathReturn='more';state.stage='setup';render()});
  smokingJourney.bind();
  $('[data-add-goal]')?.addEventListener('click',openGoal);
  $('[data-craving-log]')?.addEventListener('click',()=>finishCraving(false));
  $('[data-signout]')?.addEventListener('click',async()=>{try{await api('/auth/v1/logout',{method:'POST'})}catch{}saveSession(null);localStorage.removeItem(STORAGE);state=structuredClone(seed);render()});
}
function openForYou(){const cards=forYouCards();modal(`<div class="for-you-sheet"><div class="eyebrow">Personal signals from your journey</div><h2>FOR YOU.</h2><p class="muted">Only what matters now. No filler, no repeated check-in.</p>${cards.length?`<div class="for-you-list">${cards.map(item=>`<article class="for-you-card ${item.priority.toLowerCase().replaceAll(' ','-')}"><header><span>${appIcon(item.icon)}</span><small>${item.priority}</small></header><h3>${esc(item.title)}</h3><p>${esc(item.body)}</p><button data-for-you-action="${item.action}">${item.label} ${appIcon('arrow_forward')}</button></article>`).join('')}</div>`:`<article class="for-you-empty">${appIcon('task_alt')}<h3>YOU’RE ALL CAUGHT UP</h3><p>Reclaim will surface something here when your activity creates a useful signal.</p></article>`}</div>`);document.querySelectorAll('[data-for-you-action]').forEach(button=>button.onclick=()=>handleForYouAction(button.dataset.forYouAction))}
function routeFromForYou(view){closeModal();state.stage='app';state.view=view;save();render()}
function handleForYouAction(action){
  if(action==='confirm-yesterday'){closeModal();if(journeyMode()!=='quit')smokingJourney.dayDetail(shiftDay(dayKey(),-1));else openYesterdayConfirmation();return}
  if(action==='review-target'){closeModal();if(journeyMode()==='reduce')smokingJourney.review();return}
  if(action==='read-reply'){const own=new Set((state.posts||[]).filter(post=>post.userId&&post.userId===session?.user?.id).map(post=>String(post.id)));state.readReplyIds=[...new Set([...(state.readReplyIds||[]),...(state.replies||[]).filter(reply=>own.has(String(reply.postId))).map(reply=>String(reply.id))])];state.communityView='feed';save();routeFromForYou('circles');return}
  if(action==='open-review'){state.lastWeeklyReviewAt=new Date().toISOString();save();routeFromForYou('insights');return}
  if(action==='start-reset'){routeFromForYou('craving');setTimeout(()=>openTool('breathe'),0);return}
  if(action==='try-wave'){routeFromForYou('craving');setTimeout(()=>openTool('timer'),0);return}
  if(action==='prepare-plan'){routeFromForYou('craving');setTimeout(()=>toast('Your craving plan and tools are ready.'),0);return}
  const destination={
    'view-today':'home','see-pattern':'insights','catch-up':'insights',
    'view-stories':'circles','view-dream':'dreams'
  }[action]||'home';
  routeFromForYou(destination);
}
function openYesterdayConfirmation(){const yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);const key=localDateKey(yesterday);modal(`<div class="confirm-yesterday"><div class="eyebrow">Complete yesterday</div><h2>WHAT HAPPENED?</h2><p class="muted">Choose the honest answer. Both are useful information and neither affects your worth.</p><div class="stack"><button class="secondary" data-confirm-yesterday="smoke_free">${appIcon('verified')} IT WAS SMOKE-FREE</button><button class="secondary" data-confirm-yesterday="untracked">${appIcon('edit_note')} I DIDN’T TRACK IT</button></div></div>`);document.querySelectorAll('[data-confirm-yesterday]').forEach(button=>button.onclick=()=>{state.dayConfirmations={...(state.dayConfirmations||{}),[key]:button.dataset.confirmYesterday};save();closeModal();toast(button.dataset.confirmYesterday==='smoke_free'?'Yesterday marked smoke-free.':'Yesterday marked as untracked.')})}
function openQuitDatePicker(){
  const input=$('#quit-at-value');
  if(!input)return;

  const initial=new Date();
  const currentYear=initial.getFullYear();

  const months=Array.from({length:12},(_,i)=>
    new Intl.DateTimeFormat(undefined,{month:'short'})
      .format(new Date(2020,i,1))
      .toUpperCase()
  );

  const years=Array.from(
    {length:21},
    (_,i)=>currentYear-20+i
  );

  const pad=n=>String(n).padStart(2,'0');

  let selected={
    month:initial.getMonth(),
    day:initial.getDate(),
    year:initial.getFullYear(),
    hour:initial.getHours()%12||12,
    minute:initial.getMinutes(),
    period:initial.getHours()>=12?'PM':'AM'
  };

  const wheel=(name,values,formatter=value=>value)=>`
    <div class="reclaim-wheel" data-custom-wheel="${name}">
      <div class="reclaim-wheel-spacer"></div>

      ${values.map(value=>`
        <button
          type="button"
          class="reclaim-wheel-item"
          data-wheel-value="${value}"
        >
          ${formatter(value)}
        </button>
      `).join('')}

      <div class="reclaim-wheel-spacer"></div>
    </div>
  `;

  const daysInMonth=(year,month)=>
    new Date(year,month+1,0).getDate();

  const days=Array.from(
    {length:daysInMonth(selected.year,selected.month)},
    (_,i)=>i+1
  );

  modal(`
    <div class="quit-picker custom-quit-picker">

      <div class="eyebrow">Quit date and time</div>

      <h2>
        WHEN DID YOUR<br>
        RECLAIM BEGIN?
      </h2>

      <p class="muted">
        Roll each column to set the moment your live calculations begin.
      </p>

      <div class="wheel-labels">
        <span>MONTH</span>
        <span>DAY</span>
        <span>YEAR</span>
      </div>

      <div class="reclaim-wheel-row reclaim-date-wheel-row">
        ${wheel('month',
          Array.from({length:12},(_,i)=>i),
          value=>months[value]
        )}

        ${wheel('day',days)}

        ${wheel('year',years)}
      </div>

      <div class="wheel-labels time">
        <span>HOUR</span>
        <span>MINUTE</span>
        <span>AM / PM</span>
      </div>

      <div class="reclaim-wheel-row reclaim-time-wheel-row">
        ${wheel(
          'hour',
          Array.from({length:12},(_,i)=>i+1),
          pad
        )}

        ${wheel(
          'minute',
          Array.from({length:60},(_,i)=>i),
          pad
        )}

        ${wheel('period',['AM','PM'])}
      </div>

      <button
        class="primary"
        type="button"
        data-apply-quit-date
      >
        SET THIS MOMENT
      </button>

    </div>
  `);

  const ITEM_HEIGHT=48;

  function updateVisualState(wheelEl){
    const name=wheelEl.dataset.customWheel;
    const items=[...wheelEl.querySelectorAll('.reclaim-wheel-item')];

    items.forEach(item=>{
      const raw=item.dataset.wheelValue;

      const value=
        name==='period'
          ? raw
          : Number(raw);

      item.classList.toggle(
        'is-selected',
        value===selected[name]
      );
    });
  }

  function moveWheelToValue(name,behavior='auto'){
    const wheelEl=$(`[data-custom-wheel="${name}"]`);
    if(!wheelEl)return;

    const items=[...wheelEl.querySelectorAll('.reclaim-wheel-item')];

    const index=items.findIndex(item=>{
      const raw=item.dataset.wheelValue;

      return name==='period'
        ? raw===selected[name]
        : Number(raw)===selected[name];
    });

    if(index<0)return;

    wheelEl.scrollTo({
      top:index*ITEM_HEIGHT,
      behavior
    });

    updateVisualState(wheelEl);
  }

  function readWheel(wheelEl){
    const name=wheelEl.dataset.customWheel;
    const items=[...wheelEl.querySelectorAll('.reclaim-wheel-item')];

    if(!items.length)return;

    const index=Math.max(
      0,
      Math.min(
        items.length-1,
        Math.round(wheelEl.scrollTop/ITEM_HEIGHT)
      )
    );

    const raw=items[index].dataset.wheelValue;

    selected[name]=
      name==='period'
        ? raw
        : Number(raw);

    updateVisualState(wheelEl);
  }

  document.querySelectorAll('[data-custom-wheel]').forEach(wheelEl=>{

    let timer;

    wheelEl.addEventListener('scroll',()=>{
      clearTimeout(timer);

      timer=setTimeout(()=>{
        readWheel(wheelEl);

        const name=wheelEl.dataset.customWheel;

        moveWheelToValue(name,'smooth');

      },80);
    });

    wheelEl.addEventListener('click',event=>{
      const item=event.target.closest('.reclaim-wheel-item');

      if(!item)return;

      const name=wheelEl.dataset.customWheel;
      const raw=item.dataset.wheelValue;

      selected[name]=
        name==='period'
          ? raw
          : Number(raw);

      moveWheelToValue(name,'smooth');
    });
  });

  requestAnimationFrame(()=>{
    requestAnimationFrame(()=>{
      moveWheelToValue('month');
      moveWheelToValue('day');
      moveWheelToValue('year');
      moveWheelToValue('hour');
      moveWheelToValue('minute');
      moveWheelToValue('period');
    });
  });

  $('[data-apply-quit-date]').onclick=()=>{

    let hour=selected.hour%12;

    if(selected.period==='PM'){
      hour+=12;
    }

    const date=new Date(
      selected.year,
      selected.month,
      selected.day,
      hour,
      selected.minute
    );

    input.value=toLocalDateTimeInput(date);

    $('[data-quit-date-label]').textContent=
      new Intl.DateTimeFormat(undefined,{
        dateStyle:'medium',
        timeStyle:'short'
      }).format(date);

    closeModal();
  };
}
function openMenu(){const menuItems=journeyMode()==='quit'?[['home','home','Home'],['health','favorite','Health recovery'],['momentum','bolt','Momentum'],['dreams','my_location','Dream savings'],['craving','health_and_safety','Craving support'],['circles','groups','Community circles'],['insights','monitoring','Insights'],['more','more_horiz','Settings & more']]:[['home','home','Today'],['insights','monitoring','Smoking patterns'],['craving','health_and_safety','Craving support'],['more','more_horiz','Settings & more']];document.body.insertAdjacentHTML('beforeend',`<div class="menu-overlay"><aside class="side-menu"><header><div><div class="brand">RECLAIM</div><small>${esc(state.profile.name||'Your journey')}</small></div><button class="icon-btn" data-menu-close aria-label="Close menu">×</button></header><nav>${menuItems.map(([view,icon,label])=>`<button data-menu-view="${view}" class="${state.view===view?'active':''}"><i>${appIcon(icon)}</i><span>${label}</span><b>›</b></button>`).join('')}</nav><div class="menu-footer"><span class="menu-dot"></span><small>${session?'SIGNED IN · SYNCED':'THIS DEVICE ONLY · SIGN IN TO BACK UP'}</small></div></aside></div>`);const overlay=$('.menu-overlay');requestAnimationFrame(()=>overlay.classList.add('open'));const close=()=>{overlay.classList.remove('open');setTimeout(()=>overlay.remove(),220)};overlay.addEventListener('click',e=>{if(e.target===overlay)close()});$('[data-menu-close]',overlay).onclick=close;overlay.querySelectorAll('[data-menu-view]').forEach(el=>el.onclick=()=>{state.stage='app';state.view=el.dataset.menuView;save();close();setTimeout(render,160)})}
function modal(body){document.body.insertAdjacentHTML('beforeend',`<div class="modal"><div class="modal-body"><button class="icon-btn close" data-close>×</button>${body}</div></div>`);$('[data-close]').onclick=closeModal}
function closeModal(){clearInterval(breathing);clearInterval(cravingTimer);$('.modal')?.remove()}
function openCommunityComposer(){const circle=activeCircle();modal(`<div class="community-composer"><div class="eyebrow">Shared with people at this stage</div><h2>SHARE YOUR STORY</h2><p class="muted">Reclaim will place it in the stage you are in today, so it reaches people when it is most relevant. Avoid names, phone numbers, addresses, and other private details.</p><form id="community-form" class="stack"><label>Type of story<select class="field" name="topic"><option value="win">Small win</option><option value="craving">I need support</option><option value="advice">What helped me</option><option value="reflection">Reflection</option></select></label><label>Your experience<textarea class="field community-textarea" name="body" maxlength="1000" required placeholder="What happened, and what would you want someone at the same stage to know?"></textarea><small class="composer-count"><span data-community-count>0</span>/1000</small></label><label class="anonymous-option"><input type="checkbox" name="anonymous"> Share as Anonymous</label><button class="primary">SHARE YOUR STORY</button></form></div>`);const form=$('#community-form'),textarea=form.elements.body,count=$('[data-community-count]');textarea.addEventListener('input',()=>count.textContent=textarea.value.length);form.onsubmit=e=>{e.preventDefault();shareCommunityPost(form)}}
async function shareCommunityPost(form){const data=Object.fromEntries(new FormData(form)),button=form.querySelector('button[type="submit"],button.primary'),anonymous=form.elements.anonymous.checked,name=anonymous?'Anonymous':state.profile.name||session?.user?.user_metadata?.full_name||'Community member',circle=activeCircle(),draft={id:crypto.randomUUID(),userId:session?.user?.id||null,name,initial:name.slice(0,1).toUpperCase(),days:Math.floor(metrics().days),text:String(data.body).trim(),topic:data.topic||'reflection',circleId:circle.id,cheers:0,cheered:false,replyCount:0,createdAt:new Date().toISOString()};if(!draft.text)return;button.disabled=true;button.textContent='SHARING…';let shared=false;if(session?.user&&state.communityCloudReady)try{const rows=await api('/rest/v1/circle_posts',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({circle_id:circle.id,user_id:session.user.id,body:draft.text,topic:draft.topic,author_name:draft.name,smoke_free_days:draft.days})});draft.id=rows[0]?.id||draft.id;shared=true}catch(error){console.warn('Community post:',error.message)}state.posts=[draft,...(state.posts||[])];save();closeModal();state.communityFilter='all';state.communityView='feed';render();toast(shared?'Your story is live in this stage circle.':session?.user?'Saved here. Run the latest community upgrade so others can see it.':'Saved on this device. Sign in to share it with others.')}
async function toggleCheer(id){const post=(state.posts||[]).find(p=>String(p.id)===String(id));if(!post)return;const next=!post.cheered;if(session?.user&&state.communityCloudReady)try{if(next)await api('/rest/v1/post_cheers',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({post_id:post.id,user_id:session.user.id})});else await api(`/rest/v1/post_cheers?post_id=eq.${encodeURIComponent(post.id)}&user_id=eq.${session.user.id}`,{method:'DELETE',headers:{Prefer:'return=minimal'}})}catch(error){toast(error.message);return}post.cheered=next;post.cheers=Math.max(0,(+post.cheers||0)+(next?1:-1));save();render();if(next)toast('Cheer sent. Small support matters.')}
async function toggleSavedPost(id){const key=String(id),saved=(state.savedPostIds||[]).includes(key),next=!saved;if(session?.user&&state.communityUpgradeReady)try{if(next)await api('/rest/v1/saved_posts',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({post_id:id,user_id:session.user.id})});else await api(`/rest/v1/saved_posts?post_id=eq.${encodeURIComponent(id)}&user_id=eq.${session.user.id}`,{method:'DELETE',headers:{Prefer:'return=minimal'}})}catch(error){toast(error.message);return}state.savedPostIds=next?[...(state.savedPostIds||[]),key]:(state.savedPostIds||[]).filter(item=>String(item)!==key);save();render();toast(next?'Saved to What helped me.':'Removed from your library.')}
function visibleReplies(postId){return (state.replies||[]).filter(reply=>String(reply.postId)===String(postId)&&!(state.blockedUsers||[]).some(block=>String(block.userId)===String(reply.userId))&&!(state.reportedTargets||[]).includes(`reply:${reply.id}`))}
function openThread(id){const post=(state.posts||[]).find(item=>String(item.id)===String(id));if(!post)return;const replies=visibleReplies(post.id);modal(`<div class="thread-modal"><div class="eyebrow">Public conversation</div><h2>${topicLabel(post.topic).toUpperCase()}</h2><article class="thread-original"><strong>${esc(post.name)}</strong><p>${esc(post.text)}</p></article><div class="reply-list">${replies.length?replies.map(reply=>`<article><div class="reply-head"><div class="avatar">${esc((reply.name||'R').slice(0,1).toUpperCase())}</div><div><strong>${esc(reply.name||'Community member')}</strong><small>${timeAgo(reply.createdAt)}</small></div><button data-reply-actions="${esc(reply.id)}" aria-label="Reply actions">${appIcon('more_vert')}</button></div><p>${esc(reply.text)}</p></article>`).join(''):'<div class="reply-empty">No replies yet. Be the first person to respond with care.</div>'}</div><form id="reply-form" class="stack"><label>Reply with support<textarea class="field" name="body" maxlength="500" required placeholder="Add something kind, useful or encouraging."></textarea></label><label class="anonymous-option"><input type="checkbox" name="anonymous"> Reply as Anonymous</label><button class="primary">POST REPLY</button></form><p class="community-guideline">Be supportive. Do not give medical diagnoses, request private contact details, or shame setbacks.</p></div>`);document.querySelectorAll('[data-reply-actions]').forEach(button=>button.onclick=()=>openReplyActions(button.dataset.replyActions));$('#reply-form').onsubmit=event=>{event.preventDefault();submitReply(event.target,post)}}
async function submitReply(form,post){const data=Object.fromEntries(new FormData(form)),text=String(data.body||'').trim(),button=form.querySelector('.primary'),anonymous=form.elements.anonymous.checked,name=anonymous?'Anonymous':state.profile.name||'Community member',reply={id:crypto.randomUUID(),postId:post.id,userId:session?.user?.id||null,name,text,createdAt:new Date().toISOString()};if(!text)return;button.disabled=true;button.textContent='POSTING…';let shared=false;if(session?.user&&state.communityUpgradeReady)try{const rows=await api('/rest/v1/post_replies',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({post_id:post.id,user_id:session.user.id,body:text,author_name:name})});reply.id=rows[0]?.id||reply.id;shared=true}catch(error){button.disabled=false;button.textContent='POST REPLY';toast(error.message);return}state.replies=[...(state.replies||[]),reply];post.replyCount=(+post.replyCount||0)+1;save();closeModal();render();toast(shared?'Reply posted.':'Reply saved here. Run the latest community upgrade to share it.')}
function openPostActions(id){const post=(state.posts||[]).find(item=>String(item.id)===String(id));if(!post)return;const own=post.userId&&post.userId===session?.user?.id;modal(`<div class="community-action-sheet"><div class="eyebrow">Post options</div><h2>${own?'MANAGE YOUR POST':'KEEP YOUR CIRCLE SAFE'}</h2><button data-action-save>${appIcon((state.savedPostIds||[]).includes(String(id))?'bookmark_remove':'bookmark_add')}<span>${(state.savedPostIds||[]).includes(String(id))?'Remove from library':'Save to What helped me'}</span></button>${own?`<button class="danger-row" data-action-delete>${appIcon('delete')}<span>Delete post</span></button>`:`<button data-action-report>${appIcon('flag')}<span>Report this post</span></button><button class="danger-row" data-action-block>${appIcon('block')}<span>Block ${esc(post.name||'this member')}</span></button>`}</div>`);$('[data-action-save]').onclick=()=>{closeModal();toggleSavedPost(post.id)};if(own)$('[data-action-delete]').onclick=()=>confirmDeleteCommunityItem('post',post);else{$('[data-action-report]').onclick=()=>openReport('post',post);$('[data-action-block]').onclick=()=>confirmBlock(post.userId,post.name)}}
function openReplyActions(id){const reply=(state.replies||[]).find(item=>String(item.id)===String(id));if(!reply)return;const own=reply.userId&&reply.userId===session?.user?.id;closeModal();modal(`<div class="community-action-sheet"><div class="eyebrow">Reply options</div><h2>${own?'MANAGE YOUR REPLY':'KEEP YOUR CIRCLE SAFE'}</h2>${own?`<button class="danger-row" data-action-delete>${appIcon('delete')}<span>Delete reply</span></button>`:`<button data-action-report>${appIcon('flag')}<span>Report this reply</span></button><button class="danger-row" data-action-block>${appIcon('block')}<span>Block ${esc(reply.name||'this member')}</span></button>`}</div>`);if(own)$('[data-action-delete]').onclick=()=>confirmDeleteCommunityItem('reply',reply);else{$('[data-action-report]').onclick=()=>openReport('reply',reply);$('[data-action-block]').onclick=()=>confirmBlock(reply.userId,reply.name)}}
function openReport(type,item){closeModal();modal(`<div class="report-modal"><div class="eyebrow">Private safety report</div><h2>REPORT ${type.toUpperCase()}</h2><p class="muted">The ${type} will be hidden for you immediately and queued for review. The author will not see who reported it.</p><form id="report-form" class="stack"><label>Reason<select class="field" name="reason" required><option value="harmful">Harmful or dangerous advice</option><option value="harassment">Harassment or shaming</option><option value="privacy">Private information</option><option value="spam">Spam or promotion</option><option value="other">Something else</option></select></label><label>Optional detail<textarea class="field" name="details" maxlength="500" placeholder="Briefly explain what the moderator should look at."></textarea></label><button class="primary">SEND PRIVATE REPORT</button></form></div>`);$('#report-form').onsubmit=event=>{event.preventDefault();submitReport(event.target,type,item)}}
async function submitReport(form,type,item){const data=Object.fromEntries(new FormData(form)),button=form.querySelector('.primary');button.disabled=true;button.textContent='SENDING…';if(session?.user&&state.communityUpgradeReady)try{await api('/rest/v1/community_reports',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({reporter_id:session.user.id,post_id:type==='post'?item.id:null,reply_id:type==='reply'?item.id:null,reason:data.reason,details:String(data.details||'').trim()||null})})}catch(error){button.disabled=false;button.textContent='SEND PRIVATE REPORT';toast(error.message);return}state.reportedTargets=[...(state.reportedTargets||[]),`${type}:${item.id}`];save();closeModal();render();toast('Report sent privately. This content is now hidden for you.')}
function confirmBlock(userId,name='Community member'){if(!userId||String(userId)===String(session?.user?.id)){toast('You cannot block your own account.');return}closeModal();modal(`<div class="block-confirm"><div class="eyebrow">Community safety</div><h2>BLOCK ${esc(name).toUpperCase()}?</h2><p class="muted">You will no longer see each other’s posts or replies. They will not be notified.</p><div class="confirm-actions"><button class="secondary" data-cancel-block>NOT NOW</button><button class="danger" data-confirm-block>BLOCK MEMBER</button></div></div>`);$('[data-cancel-block]').onclick=closeModal;$('[data-confirm-block]').onclick=()=>blockUser(userId,name)}
async function blockUser(userId,name){const button=$('[data-confirm-block]');button.disabled=true;button.textContent='BLOCKING…';if(session?.user&&state.communityUpgradeReady)try{await api('/rest/v1/user_blocks',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({blocker_id:session.user.id,blocked_id:userId,blocked_name:name||'Community member'})})}catch(error){button.disabled=false;button.textContent='BLOCK MEMBER';toast(error.message);return}state.blockedUsers=[...(state.blockedUsers||[]).filter(item=>String(item.userId)!==String(userId)),{userId:String(userId),name:name||'Community member'}];save();closeModal();render();toast(`${name||'Member'} blocked.`)}
function confirmDeleteCommunityItem(type,item){closeModal();modal(`<div class="delete-confirm"><div class="eyebrow">Community</div><h2>DELETE THIS ${type.toUpperCase()}?</h2><p class="muted">This cannot be undone.</p><div class="confirm-actions"><button class="secondary" data-cancel-delete>KEEP IT</button><button class="danger" data-confirm-delete>DELETE ${type.toUpperCase()}</button></div></div>`);$('[data-cancel-delete]').onclick=closeModal;$('[data-confirm-delete]').onclick=()=>deleteCommunityItem(type,item)}
async function deleteCommunityItem(type,item){const button=$('[data-confirm-delete]'),table=type==='post'?'circle_posts':'post_replies';button.disabled=true;button.textContent='DELETING…';if(session?.user&&state.communityUpgradeReady)try{await api(`/rest/v1/${table}?id=eq.${encodeURIComponent(item.id)}&user_id=eq.${session.user.id}`,{method:'DELETE',headers:{Prefer:'return=minimal'}})}catch(error){button.disabled=false;button.textContent=`DELETE ${type.toUpperCase()}`;toast(error.message);return}if(type==='post'){state.posts=(state.posts||[]).filter(post=>String(post.id)!==String(item.id));state.replies=(state.replies||[]).filter(reply=>String(reply.postId)!==String(item.id));state.savedPostIds=(state.savedPostIds||[]).filter(id=>String(id)!==String(item.id))}else{state.replies=(state.replies||[]).filter(reply=>String(reply.id)!==String(item.id));const post=(state.posts||[]).find(post=>String(post.id)===String(item.postId));if(post)post.replyCount=Math.max(0,(+post.replyCount||1)-1)}save();closeModal();render();toast(`${type==='post'?'Post':'Reply'} deleted.`)}
async function completeChallenge(){const challenge=currentChallenge(),button=$('[data-complete-challenge]');if(challenge.completed)return;button.disabled=true;button.textContent='SAVING BADGE…';let shared=false;if(session?.user&&state.communityUpgradeReady&&!String(challenge.id).startsWith('local-'))try{await api('/rest/v1/challenge_completions',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({challenge_id:challenge.id,user_id:session.user.id,display_name:state.profile.name||'Community member'})});shared=true}catch(error){button.disabled=false;button.textContent='MARK CHALLENGE COMPLETE';toast(error.message);return}state.challengeCompletions=[...(state.challengeCompletions||[]),{challengeId:challenge.id,weekStart:challenge.weekStart,userId:session?.user?.id||'local'}];if(state.communityChallenges){const remote=state.communityChallenges.find(item=>item.id===challenge.id);if(remote){remote.completed=true;remote.completionCount=(+remote.completionCount||0)+1}}save();render();toast(shared?`${challenge.badgeName} badge earned with the circle.`:`${challenge.badgeName} badge earned here.`)}
function openCommunitySafety(){const blocked=state.blockedUsers||[],pending=(state.communityReports||[]).filter(report=>['pending','reviewing'].includes(report.status)).length;modal(`<div class="community-safety"><div class="eyebrow">Reclaim Circles</div><h2>COMMUNITY SAFETY</h2><div class="safety-principles"><span>${appIcon('visibility_off')} Reports are private</span><span>${appIcon('shield')} Moderators can remove harmful content</span><span>${appIcon('person_off')} Blocks work both ways after cloud sync</span></div>${isModerator()?`<button class="moderator-entry" data-moderator-queue>${appIcon('admin_panel_settings')}<span><strong>MODERATOR QUEUE</strong><small>${pending} report${pending===1?'':'s'} need review</small></span><b>›</b></button>`:''}<div class="blocked-list"><h3>BLOCKED MEMBERS · ${blocked.length}</h3>${blocked.length?blocked.map(item=>`<article><span>${esc(item.name||'Community member')}</span><button data-unblock="${esc(item.userId)}">UNBLOCK</button></article>`).join(''):'<p>No blocked members.</p>'}</div></div>`);document.querySelectorAll('[data-unblock]').forEach(button=>button.onclick=()=>unblockUser(button.dataset.unblock));$('[data-moderator-queue]')?.addEventListener('click',openModeratorQueue)}
async function unblockUser(userId){if(session?.user&&state.communityUpgradeReady)try{await api(`/rest/v1/user_blocks?blocker_id=eq.${session.user.id}&blocked_id=eq.${encodeURIComponent(userId)}`,{method:'DELETE',headers:{Prefer:'return=minimal'}})}catch(error){toast(error.message);return}state.blockedUsers=(state.blockedUsers||[]).filter(item=>String(item.userId)!==String(userId));save();closeModal();render();toast('Member unblocked.')}
function openModeratorQueue(){if(!isModerator())return;closeModal();const reports=(state.communityReports||[]).filter(report=>['pending','reviewing'].includes(report.status));modal(`<div class="moderator-queue"><div class="eyebrow">Restricted to moderators</div><h2>REVIEW QUEUE</h2><p class="muted">Review the reported content and context. Remove only content that breaks community rules; otherwise dismiss the report.</p><div class="moderation-list">${reports.length?reports.map(report=>{const type=report.postId?'post':'reply',target=report.postId?(state.posts||[]).find(item=>String(item.id)===String(report.postId)):(state.replies||[]).find(item=>String(item.id)===String(report.replyId));return `<article><header><span>${esc(report.reason||'other').replaceAll('_',' ')}</span><small>${timeAgo(report.createdAt)}</small></header><p>${esc(target?.text||'Content unavailable or already removed.')}</p>${report.details?`<blockquote>${esc(report.details)}</blockquote>`:''}<div><button class="secondary" data-moderate-dismiss="${esc(report.id)}">DISMISS</button><button class="danger" data-moderate-remove="${esc(report.id)}" data-target-type="${type}">REMOVE ${type.toUpperCase()}</button></div></article>`}).join(''):'<div class="reply-empty">No reports need review.</div>'}</div></div>`);document.querySelectorAll('[data-moderate-dismiss]').forEach(button=>button.onclick=()=>moderateReport(button.dataset.moderateDismiss,'dismiss'));document.querySelectorAll('[data-moderate-remove]').forEach(button=>button.onclick=()=>moderateReport(button.dataset.moderateRemove,'remove'))}
async function moderateReport(reportId,action){if(!isModerator()||!state.communityUpgradeReady)return;const report=(state.communityReports||[]).find(item=>String(item.id)===String(reportId));if(!report)return;const targetType=report.postId?'post':'reply',targetId=report.postId||report.replyId,button=action==='remove'?$(`[data-moderate-remove="${CSS.escape(String(reportId))}"]`):$(`[data-moderate-dismiss="${CSS.escape(String(reportId))}"]`);button.disabled=true;button.textContent='SAVING…';try{if(action==='remove')await api(`/rest/v1/${targetType==='post'?'circle_posts':'post_replies'}?id=eq.${encodeURIComponent(targetId)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({moderation_status:'removed'})});await api(`/rest/v1/community_reports?id=eq.${encodeURIComponent(reportId)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:action==='remove'?'actioned':'dismissed',reviewed_at:new Date().toISOString()})})}catch(error){button.disabled=false;button.textContent=action==='remove'?`REMOVE ${targetType.toUpperCase()}`:'DISMISS';toast(error.message);return}report.status=action==='remove'?'actioned':'dismissed';if(action==='remove'){if(targetType==='post')state.posts=(state.posts||[]).filter(item=>String(item.id)!==String(targetId));else state.replies=(state.replies||[]).filter(item=>String(item.id)!==String(targetId))}save();closeModal();render();toast(action==='remove'?'Content removed from community feeds.':'Report dismissed.')}
function openSetback(){const current=elapsedParts(metrics().ms);modal(`<div class="setback-modal"><div class="eyebrow">Momentum · honest tracking</div><h2>LOG A SETBACK</h2><p class="muted">This will protect your current ${current.days}d ${current.hours}h as a personal-best candidate, end this attempt, and begin a new attempt now. Nothing you achieved is erased.</p><form id="setback-form" class="stack"><label>Cigarettes smoked<input class="field" name="cigarettes" type="number" min="1" max="100" value="1" required></label><label>Optional note<input class="field" name="note" maxlength="160" placeholder="What triggered it?"></label><div class="confirm-actions"><button type="button" class="secondary" data-cancel-setback>NOT NOW</button><button class="danger">START NEW ATTEMPT</button></div></form></div>`);$('[data-cancel-setback]').onclick=closeModal;$('#setback-form').onsubmit=e=>{e.preventDefault();logSetback(e.target)}}
async function logSetback(form){const data=Object.fromEntries(new FormData(form)),button=form.querySelector('.danger'),previousSeconds=Math.floor(metrics().ms/1000),at=new Date().toISOString();button.disabled=true;button.textContent='SAVING…';state.profile.bestStreakSeconds=Math.max(+state.profile.bestStreakSeconds||0,previousSeconds);state.profile.attemptNumber=Math.max(1,+state.profile.attemptNumber||1)+1;state.profile.quitAt=at;state.communityStageTouched=false;state.relapses=[...(state.relapses||[]),{at,cigarettes:+data.cigarettes||1,note:data.note||'',streakSeconds:previousSeconds}];let fullySynced=true;if(session?.user)try{await api('/rest/v1/smoking_events',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({user_id:session.user.id,cigarettes:+data.cigarettes||1,event_type:'smoked',created_at:at})});fullySynced=await persistProfile()}catch(error){fullySynced=false;console.warn('Setback sync:',error.message)}save();closeModal();render();toast(fullySynced?`Attempt ${state.profile.attemptNumber} started. Your best is safe.`:`Attempt ${state.profile.attemptNumber} started on this device. It will sync when you reconnect.`)}
function openTool(tool){if(tool==='breathe'){modal(`<div class="breath-stage"><div class="breath-orb"><strong id="breath-label">INHALE</strong></div><p class="muted">4 seconds each · inhale · hold · exhale · hold</p><button class="primary" data-complete style="width:100%">I FEEL READY</button></div>`);let i=0,steps=['INHALE','HOLD','EXHALE','HOLD'];const tick=()=>{const orb=$('.breath-orb');$('#breath-label').textContent=steps[i%4];orb.classList.toggle('expand',i%4<2);i++};tick();breathing=setInterval(tick,4000);$('[data-complete]').onclick=()=>finishCraving(true,tool)}else if(tool==='timer'){modal(`<div class="breath-stage"><div class="timer" id="timer">05:00</div><p class="muted">Notice the urge without obeying it.</p><button class="primary" data-complete style="width:100%">END & LOG WIN</button></div>`);let s=300;cravingTimer=setInterval(()=>{s--;$('#timer').textContent=`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;if(s<=0)finishCraving(true,tool)},1000);$('[data-complete]').onclick=()=>finishCraving(true,tool)}else{modal(`<h2>${tool==='water'?'WATER RESET':'TAKE A WALK'}</h2><p class="muted">${tool==='water'?'Pour a glass, sip slowly, and move to a different room.':'Walk for five minutes. Pay attention to five things you can see and four you can hear.'}</p><button class="primary" data-complete style="width:100%">DONE — LOG THE WIN</button>`);$('[data-complete]').onclick=()=>finishCraving(true,tool)}}
function finishCravingFlow(resisted){closeModal();state.stage='app';state.view='home';save();render();toast(resisted?'Craving passed. That choice is logged.':'Craving logged without judgment.')}
function saveCravingFeedback(craving,feedback){craving.feedback=feedback;save();finishCravingFlow(true);if(session?.user&&craving.cloudId)api(`/rest/v1/smoking_events?id=eq.${encodeURIComponent(craving.cloudId)}&user_id=eq.${session.user.id}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({tool_feedback:feedback})}).catch(error=>console.warn('Craving feedback sync:',error.message))}
function askCravingFeedback(craving){modal(`<div class="craving-feedback"><div class="eyebrow">OPTIONAL</div><h2>DID THAT HELP?</h2><p class="muted">One tap helps Reclaim learn what works for you.</p><div class="feedback-options"><button class="secondary" data-craving-feedback="yes">YES</button><button class="secondary" data-craving-feedback="a_little">A LITTLE</button><button class="secondary" data-craving-feedback="not_really">NOT REALLY</button></div><button class="feedback-skip" data-feedback-skip>SKIP</button></div>`);document.querySelectorAll('[data-craving-feedback]').forEach(button=>button.onclick=()=>saveCravingFeedback(craving,button.dataset.cravingFeedback));const skip=()=>finishCravingFlow(true);$('[data-feedback-skip]').onclick=skip;$('[data-close]').onclick=skip}
async function finishCraving(resisted,tool=null){const craving={at:new Date().toISOString(),resisted,tool,feedback:null,cloudId:null};state.cravings.push(craving);save();if(session?.user)try{const rows=await api('/rest/v1/smoking_events',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({user_id:session.user.id,cigarettes:0,event_type:'craving',resisted,toolkit:tool,smoked_at:craving.at})});craving.cloudId=rows[0]?.id||null;save()}catch(e){console.warn(e.message)}closeModal();if(resisted&&tool)askCravingFeedback(craving);else finishCravingFlow(resisted)}
function openGoal(){modal(`<h2>ADD A DREAM</h2><form id="goal-form" class="stack"><label>What are you saving for?<input class="field" name="name" required placeholder="Weekend away"></label><label>Target amount<input class="field" name="target" type="number" min="1" required></label><button class="primary">CREATE GOAL</button></form>`);$('#goal-form').onsubmit=async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));let id=crypto.randomUUID();if(session?.user)try{const rows=await api('/rest/v1/savings_goals',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({user_id:session.user.id,name:d.name,target_amount:+d.target,current_amount:0})});id=rows[0]?.id||id}catch(err){toast(err.message);return}state.goals.push({id,name:d.name,target:+d.target});save();closeModal();render()}}
function confirmDeleteGoal(id){const goal=state.goals.find(g=>String(g.id)===String(id));if(!goal)return;modal(`<div class="delete-confirm"><div class="eyebrow">Savings goal</div><h2>DELETE “${esc(goal.name)}”?</h2><p class="muted">This removes the goal from your account. Your smoke-free savings calculation will not change.</p><div class="confirm-actions"><button class="secondary" data-cancel-delete>KEEP GOAL</button><button class="danger" data-confirm-delete>DELETE GOAL</button></div></div>`);$('[data-cancel-delete]').onclick=closeModal;$('[data-confirm-delete]').onclick=async e=>{const button=e.currentTarget;button.disabled=true;button.textContent='DELETING…';if(session?.user)try{await api(`/rest/v1/savings_goals?id=eq.${encodeURIComponent(id)}&user_id=eq.${session.user.id}`,{method:'DELETE',headers:{Prefer:'return=minimal'}})}catch(error){button.disabled=false;button.textContent='DELETE GOAL';toast(error.message);return}state.goals=state.goals.filter(g=>String(g.id)!==String(id));save();closeModal();render();toast('Goal deleted.')}}
function friendlyMessage(text){const t=String(text||'');if(/failed to fetch|networkerror|load failed|network request failed/i.test(t))return 'Can’t reach Reclaim right now. Check your connection and try again.';if(/^request failed \(5\d\d\)/i.test(t))return 'Something went wrong on our side. Please try again in a moment.';return t}
function toast(text){document.body.insertAdjacentHTML('beforeend',`<div class="toast" role="status" aria-live="polite">${esc(friendlyMessage(text))}</div>`);setTimeout(()=>$('.toast')?.remove(),2500)}
render();
void acceptOAuth().then(ok=>{if(ok){render();void smokingJourney.sync();hydrateCommunity().then(()=>{save();render()})}});
void smokingJourney.sync();
if(session?.user)hydrateCommunity().then(()=>{save();if(state.stage==='app'&&state.view==='circles')render()});

