(()=>{
  const app=document.getElementById('app');
  if(app)app.removeAttribute('aria-live');

  let dialogReturnFocus=null;

  function rememberFocus(){
    dialogReturnFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
  }
  function restoreFocus(){
    queueMicrotask(()=>dialogReturnFocus?.isConnected&&dialogReturnFocus.focus({preventScroll:true}));
  }

  function enhance(root=document){
    root.querySelectorAll?.('.toast').forEach(toast=>{
      toast.setAttribute('role','status');
      toast.setAttribute('aria-live','polite');
      toast.setAttribute('aria-atomic','true');
    });

    root.querySelectorAll?.('.modal-body:not([data-a11y-dialog])').forEach(dialog=>{
      dialog.dataset.a11yDialog='';
      dialog.setAttribute('role','dialog');
      dialog.setAttribute('aria-modal','true');
      const close=dialog.querySelector('[data-close]');
      if(close&&!close.getAttribute('aria-label'))close.setAttribute('aria-label','Close dialog');
      rememberFocus();
      queueMicrotask(()=>{
        const preferred=dialog.querySelector('input:not([type="hidden"]),textarea,select,button');
        preferred?.focus?.({preventScroll:true});
      });
    });

    root.querySelectorAll?.('.reclaim-time-card:not([data-a11y-dialog])').forEach(dialog=>{
      dialog.dataset.a11yDialog='';
      rememberFocus();
      queueMicrotask(()=>dialog.querySelector('.reclaim-time-close')?.focus?.({preventScroll:true}));
    });

    root.querySelectorAll?.('.side-menu:not([data-a11y-dialog])').forEach(menu=>{
      menu.dataset.a11yDialog='';
      menu.setAttribute('role','dialog');
      menu.setAttribute('aria-modal','true');
      menu.setAttribute('aria-label','Navigation menu');
      rememberFocus();
      queueMicrotask(()=>menu.querySelector('[data-menu-close]')?.focus?.({preventScroll:true}));
    });
  }

  document.addEventListener('keydown',event=>{
    if(event.key!=='Escape')return;
    const timeModal=document.querySelector('.reclaim-time-modal');
    if(timeModal){
      const close=timeModal.querySelector('.reclaim-time-close');
      if(close){event.preventDefault();close.click();restoreFocus();}
      return;
    }
    const modal=document.querySelector('.modal');
    if(modal){
      const close=modal.querySelector('[data-close]');
      if(close){event.preventDefault();close.click();restoreFocus();}
      return;
    }
    const menu=document.querySelector('.menu-overlay');
    const close=menu?.querySelector('[data-menu-close]');
    if(close){event.preventDefault();close.click();restoreFocus();}
  });

  enhance();
  const observer=new MutationObserver(records=>{
    for(const record of records){
      for(const node of record.addedNodes){
        if(node instanceof Element)enhance(node.matches('.toast,.modal-body,.reclaim-time-card,.side-menu')?node.parentElement||node:node);
      }
    }
  });
  if(document.body)observer.observe(document.body,{childList:true,subtree:true});
})();
