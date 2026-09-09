(()=>{
  const STYLE_ID='reclaim-intro-exact-style';
  const VALID_STAGES=new Set(['auth','mood','app','path','setup','support']);

  function ensureStyles(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      .intro-reference.intro-exact{
        position:relative!important;
        display:block!important;
        width:100%!important;
        min-height:100dvh!important;
        height:100dvh!important;
        padding:0!important;
        overflow:hidden!important;
        isolation:isolate;
        background:#07020f!important;
      }
      html[data-theme="light"] .intro-reference.intro-exact,
      html[data-theme="dark"] .intro-reference.intro-exact{
        background:#07020f!important;
      }
      .intro-exact-image{
        position:absolute;
        z-index:0;
        inset:0;
        width:100%;
        height:100%;
        display:block;
        object-fit:fill;
        object-position:center;
        user-select:none;
        pointer-events:none;
        -webkit-user-drag:none;
      }
      .intro-reference.intro-exact .intro-reference-cta{
        position:absolute!important;
        z-index:2;
        left:8.09%!important;
        right:8.21%!important;
        top:84.11%!important;
        bottom:auto!important;
        width:auto!important;
        height:6.02%!important;
        min-height:48px!important;
        margin:0!important;
        padding:0!important;
        border:0!important;
        border-radius:999px!important;
        background:transparent!important;
        color:transparent!important;
        box-shadow:none!important;
        cursor:pointer;
        -webkit-tap-highlight-color:transparent;
      }
      .intro-reference.intro-exact .intro-reference-cta span{
        position:absolute!important;
        width:1px!important;
        height:1px!important;
        overflow:hidden!important;
        clip:rect(0 0 0 0)!important;
        clip-path:inset(50%)!important;
        white-space:nowrap!important;
      }
      .intro-reference.intro-exact .intro-reference-cta:focus-visible{
        outline:3px solid rgba(255,255,255,.95)!important;
        outline-offset:4px!important;
        background:rgba(255,255,255,.05)!important;
      }
      .intro-reference.intro-exact .intro-reference-cta:active{
        transform:scale(.985)!important;
        background:rgba(255,255,255,.04)!important;
      }
      @media(min-width:700px){
        .intro-reference.intro-exact{
          min-height:calc(100dvh - 40px)!important;
          height:calc(100dvh - 40px)!important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function mount(){
    ensureStyles();
    const section=document.querySelector('.intro-reference');
    if(!section||section.dataset.introExact==='1')return;

    // Keep the original app-rendered button node so app.js's bound click
    // handler survives the visual replacement. Recreating the button with
    // innerHTML was why Begin journey looked tappable but did nothing.
    const oldButton=section.querySelector('.intro-reference-cta[data-stage]');
    const requested=oldButton?.dataset.stage||'auth';
    const nextStage=VALID_STAGES.has(requested)?requested:'auth';

    section.dataset.introExact='1';
    section.classList.remove('intro-v2');
    section.classList.add('intro-exact');
    section.setAttribute('aria-label','Reclaim. Make space for you. Namaste. Room to grow. A little change. A little more you.');

    section.replaceChildren();
    const image=document.createElement('img');
    image.className='intro-exact-image';
    image.src='assets/begin-journey-reference.png';
    image.alt='';
    image.setAttribute('aria-hidden','true');
    image.decoding='async';
    image.fetchPriority='high';
    section.appendChild(image);

    const button=oldButton||document.createElement('button');
    button.className='intro-reference-cta';
    button.dataset.stage=nextStage;
    button.setAttribute('aria-label','Begin journey');
    button.innerHTML='<span>Begin journey</span>';
    section.appendChild(button);
  }

  const observer=new MutationObserver(mount);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  mount();
})();
