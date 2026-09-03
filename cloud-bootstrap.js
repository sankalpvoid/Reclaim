import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

const STATE_KEY='reclaim-state-v2';
const SESSION_KEY='reclaim-session-v1';

function readJson(key,fallback=null){
  try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}
}
function writeJson(key,value){localStorage.setItem(key,JSON.stringify(value))}

let session=readJson(SESSION_KEY);

function headers(){
  const h={apikey:SUPABASE_KEY,'Content-Type':'application/json'};
  if(session?.access_token)h.Authorization=`Bearer ${session.access_token}`;
  return h;
}

async function request(path,{retry=true}={}){
  const response=await fetch(`${SUPABASE_URL}${path}`,{headers:headers()});
  const text=await response.text();
  let data;
  try{data=text?JSON.parse(text):null}catch{data=text}
  if(response.ok)return data;
  const message=data?.msg||data?.message||data?.error_description||`Request failed (${response.status})`;
  if(retry&&(response.status===401||response.status===403)&&session?.refresh_token){
    const refreshed=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,{
      method:'POST',headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({refresh_token:session.refresh_token})
    });
    const refreshText=await refreshed.text();
    let refreshData;
    try{refreshData=refreshText?JSON.parse(refreshText):null}catch{refreshData=null}
    if(refreshed.ok&&refreshData?.access_token){
      session={...session,...refreshData};
      writeJson(SESSION_KEY,session);
      return request(path,{retry:false});
    }
  }
  throw new Error(message);
}

function blankProfile(){
  return {name:'',journeyMode:'quit',quitAt:new Date().toISOString(),cigarettesPerDay:20,dailyTarget:15,pricePerPack:300,cigarettesPerPack:20,minutesPerCigarette:11,country:'IN',currency:'₹',currencyCode:'INR',attemptNumber:1,bestStreakSeconds:0};
}

function mapProfile(current,row){
  if(!row)return current;
  return {
    ...(current||{}),
    name:row.display_name??current?.name??'',
    journeyMode:row.journey_mode??current?.journeyMode??'quit',
    dailyTarget:row.daily_target==null?(current?.dailyTarget??15):+row.daily_target,
    quitAt:row.quit_date||row.quit_at||current?.quitAt||new Date().toISOString(),
    cigarettesPerDay:+row.cigarettes_per_day||(current?.cigarettesPerDay??20),
    pricePerPack:row.price_per_pack==null?(current?.pricePerPack??300):+row.price_per_pack,
    cigarettesPerPack:+row.cigarettes_per_pack||(current?.cigarettesPerPack??20),
    minutesPerCigarette:+row.minutes_per_cigarette||(current?.minutesPerCigarette??11),
    country:row.country||current?.country||'IN',
    currency:row.currency_symbol||current?.currency||'₹',
    attemptNumber:+row.attempt_number||(current?.attemptNumber??1),
    bestStreakSeconds:+row.best_streak_seconds||(current?.bestStreakSeconds??0)
  };
}

async function bootstrap(){
  if(!session?.access_token)return;
  let user;
  try{
    user=await request('/auth/v1/user');
  }catch(error){
    console.warn('Cloud bootstrap auth:',error.message);
    return;
  }
  if(!user?.id)return;
  session={...session,user};
  writeJson(SESSION_KEY,session);

  const state=readJson(STATE_KEY,{})||{};
  const sameOwner=!state.cloudOwnerId||state.cloudOwnerId===user.id;
  const localCravings=sameOwner?(state.cravings||[]).filter(item=>!item.cloudId):[];
  const localSmoking=sameOwner?(state.smokingEvents||[]).filter(item=>!item.cloudId):[];
  const localCheckins=sameOwner?(state.checkins||[]):[];

  const jobs={
    profile:request(`/rest/v1/profiles?id=eq.${user.id}&select=*`),
    health:request('/rest/v1/health_milestones?select=*&order=minutes_after_quitting.asc'),
    goals:request(`/rest/v1/savings_goals?user_id=eq.${user.id}&select=*`),
    cravings:request(`/rest/v1/smoking_events?user_id=eq.${user.id}&event_type=eq.craving&select=id,smoked_at,created_at,resisted,toolkit,tool_feedback&order=smoked_at.asc`),
    smoking:request(`/rest/v1/smoking_events?user_id=eq.${user.id}&event_type=eq.smoked&select=id,smoked_at,created_at,cigarettes&order=created_at.asc`),
    checkins:request(`/rest/v1/daily_checkins?user_id=eq.${user.id}&select=client_id,mood,note,created_at&order=created_at.asc`)
  };
  const names=Object.keys(jobs);
  const settled=await Promise.allSettled(Object.values(jobs));
  const result=Object.fromEntries(names.map((name,index)=>[name,settled[index]]));
  const next=sameOwner
    ? {...state,cloudOwnerId:user.id}
    : {...state,cloudOwnerId:user.id,profile:blankProfile(),remoteMilestones:[],goals:[],cravings:[],smokingEvents:[],checkins:[]};

  if(result.profile.status==='fulfilled')next.profile=mapProfile(next.profile,result.profile.value?.[0]);
  if(result.health.status==='fulfilled')next.remoteMilestones=result.health.value||[];
  if(result.goals.status==='fulfilled')next.goals=(result.goals.value||[]).map(goal=>({id:goal.id,name:goal.name,target:+goal.target_amount}));
  if(result.cravings.status==='fulfilled'){
    const remote=(result.cravings.value||[]).map(row=>({at:row.smoked_at||row.created_at,resisted:!!row.resisted,tool:row.toolkit,feedback:row.tool_feedback,cloudId:row.id}));
    next.cravings=[...remote,...localCravings].sort((a,b)=>new Date(a.at)-new Date(b.at));
  }
  if(result.smoking.status==='fulfilled'){
    const remote=(result.smoking.value||[]).map(row=>({at:row.smoked_at||row.created_at,cigarettes:+row.cigarettes||1,cloudId:row.id}));
    next.smokingEvents=[...remote,...localSmoking].sort((a,b)=>new Date(a.at)-new Date(b.at));
  }
  if(result.checkins.status==='fulfilled'){
    const remote=(result.checkins.value||[]).map(row=>({clientId:row.client_id,mood:row.mood,note:row.note||'',at:row.created_at}));
    const remoteIds=new Set(remote.map(item=>item.clientId).filter(Boolean));
    const pending=localCheckins.filter(item=>!item.clientId||!remoteIds.has(item.clientId));
    next.checkins=[...remote,...pending].sort((a,b)=>new Date(a.at)-new Date(b.at));
  }

  const failures=names.filter((name,index)=>settled[index].status==='rejected');
  next.cloudRestore={at:new Date().toISOString(),partial:failures.length>0,failed:failures};
  writeJson(STATE_KEY,next);
  window.__reclaimCloudBootstrap={userId:user.id,partial:failures.length>0,failed:failures};
  window.dispatchEvent(new CustomEvent('reclaim:cloud-bootstrap',{detail:window.__reclaimCloudBootstrap}));
}

await bootstrap();
