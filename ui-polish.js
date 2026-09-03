const UI_STYLESHEET_ID='reclaim-ui-polish';

function ensureStyles(){
  if(document.getElementById(UI_STYLESHEET_ID))return;
  const link=document.createElement('link');
  link.id=UI_STYLESHEET_ID;
  link.rel='stylesheet';
  link.href='ui-polish.css?v=ui-cleanup-1';
  document.head.appendChild(link);
}

function normalizedText(el){return (el?.textContent||'').replace(/\s+/g,' ').trim()}

function markCompactFields(root=document){
  const labels=[...root.querySelectorAll('label')];
  const planData=/(cigarette|cigarettes|pack|price|cost|minute|minutes|daily target|target per day|per day|smokes? per day)/i;
  labels.forEach(label=>{
    const control=label.querySelector('input,select');
    if(!control||['date','time','datetime-local'].includes((control.type||'').toLowerCase()))return;
    if(!planData.test(normalizedText(label)))return;
    label.classList.add('ui-compact-field');
    control.classList.add('ui-compact-value');
  });
}

function markAppearance(root=document){
  const candidates=[...root.querySelectorAll('h1,h2,h3,strong,.eyebrow,label,span')]
    .filter(el=>/^appearance$/i.test(normalizedText(el)));
  const heading=candidates[0];
  if(!heading)return;
  const card=heading.closest('.card')||heading.parentElement;
  if(card)card.classList.add('ui-appearance-card');
}

function pruneSupabaseStatus(root=document){
  const matches=[...root.querySelectorAll('*')]
    .filter(el=>/connected\s+to\s+supabase/i.test(normalizedText(el)))
    .sort((a,b)=>normalizedText(a).length-normalizedText(b).length);
  const target=matches[0];
  if(!target)return;
  const card=target.closest('.card');
  if(card){
    const cardText=normalizedText(card);
    const interactive=card.querySelector('button,input,select,textarea,a');
    if(!interactive&&cardText.length<=120){card.setAttribute('data-ui-supabase-status','');return;}
  }
  target.setAttribute('data-ui-supabase-status','');
  const parent=target.parentElement;
  if(parent&&parent.children.length===1)parent.setAttribute('data-ui-supabase-status','');
}

function applyUiPolish(){
  ensureStyles();
  const app=document.getElementById('app');
  if(!app)return;
  markCompactFields(app);
  markAppearance(app);
  pruneSupabaseStatus(app);
}

let queued=false;
function queueUiPolish(){
  if(queued)return;
  queued=true;
  queueMicrotask(()=>{queued=false;applyUiPolish()});
}

applyUiPolish();
const app=document.getElementById('app');
if(app)new MutationObserver(queueUiPolish).observe(app,{childList:true,subtree:true});
window.addEventListener('reclaim:reload-restored',queueUiPolish);
window.addEventListener('storage',queueUiPolish);
