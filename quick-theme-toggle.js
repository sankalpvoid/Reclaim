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
  function markup(){
    const theme=current();
    return `<button class="quick-theme-toggle ${theme}" type="button" data-quick-theme aria-label="Switch to ${theme==='light'?'dark':'light'} mode" aria-pressed="${theme==='dark'}"><span class="quick-sky" aria-hidden="true"><i class="quick-sun"></i><i class="quick-cloud c1"></i><i class="quick-cloud c2"></i><i class="quick-stars">· ·</i><i class="quick-moon"></i></span></button>`;
  }
  function ensure(){
    const home=document.querySelector('.home-screen,.tracking-home');
    const top=home?.querySelector('.topbar');
    if(top&&!top.querySelector('[data-quick-theme]')){
      const signal=top.querySelector('.checkin-trigger');
      if(signal)signal.insertAdjacentHTML('beforebegin',markup());
    }
    sync();
  }
  function sync(){
    const theme=current();
    document.querySelectorAll('[data-quick-theme]').forEach(button=>{
      button.classList.toggle('light',theme==='light');
      button.classList.toggle('dark',theme==='dark');
      button.setAttribute('aria-label',`Switch to ${theme==='light'?'dark':'light'} mode`);
      button.setAttribute('aria-pressed',String(theme==='dark'));
    });
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
})();
