(()=>{
  const reduce=window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let cleanup=null;
  let currentHero=null;

  function stop(){
    if(cleanup){cleanup();cleanup=null}
    currentHero=null;
    document.querySelectorAll('.reclaim-particle-field,.reclaim-hero-glow').forEach(el=>el.remove());
  }

  function start(){
    if(reduce?.matches||document.documentElement.dataset.theme!=='light'){
      stop();
      return;
    }

    const hero=document.querySelector('.home-screen .hero-runner');
    const art=hero?.querySelector('.runner-art-light');
    if(!hero||!art){
      stop();
      return;
    }

    if(currentHero===hero&&hero.querySelector('.reclaim-particle-field'))return;
    stop();
    currentHero=hero;
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
      const size=(1.6+Math.random()*3.2).toFixed(2);
      const y=(20+Math.random()*48).toFixed(2);
      const x=(68+Math.random()*19).toFixed(2);
      const drift=(76+Math.random()*120).toFixed(0);
      const rise=(-26+Math.random()*52).toFixed(0);
      const duration=(2400+Math.random()*2500).toFixed(0);
      const delay=(Math.random()*100).toFixed(0);
      p.style.cssText=`--p-size:${size}px;--p-x:${x}%;--p-y:${y}%;--p-drift:${drift}px;--p-rise:${rise}px;--p-duration:${duration}ms;--p-delay:${delay}ms;--p-alpha:${(.52+Math.random()*.42).toFixed(2)}`;
      field.appendChild(p);
      const t=setTimeout(()=>{p.remove();timers.delete(t)},Number(duration)+Number(delay)+180);
      timers.add(t);
    }

    const interval=setInterval(()=>{
      const count=3+(Math.random()>.5?1:0);
      for(let i=0;i<count;i++)spawn();
    },170);

    for(let i=0;i<26;i++)setTimeout(spawn,i*55);

    cleanup=()=>{
      alive=false;
      clearInterval(interval);
      timers.forEach(clearTimeout);
      timers.clear();
      hero.classList.remove('particle-hero-live');
      field.remove();
      glow.remove();
    };
  }

  const app=document.querySelector('#app');
  const appObserver=new MutationObserver(()=>requestAnimationFrame(start));
  if(app)appObserver.observe(app,{childList:true});

  const themeObserver=new MutationObserver(()=>requestAnimationFrame(start));
  themeObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});

  reduce?.addEventListener?.('change',start);
  window.addEventListener('pagehide',stop,{once:true});
  requestAnimationFrame(start);
})();
