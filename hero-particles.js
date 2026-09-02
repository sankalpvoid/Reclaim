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

    const hero=document.querySelector('.hero-runner');
    if(!hero)return;

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
      const size=(2+Math.random()*4).toFixed(2);
      const y=(18+Math.random()*50).toFixed(2);
      const x=(62+Math.random()*26).toFixed(2);
      const drift=(90+Math.random()*125).toFixed(0);
      const rise=(-28+Math.random()*56).toFixed(0);
      const duration=(2400+Math.random()*2200).toFixed(0);
      const delay=(Math.random()*100).toFixed(0);
      p.style.cssText=`--p-size:${size}px;--p-x:${x}%;--p-y:${y}%;--p-drift:${drift}px;--p-rise:${rise}px;--p-duration:${duration}ms;--p-delay:${delay}ms;--p-alpha:${(.55+Math.random()*.4).toFixed(2)}`;
      field.appendChild(p);
      const t=setTimeout(()=>{p.remove();timers.delete(t)},Number(duration)+Number(delay)+220);
      timers.add(t);
    }

    const interval=setInterval(()=>{
      const count=3+(Math.random()>.45?2:1);
      for(let i=0;i<count;i++)spawn();
    },150);

    for(let i=0;i<30;i++)setTimeout(spawn,i*45);

    cleanup=()=>{
      alive=false;
      clearInterval(interval);
      timers.forEach(clearTimeout);
      timers.clear();
      hero.classList.remove('particle-hero-live');
      field.remove();glow.remove();
    };
  }

  const app=document.querySelector('#app');
  const observer=new MutationObserver(()=>requestAnimationFrame(start));
  if(app)observer.observe(app,{childList:true});
  const themeObserver=new MutationObserver(()=>requestAnimationFrame(start));
  themeObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
  reduce?.addEventListener?.('change',start);
  window.addEventListener('pagehide',stop,{once:true});
  start();
})();
