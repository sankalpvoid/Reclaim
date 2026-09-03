const VALID_TYPES=new Set(['smoked','craving']);

function safeIso(value){
  const date=new Date(value||0);
  return Number.isFinite(date.getTime())?date.toISOString():new Date().toISOString();
}

function normalizeOne(item={}){
  const type=item.type||item.eventType||item.event_type;
  if(!VALID_TYPES.has(type))return null;
  const at=safeIso(item.at||item.smoked_at||item.created_at);
  const cloudId=item.cloudId||item.id||null;
  if(type==='smoked')return {
    type,
    at,
    cigarettes:Math.max(0,+item.cigarettes||1),
    ...(cloudId?{cloudId}:{})
  };
  return {
    type,
    at,
    resisted:Boolean(item.resisted),
    tool:item.tool??item.toolkit??null,
    feedback:item.feedback??item.tool_feedback??null,
    durationSeconds:item.durationSeconds??item.duration_seconds??null,
    ...(cloudId?{cloudId}:{})
  };
}

function legacyEvents(state={}){
  const smoked=(Array.isArray(state.smokingEvents)?state.smokingEvents:[]).map(item=>normalizeOne({...item,type:'smoked'}));
  const cravings=(Array.isArray(state.cravings)?state.cravings:[]).map(item=>normalizeOne({...item,type:'craving'}));
  return [...smoked,...cravings].filter(Boolean);
}

function signature(event){
  if(event.cloudId)return `cloud:${event.cloudId}`;
  if(event.type==='smoked')return `local:smoked:${event.at}:${event.cigarettes}`;
  return `local:craving:${event.at}`;
}

function mergeEvent(existing,incoming){
  if(!existing)return incoming;
  return {
    ...existing,
    ...incoming,
    ...(existing.cloudId||incoming.cloudId?{cloudId:incoming.cloudId||existing.cloudId}:{})
  };
}

export function normalizeBehaviorEvents(source=[],fallbackState=null){
  const incoming=[...(Array.isArray(source)?source:[])];
  if(fallbackState)incoming.push(...legacyEvents(fallbackState));
  const events=[];
  const byCloud=new Map();
  const byLocal=new Map();
  for(const raw of incoming){
    const event=normalizeOne(raw);
    if(!event)continue;
    const localKey=event.type==='smoked'?`local:smoked:${event.at}:${event.cigarettes}`:`local:craving:${event.at}`;
    let index=event.cloudId?byCloud.get(String(event.cloudId)):undefined;
    if(index==null)index=byLocal.get(localKey);
    if(index==null){
      index=events.length;
      events.push(event);
    }else events[index]=mergeEvent(events[index],event);
    if(events[index].cloudId)byCloud.set(String(events[index].cloudId),index);
    byLocal.set(localKey,index);
  }
  return events.sort((a,b)=>new Date(a.at)-new Date(b.at));
}

export function deriveSmokingEvents(events=[]){
  return normalizeBehaviorEvents(events)
    .filter(event=>event.type==='smoked')
    .map(event=>({at:event.at,cigarettes:event.cigarettes,...(event.cloudId?{cloudId:event.cloudId}:{})}));
}

export function deriveCravings(events=[]){
  return normalizeBehaviorEvents(events)
    .filter(event=>event.type==='craving')
    .map(event=>({
      at:event.at,
      resisted:event.resisted,
      tool:event.tool,
      feedback:event.feedback,
      ...(event.durationSeconds!=null?{durationSeconds:event.durationSeconds}:{}),
      ...(event.cloudId?{cloudId:event.cloudId}:{})
    }));
}

export function normalizeBehaviorState(state={}){
  const behaviorEvents=normalizeBehaviorEvents(state.behaviorEvents||[],state);
  return {
    ...state,
    behaviorEvents,
    smokingEvents:deriveSmokingEvents(behaviorEvents),
    cravings:deriveCravings(behaviorEvents)
  };
}

export function fromDatabaseRows(rows=[]){
  return normalizeBehaviorEvents((Array.isArray(rows)?rows:[]).map(row=>({
    type:row.event_type,
    at:row.smoked_at||row.created_at,
    cigarettes:row.cigarettes,
    resisted:row.resisted,
    tool:row.toolkit,
    feedback:row.tool_feedback,
    durationSeconds:row.duration_seconds,
    cloudId:row.id
  })));
}
