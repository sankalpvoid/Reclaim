(()=>{
  const reduce=window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let cleanup=null;

  function stop(){
    if(cleanup){cleanup();cleanup=null}
    document.querySelectorAll('.reclaim-particle-field,.reclaim-hero-glow').forEach(el=>el.remove());
  }

  function start(){
    stop();
    if(reduce?.matches)return;
    if(document.documentElement.dataset.theme!=='light')return;

    const hero=document.querySelector('.home-screen .hero-runner');
    const art=hero?.querySelector('.runner-art-light');
    if(!hero||!art)return;

    hero.classList.add('particle-hero-live');
    const glow=document.createElement('span');
    glow.className='reclaim-hero-glow';
    glow.setAttribute('aria-hidden','true');
    const field=document.createElement('span');
    field.className='reclaim-particle-field';
    field.setAttribute('aria-hidden','true');
    hero.append(glow,field);

    let alive=true;
    const timers=new Set();

    function spawn(){
      if(!alive||document.documentElement.dataset.theme!=='light'||!document.body.contains(hero))return;
      const p=document.createElement('i');
      p.className='reclaim-particle';
      const size=(1.2+Math.random()*2.8).toFixed(2);
      const y=(23+Math.random()*43).toFixed(2);
      const x=(69+Math.random()*17).toFixed(2);
      const drift=(62+Math.random()*92).toFixed(0);
      const rise=(-20+Math.random()*42).toFixed(0);
      const duration=(2600+Math.random()*2600).toFixed(0);
      const delay=(Math.random()*120).toFixed(0);
      p.style.cssText=`--p-size:${size}px;--p-x:${x}%;--p-y:${y}%;--p-drift:${drift}px;--p-rise:${rise}px;--p-duration:${duration}ms;--p-delay:${delay}ms;--p-alpha:${(.38+Math.random()*.48).toFixed(2)}`;
      field.appendChild(p);
      const t=setTimeout(()=>{p.remove();timers.delete(t)},Number(duration)+Number(delay)+180);
      timers.add(t);
    }

    const interval=setInterval(()=>{
      const count=2+(Math.random()>.56?1:0);
      for(let i=0;i<count;i++)spawn();
    },190);

    for(let i=0;i<18;i++)setTimeout(spawn,i*65);

    cleanup=()=>{
      alive=false;
      clearInterval(interval);
      timers.forEach(clearTimeout);
      timers.clear();
      hero.classList.remove('particle-hero-live');
      field.remove();glow.remove();
    };
  }

  const observer=new MutationObserver(()=>requestAnimationFrame(start));
  observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['data-theme']});
  reduce?.addEventListener?.('change',start);
  window.addEventListener('pagehide',stop,{once:true});
  start();
})();
