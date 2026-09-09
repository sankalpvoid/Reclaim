(()=>{
  const KEY='reclaim-theme-v1';
  const current=()=>localStorage.getItem(KEY)==='light'?'light':'dark';
  function apply(next){
    const theme=next==='light'?'light':'dark';
    localStorage.setItem(KEY,theme);
    document.documentElement.dataset.theme=theme;
    document.documentElement.style.colorScheme=theme;
    const meta=document.querySelector('meta[name="theme-color"]');
    if(meta)meta.content=theme==='light'?'#f8f6fc':'#000000';
    sync();
  }
  function ensure(){
    document.querySelectorAll('.home-screen [data-quick-theme],.tracking-home [data-quick-theme]').forEach(button=>button.remove());
    sync();
  }
  function sync(){
    const theme=current();
    document.querySelectorAll('[data-theme-choice]').forEach(button=>{
      const active=button.dataset.themeChoice===theme;
      button.classList.toggle('active',active);
      button.setAttribute('aria-pressed',String(active));
    });
  }
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-quick-theme]');
    if(!button)return;
    apply(current()==='light'?'dark':'light');
  });
  const observer=new MutationObserver(ensure);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  ensure();
  import('./intro-reference-v2.js?v=1').catch(error=>console.warn('Intro refresh:',error.message));
})();
