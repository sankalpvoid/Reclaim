const UI_STYLESHEET_ID='reclaim-ui-polish';

function ensureStyles(){
  if(document.getElementById(UI_STYLESHEET_ID))return;
  const link=document.createElement('link');
  link.id=UI_STYLESHEET_ID;
  link.rel='stylesheet';
  link.href='ui-polish.css?v=ui-cleanup-2';
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

function enhanceQuitDatePicker(root=document){
  const picker=root.querySelector('.quit-picker:not([data-centered-wheels])');
  if(!picker)return;
  picker.setAttribute('data-centered-wheels','');

  picker.querySelectorAll('select[data-wheel]').forEach(select=>{
    const options=[...select.options];
    if(!options.length)return;

    const measuredHeight=Math.round(select.getBoundingClientRect().height)||(/month|day|year/.test(select.dataset.wheel||'')?150:112);
    const rowHeight=44;
    const wheel=document.createElement('div');
    wheel.className='reclaim-wheel';
    wheel.style.setProperty('--wheel-height',`${measuredHeight}px`);
    wheel.style.setProperty('--wheel-row',`${rowHeight}px`);
    wheel.dataset.wheelUi=select.dataset.wheel||'';

    const scroller=document.createElement('div');
    scroller.className='reclaim-wheel-scroller';
    scroller.tabIndex=0;
    scroller.setAttribute('role','listbox');
    scroller.setAttribute('aria-label',`${select.dataset.wheel||'Date'} picker`);

    const track=document.createElement('div');
    track.className='reclaim-wheel-track';

    options.forEach((option,index)=>{
      const item=document.createElement('button');
      item.type='button';
      item.className='reclaim-wheel-item';
      item.dataset.value=option.value;
      item.dataset.index=String(index);
      item.textContent=option.textContent||option.value;
      item.setAttribute('role','option');
      item.tabIndex=-1;
      track.appendChild(item);
    });

    scroller.appendChild(track);
    wheel.appendChild(scroller);
    select.classList.add('reclaim-wheel-native');
    select.insertAdjacentElement('afterend',wheel);

    let settleTimer=0;
    let activeIndex=Math.max(0,select.selectedIndex);
    const items=[...track.querySelectorAll('.reclaim-wheel-item')];

    const setActive=(index,{scroll=false,smooth=false,emit=true}={})=>{
      const next=Math.max(0,Math.min(items.length-1,index));
      activeIndex=next;
      items.forEach((item,itemIndex)=>{
        const selected=itemIndex===next;
        item.classList.toggle('is-selected',selected);
        item.setAttribute('aria-selected',selected?'true':'false');
      });
      if(select.selectedIndex!==next){
        select.selectedIndex=next;
        if(emit)select.dispatchEvent(new Event('change',{bubbles:true}));
      }
      if(scroll){
        scroller.scrollTo({top:next*rowHeight,behavior:smooth?'smooth':'auto'});
      }
    };

    const nearestIndex=()=>Math.max(0,Math.min(items.length-1,Math.round(scroller.scrollTop/rowHeight)));

    scroller.addEventListener('scroll',()=>{
      const next=nearestIndex();
      if(next!==activeIndex)setActive(next,{emit:true});
      clearTimeout(settleTimer);
      settleTimer=window.setTimeout(()=>setActive(nearestIndex(),{scroll:true,smooth:true,emit:true}),80);
    },{passive:true});

    scroller.addEventListener('keydown',event=>{
      let next=null;
      if(event.key==='ArrowDown')next=activeIndex+1;
      if(event.key==='ArrowUp')next=activeIndex-1;
      if(event.key==='Home')next=0;
      if(event.key==='End')next=items.length-1;
      if(next===null)return;
      event.preventDefault();
      setActive(next,{scroll:true,smooth:true,emit:true});
    });

    items.forEach((item,index)=>item.addEventListener('click',()=>setActive(index,{scroll:true,smooth:true,emit:true})));

    setActive(activeIndex,{emit:false});
    requestAnimationFrame(()=>setActive(activeIndex,{scroll:true,emit:false}));
  });
}

function applyUiPolish(){
  ensureStyles();
  const app=document.getElementById('app');
  if(app){
    markCompactFields(app);
    markAppearance(app);
    pruneSupabaseStatus(app);
  }
  enhanceQuitDatePicker(document);
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
if(document.body)new MutationObserver(queueUiPolish).observe(document.body,{childList:true,subtree:true});
window.addEventListener('reclaim:reload-restored',queueUiPolish);
window.addEventListener('storage',queueUiPolish);
