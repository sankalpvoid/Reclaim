const UI_STYLESHEET_ID='reclaim-ui-polish';

function ensureStyles(){
  if(document.getElementById(UI_STYLESHEET_ID))return;
  const link=document.createElement('link');
  link.id=UI_STYLESHEET_ID;
  link.rel='stylesheet';
  link.href='ui-polish.css?v=ui-cleanup-3';
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
  if(!card)return;

  card.classList.add('ui-appearance-card');
  card.style.setProperty('display','flex','important');
  card.style.setProperty('align-items','center','important');
  card.style.setProperty('justify-content','space-between','important');
  card.style.setProperty('gap','10px','important');
  card.style.setProperty('min-height','0','important');
  card.style.setProperty('padding','10px 12px','important');
  card.style.setProperty('border-radius','15px','important');

  const copy=card.querySelector('.appearance-copy');
  if(copy){
    copy.style.setProperty('display','block','important');
    copy.style.setProperty('min-width','0','important');
  }

  const decorativeIcon=card.querySelector('.appearance-icon');
  if(decorativeIcon)decorativeIcon.style.setProperty('display','none','important');

  const helper=copy?.querySelector('small');
  if(helper)helper.style.setProperty('display','none','important');

  if(heading){
    heading.style.setProperty('font-size','14px','important');
    heading.style.setProperty('line-height','1.1','important');
    heading.style.setProperty('margin','0','important');
  }

  const toggle=card.querySelector('.theme-toggle');
  if(toggle){
    toggle.style.setProperty('width','116px','important');
    toggle.style.setProperty('min-width','116px','important');
    toggle.style.setProperty('display','grid','important');
    toggle.style.setProperty('grid-template-columns','1fr 1fr','important');
    toggle.style.setProperty('gap','2px','important');
    toggle.style.setProperty('padding','3px','important');
    toggle.style.setProperty('margin','0','important');
    toggle.style.setProperty('border-radius','11px','important');
  }

  toggle?.querySelectorAll('button').forEach(button=>{
    button.style.setProperty('min-height','30px','important');
    button.style.setProperty('height','30px','important');
    button.style.setProperty('padding','4px 7px','important');
    button.style.setProperty('border-radius','8px','important');
    button.style.setProperty('font-size','10px','important');
    button.style.setProperty('line-height','1','important');
    button.style.setProperty('gap','0','important');
  });

  toggle?.querySelectorAll('.app-icon').forEach(icon=>icon.style.setProperty('display','none','important'));
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

function enhanceCountryPicker(root=document){
  const select=root.querySelector('#setup-form select[name="country"]:not([data-reclaim-country-ready])');
  if(!select)return;
  const label=select.closest('label');
  if(!label)return;

  document.body.classList.remove('reclaim-country-sheet-open');
  document.querySelectorAll('[data-reclaim-country-sheet],[data-reclaim-country-backdrop]').forEach(el=>el.remove());

  select.dataset.reclaimCountryReady='';
  select.classList.add('reclaim-country-native');
  label.classList.add('reclaim-country-field');

  const trigger=document.createElement('button');
  trigger.type='button';
  trigger.className='reclaim-country-trigger';
  trigger.setAttribute('aria-haspopup','dialog');
  trigger.setAttribute('aria-expanded','false');
  trigger.innerHTML='<span class="reclaim-country-trigger-copy"><small>SELECTED COUNTRY</small><strong data-reclaim-country-value></strong></span><span class="material-symbols-rounded reclaim-country-chevron" aria-hidden="true">expand_more</span>';
  select.insertAdjacentElement('afterend',trigger);

  const backdrop=document.createElement('div');
  backdrop.className='reclaim-country-backdrop';
  backdrop.dataset.reclaimCountryBackdrop='';
  backdrop.hidden=true;

  const sheet=document.createElement('section');
  sheet.className='reclaim-country-sheet';
  sheet.dataset.reclaimCountrySheet='';
  sheet.hidden=true;
  sheet.setAttribute('role','dialog');
  sheet.setAttribute('aria-modal','true');
  sheet.setAttribute('aria-labelledby','reclaim-country-sheet-title');
  sheet.innerHTML=`
    <div class="reclaim-country-handle" data-reclaim-country-handle aria-hidden="true"><span></span></div>
    <header class="reclaim-country-sheet-header">
      <div>
        <div class="eyebrow">Your location</div>
        <h2 id="reclaim-country-sheet-title">CHOOSE COUNTRY</h2>
      </div>
      <button type="button" class="reclaim-country-close" data-reclaim-country-close aria-label="Close country picker"><span class="material-symbols-rounded" aria-hidden="true">close</span></button>
    </header>
    <label class="reclaim-country-search">
      <span class="material-symbols-rounded" aria-hidden="true">search</span>
      <input type="search" inputmode="search" autocomplete="off" placeholder="Search countries" aria-label="Search countries">
    </label>
    <div class="reclaim-country-list" role="listbox" aria-label="Countries"></div>
  `;

  document.body.append(backdrop,sheet);

  const value=trigger.querySelector('[data-reclaim-country-value]');
  const search=sheet.querySelector('.reclaim-country-search input');
  const list=sheet.querySelector('.reclaim-country-list');
  const closeButton=sheet.querySelector('[data-reclaim-country-close]');
  const handle=sheet.querySelector('[data-reclaim-country-handle]');
  const options=[...select.options];
  let closingTimer=0;
  let lastFocus=null;

  const selectedOption=()=>select.options[select.selectedIndex]||select.options[0];
  const syncTrigger=()=>{value.textContent=selectedOption()?.textContent||'Choose country'};

  const renderOptions=(query='')=>{
    const needle=query.trim().toLocaleLowerCase();
    list.replaceChildren();
    options.forEach((option,index)=>{
      const name=(option.textContent||option.value).trim();
      if(needle&&!name.toLocaleLowerCase().includes(needle)&&!option.value.toLocaleLowerCase().includes(needle))return;
      const button=document.createElement('button');
      const selected=index===select.selectedIndex;
      button.type='button';
      button.className=`reclaim-country-option${selected?' is-selected':''}`;
      button.dataset.value=option.value;
      button.setAttribute('role','option');
      button.setAttribute('aria-selected',selected?'true':'false');

      const copy=document.createElement('span');
      copy.className='reclaim-country-option-copy';
      const countryName=document.createElement('strong');
      countryName.textContent=name;
      const code=document.createElement('small');
      code.textContent=option.value;
      copy.append(countryName,code);

      const check=document.createElement('span');
      check.className='material-symbols-rounded reclaim-country-check';
      check.setAttribute('aria-hidden','true');
      check.textContent='check';
      button.append(copy,check);

      button.addEventListener('click',()=>{
        select.selectedIndex=index;
        select.dispatchEvent(new Event('change',{bubbles:true}));
        syncTrigger();
        renderOptions(search.value);
        closeSheet();
      });
      list.appendChild(button);
    });

    if(!list.children.length){
      const empty=document.createElement('p');
      empty.className='reclaim-country-empty';
      empty.textContent='No matching country.';
      list.appendChild(empty);
    }
  };

  const finishClose=()=>{
    if(sheet.classList.contains('is-open'))return;
    sheet.hidden=true;
    backdrop.hidden=true;
    sheet.style.removeProperty('transform');
    sheet.style.removeProperty('transition');
  };

  function closeSheet(){
    clearTimeout(closingTimer);
    sheet.classList.remove('is-open');
    backdrop.classList.remove('is-open');
    trigger.classList.remove('is-open');
    trigger.setAttribute('aria-expanded','false');
    document.body.classList.remove('reclaim-country-sheet-open');
    search.value='';
    closingTimer=window.setTimeout(finishClose,240);
    if(lastFocus?.isConnected)lastFocus.focus({preventScroll:true});
  }

  const openSheet=()=>{
    clearTimeout(closingTimer);
    lastFocus=document.activeElement;
    renderOptions('');
    backdrop.hidden=false;
    sheet.hidden=false;
    sheet.style.removeProperty('transform');
    sheet.style.removeProperty('transition');
    requestAnimationFrame(()=>{
      backdrop.classList.add('is-open');
      sheet.classList.add('is-open');
      trigger.classList.add('is-open');
      trigger.setAttribute('aria-expanded','true');
      document.body.classList.add('reclaim-country-sheet-open');
      const selected=list.querySelector('.is-selected');
      selected?.scrollIntoView({block:'center'});
      closeButton.focus({preventScroll:true});
    });
  };

  trigger.addEventListener('click',openSheet);
  backdrop.addEventListener('click',closeSheet);
  closeButton.addEventListener('click',closeSheet);
  search.addEventListener('input',()=>renderOptions(search.value));
  select.addEventListener('change',syncTrigger);
  sheet.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();closeSheet()}});

  let dragStart=0;
  let dragDistance=0;
  handle.addEventListener('pointerdown',event=>{
    dragStart=event.clientY;
    dragDistance=0;
    handle.setPointerCapture?.(event.pointerId);
    sheet.style.transition='none';
  });
  handle.addEventListener('pointermove',event=>{
    if(!dragStart)return;
    dragDistance=Math.max(0,event.clientY-dragStart);
    sheet.style.transform=`translate(-50%, ${dragDistance}px)`;
  });
  const finishDrag=()=>{
    if(!dragStart)return;
    const shouldClose=dragDistance>72;
    dragStart=0;
    dragDistance=0;
    sheet.style.removeProperty('transition');
    sheet.style.removeProperty('transform');
    if(shouldClose)closeSheet();
  };
  handle.addEventListener('pointerup',finishDrag);
  handle.addEventListener('pointercancel',finishDrag);

  syncTrigger();
}

function applyUiPolish(){
  ensureStyles();
  const app=document.getElementById('app');
  if(app){
    markCompactFields(app);
    markAppearance(app);
    pruneSupabaseStatus(app);
    enhanceCountryPicker(app);
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