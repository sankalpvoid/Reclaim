import { normalizeBehaviorState } from './behavior-model.js';

const STATE_KEY='reclaim-state-v2';
const nativeSetItem=Storage.prototype.setItem;
let normalizing=false;

function readState(){try{return JSON.parse(localStorage.getItem(STATE_KEY)||'{}')}catch{return {}}}
function normalizeStoredState(){
  const current=readState();
  const next=normalizeBehaviorState(current);
  nativeSetItem.call(localStorage,STATE_KEY,JSON.stringify(next));
  return next;
}

// Normalize once before app.js loads so existing localStorage users migrate silently.
normalizeStoredState();

// app.js still writes the legacy projections. Convert every durable state write back into
// one canonical behaviorEvents list, then regenerate those projections for compatibility.
Storage.prototype.setItem=function(key,value){
  if(this!==localStorage||key!==STATE_KEY||normalizing)return nativeSetItem.call(this,key,value);
  try{
    normalizing=true;
    const parsed=JSON.parse(String(value));
    const normalized=normalizeBehaviorState(parsed);
    return nativeSetItem.call(this,key,JSON.stringify(normalized));
  }catch{
    return nativeSetItem.call(this,key,value);
  }finally{normalizing=false}
};

window.__reclaimBehaviorModel={
  version:1,
  getEvents:()=>normalizeBehaviorState(readState()).behaviorEvents
};
