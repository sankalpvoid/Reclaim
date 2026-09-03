const STYLE_ID='reclaim-ui-polish-v1';

function installStyles(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
    /* Final pre-Smoke-Less UI polish. Additive overrides only. */

    /* Profile/setup values are short data points, not long text fields. Give them the same
       compact label/value hierarchy as the quit-date control. */
    #setup-form label.ui-compact-number{
      display:grid!important;
      gap:5px!important;
      padding:11px 14px 10px!important;
      min-height:64px!important;
      border:1px solid #302b38!important;
      border-radius:16px!important;
      background:linear-gradient(145deg,#171719,#101012)!important;
      color:#9d7cff!important;
      font-size:8px!important;
      font-weight:700!important;
      letter-spacing:1px!important;
      line-height:1.1!important;
      text-transform:uppercase!important;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.025)!important;
    }
    #setup-form label.ui-compact-number>input[type="number"]{
      width:100%!important;
      height:32px!important;
      min-height:0!important;
      margin:0!important;
      padding:0!important;
      border:0!important;
      border-radius:0!important;
      outline:0!important;
      background:transparent!important;
      box-shadow:none!important;
      color:#fff!important;
      font:700 22px/1.15 Inter,system-ui,sans-serif!important;
      letter-spacing:-.35px!important;
      text-transform:none!important;
      appearance:textfield;
    }
    #setup-form label.ui-compact-number>input[type="number"]::-webkit-inner-spin-button,
    #setup-form label.ui-compact-number>input[type="number"]::-webkit-outer-spin-button{margin:0}
    #setup-form label.ui-compact-number:focus-within{
      border-color:#7652dd!important;
      box-shadow:0 0 0 2px rgba(108,60,255,.10)!important;
    }
    html[data-theme="light"] #setup-form label.ui-compact-number{
      background:#fff!important;
      border-color:#ddd7e5!important;
      color:#6944ce!important;
      box-shadow:0 7px 18px rgba(42,24,77,.035)!important;
    }
    html[data-theme="light"] #setup-form label.ui-compact-number>input[type="number"]{color:#241b34!important}

    /* Appearance is a secondary setting; keep it legible without giving it hero-card height. */
    .more-screen .appearance-card{
      padding:13px 14px!important;
      border-radius:16px!important;
      display:grid!important;
      gap:10px!important;
      min-height:0!important;
    }
    .more-screen .appearance-copy{
      display:flex!important;
      align-items:center!important;
      gap:10px!important;
      min-height:0!important;
    }
    .more-screen .appearance-icon{
      width:38px!important;
      height:38px!important;
      min-width:38px!important;
      border-radius:12px!important;
      display:grid!important;
      place-items:center!important;
    }
    .more-screen .appearance-copy strong{font-size:13px!important;line-height:1.15!important}
    .more-screen .appearance-copy small{
      display:block!important;
      margin-top:2px!important;
      font-size:9px!important;
      line-height:1.25!important;
    }
    .more-screen .theme-toggle{
      min-height:0!important;
      height:42px!important;
      padding:3px!important;
      margin:0!important;
      border-radius:12px!important;
    }
    .more-screen .theme-toggle button{
      min-height:34px!important;
      height:34px!important;
      padding:0 10px!important;
      border-radius:9px!important;
      gap:6px!important;
      font-size:10px!important;
    }
    .more-screen .theme-toggle button .app-icon,
    .more-screen .theme-toggle button .material-symbols-rounded{font-size:17px!important}

    /* Put the illustration beside the smoke-free statement instead of letting it float above it. */
    .home-screen .hero{
      position:relative!important;
      overflow:hidden!important;
    }
    .home-screen .hero-content{
      position:relative!important;
      z-index:2!important;
    }
    .home-screen .hero-art{
      position:absolute!important;
      z-index:1!important;
      object-fit:contain!important;
      object-position:center bottom!important;
      max-width:none!important;
      margin:0!important;
      transform:none!important;
      pointer-events:none!important;
    }
    .home-screen .hero-art-dark{
      width:190px!important;
      height:205px!important;
      right:-7px!important;
      top:116px!important;
      bottom:auto!important;
    }
    .home-screen .hero-art-light{
      width:200px!important;
      height:190px!important;
      right:-5px!important;
      top:126px!important;
      bottom:auto!important;
    }
    @media(max-width:360px){
      .home-screen .hero-art-dark{width:174px!important;right:-13px!important}
      .home-screen .hero-art-light{width:184px!important;right:-12px!important}
    }
  `;
  document.head.appendChild(style);
}

function removeCloudAccountCard(root=document){
  root.querySelectorAll?.('.more-screen .card .eyebrow').forEach(eyebrow=>{
    if((eyebrow.textContent||'').trim().toLowerCase()!=='cloud account')return;
    eyebrow.closest('.card')?.remove();
  });
}

function compactSetupFields(root=document){
  root.querySelectorAll?.('#setup-form label').forEach(label=>{
    if(label.querySelector(':scope > input[type="number"]'))label.classList.add('ui-compact-number');
  });
}

let queued=false;
function polish(){
  if(queued)return;
  queued=true;
  queueMicrotask(()=>{
    queued=false;
    removeCloudAccountCard();
    compactSetupFields();
  });
}

installStyles();
polish();
const app=document.getElementById('app');
if(app)new MutationObserver(polish).observe(app,{childList:true,subtree:true});
window.addEventListener('reclaim:reload-restored',polish);
