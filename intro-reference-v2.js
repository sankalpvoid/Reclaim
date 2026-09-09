(()=>{
  const STYLE_ID='reclaim-intro-v2-style';
  const VALID_STAGES=new Set(['auth','mood','app','path','setup','support']);

  function ensureStyles(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      .intro-reference.intro-v2{
        position:relative!important;
        min-height:100dvh!important;
        height:100dvh!important;
        display:block!important;
        padding:0!important;
        overflow:hidden!important;
        isolation:isolate;
        text-align:left!important;
        color:#fff!important;
        background:
          radial-gradient(circle at 72% 22%,rgba(102,55,180,.24),transparent 25%),
          radial-gradient(circle at 35% 46%,rgba(92,46,154,.12),transparent 35%),
          linear-gradient(180deg,#0b0618 0%,#090412 48%,#05020c 100%)!important;
      }
      html[data-theme="light"] .intro-reference.intro-v2,
      html[data-theme="dark"] .intro-reference.intro-v2{color:#fff!important;background:
          radial-gradient(circle at 72% 22%,rgba(102,55,180,.24),transparent 25%),
          radial-gradient(circle at 35% 46%,rgba(92,46,154,.12),transparent 35%),
          linear-gradient(180deg,#0b0618 0%,#090412 48%,#05020c 100%)!important}
      .intro-v2-inner{
        position:relative;
        width:100%;
        height:100%;
        min-height:100dvh;
        overflow:hidden;
        padding:max(28px,calc(env(safe-area-inset-top) + 18px)) 34px calc(26px + env(safe-area-inset-bottom));
      }
      .intro-v2-inner:before{
        content:"";
        position:absolute;
        inset:-18% -25% auto;
        height:62%;
        z-index:-1;
        pointer-events:none;
        background:radial-gradient(ellipse at 64% 42%,rgba(118,62,209,.20),transparent 55%);
        filter:blur(24px);
      }
      .intro-v2-header{
        position:relative;
        z-index:4;
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:18px;
      }
      .intro-v2-brand{
        margin:0;
        color:#fff;
        font-family:"Bebas Neue","Arial Narrow",sans-serif;
        font-size:clamp(52px,14.6vw,63px);
        font-weight:400;
        line-height:.88;
        letter-spacing:-1.8px;
        text-shadow:0 2px 22px rgba(255,255,255,.06);
      }
      .intro-v2-mantra{
        margin:7px 1px 0 0;
        color:#c0a7f0;
        font:600 clamp(10px,2.8vw,12px)/1.32 Inter,system-ui,sans-serif;
        letter-spacing:3.6px;
        text-align:center;
        text-transform:uppercase;
        white-space:nowrap;
      }
      .intro-v2-art{
        position:absolute;
        z-index:0;
        left:-7.5%;
        top:7.2%;
        width:116%;
        height:69%;
        pointer-events:none;
        filter:drop-shadow(0 20px 34px rgba(0,0,0,.35));
      }
      .intro-v2-art svg{width:100%;height:100%;overflow:visible}
      .intro-v2-copy{
        position:absolute;
        z-index:3;
        left:34px;
        right:24px;
        top:48.1%;
      }
      .intro-v2-namaste{
        display:block;
        margin:0 0 8px;
        color:#f0ad84;
        font:400 clamp(20px,5.8vw,25px)/1.05 Inter,system-ui,sans-serif;
        letter-spacing:-.35px;
      }
      .intro-v2-title{
        max-width:360px;
        margin:0;
        color:#fff;
        font-family:Didot,"Bodoni 72","Bodoni MT",Georgia,serif;
        font-size:clamp(68px,19.5vw,86px);
        font-weight:500;
        line-height:.78;
        letter-spacing:-4.4px;
        text-wrap:balance;
        text-shadow:0 4px 28px rgba(0,0,0,.38);
      }
      .intro-v2-title em{
        display:inline-block;
        margin-left:-7px;
        font-style:italic;
        font-weight:500;
        letter-spacing:-6px;
      }
      .intro-v2-bottom{
        position:absolute;
        z-index:5;
        left:34px;
        right:34px;
        bottom:calc(42px + env(safe-area-inset-bottom));
        text-align:center;
      }
      .intro-v2-subtitle{
        margin:0 0 20px;
        color:#f5f1fa;
        font:400 clamp(15px,4.25vw,18px)/1.3 Inter,system-ui,sans-serif;
        letter-spacing:-.25px;
        text-shadow:0 2px 18px rgba(0,0,0,.35);
      }
      .intro-reference.intro-v2 .intro-reference-cta{
        position:relative!important;
        inset:auto!important;
        left:auto!important;
        right:auto!important;
        bottom:auto!important;
        width:100%;
        height:58px!important;
        min-height:58px!important;
        display:flex;
        align-items:center;
        justify-content:center;
        gap:28px;
        border:0;
        border-radius:999px!important;
        color:#fff!important;
        background:linear-gradient(105deg,#612aff 0%,#7031ff 45%,#7a38ff 100%)!important;
        box-shadow:0 10px 34px rgba(90,35,255,.28),inset 0 1px rgba(255,255,255,.08);
        cursor:pointer;
        transform:none;
        -webkit-tap-highlight-color:transparent;
        transition:transform .14s ease,box-shadow .14s ease,filter .14s ease;
      }
      .intro-reference.intro-v2 .intro-reference-cta span{
        position:static!important;
        width:auto!important;
        height:auto!important;
        overflow:visible!important;
        clip:auto!important;
        clip-path:none!important;
        white-space:normal!important;
        color:#fff!important;
        font:700 clamp(17px,4.8vw,20px)/1 Inter,system-ui,sans-serif;
        letter-spacing:-.4px;
      }
      .intro-v2-arrow{
        display:inline-block;
        margin-top:-2px;
        color:#fff;
        font:300 38px/1 Inter,system-ui,sans-serif;
        transform:translateX(2px);
      }
      .intro-reference.intro-v2 .intro-reference-cta:hover{filter:brightness(1.06);box-shadow:0 13px 40px rgba(90,35,255,.38),inset 0 1px rgba(255,255,255,.1)}
      .intro-reference.intro-v2 .intro-reference-cta:active{transform:scale(.985)!important;filter:brightness(.96)}
      .intro-reference.intro-v2 .intro-reference-cta:focus-visible{outline:3px solid #fff!important;outline-offset:4px!important}
      .intro-v2-paths{
        margin:22px 0 0;
        color:#74698f;
        font:500 clamp(12px,3.5vw,14px)/1 Inter,system-ui,sans-serif;
        letter-spacing:.4px;
      }
      .intro-v2-paths i{padding:0 11px;color:#685c80;font-style:normal}
      @media(max-width:360px){
        .intro-v2-inner{padding-left:25px;padding-right:25px}
        .intro-v2-copy{left:25px;right:18px}
        .intro-v2-bottom{left:25px;right:25px}
        .intro-v2-title{font-size:clamp(61px,19.2vw,70px);letter-spacing:-3.6px}
        .intro-v2-title em{letter-spacing:-5px}
        .intro-v2-mantra{letter-spacing:2.8px}
      }
      @media(max-height:760px){
        .intro-v2-inner{padding-top:max(20px,calc(env(safe-area-inset-top) + 12px))}
        .intro-v2-brand{font-size:49px}
        .intro-v2-mantra{font-size:9px;margin-top:4px}
        .intro-v2-art{top:5%;height:67%}
        .intro-v2-copy{top:45.5%}
        .intro-v2-namaste{font-size:18px;margin-bottom:5px}
        .intro-v2-title{font-size:clamp(55px,17vw,68px);line-height:.8}
        .intro-v2-bottom{bottom:calc(20px + env(safe-area-inset-bottom))}
        .intro-v2-subtitle{font-size:14px;margin-bottom:12px}
        .intro-reference.intro-v2 .intro-reference-cta{height:52px!important;min-height:52px!important}
        .intro-v2-paths{margin-top:14px;font-size:11px}
      }
      @media(min-height:960px){
        .intro-v2-art{top:8%;height:70%}
        .intro-v2-copy{top:48.4%}
        .intro-v2-bottom{bottom:calc(52px + env(safe-area-inset-bottom))}
      }
      @media(prefers-reduced-motion:no-preference){
        .intro-v2-art{animation:introGlassDrift 7s ease-in-out infinite alternate}
        @keyframes introGlassDrift{from{transform:translate3d(0,0,0)}to{transform:translate3d(0,-5px,0)}}
      }
    `;
    document.head.appendChild(style);
  }

  function flower(){
    return `
      <svg viewBox="0 0 430 700" role="img" aria-label="A luminous purple and peach glass flower blooming upward">
        <defs>
          <linearGradient id="glassA" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#7250ff" stop-opacity=".28"/><stop offset=".28" stop-color="#ad69ff" stop-opacity=".74"/><stop offset=".58" stop-color="#ff95bf" stop-opacity=".60"/><stop offset="1" stop-color="#7a44ff" stop-opacity=".24"/>
          </linearGradient>
          <linearGradient id="glassB" x1=".15" y1="0" x2=".85" y2="1">
            <stop offset="0" stop-color="#b7a4ff" stop-opacity=".62"/><stop offset=".22" stop-color="#8d5dff" stop-opacity=".40"/><stop offset=".62" stop-color="#ff8eaa" stop-opacity=".62"/><stop offset="1" stop-color="#5426c8" stop-opacity=".30"/>
          </linearGradient>
          <linearGradient id="glassC" x1="0" y1=".25" x2="1" y2=".8">
            <stop offset="0" stop-color="#6b43ed" stop-opacity=".46"/><stop offset=".5" stop-color="#d687ff" stop-opacity=".68"/><stop offset="1" stop-color="#ff9a8f" stop-opacity=".42"/>
          </linearGradient>
          <linearGradient id="stemG" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="#34127e"/><stop offset=".22" stop-color="#6a3bd1"/><stop offset=".48" stop-color="#c173ff"/><stop offset=".67" stop-color="#6c3bd0"/><stop offset="1" stop-color="#21094f"/>
          </linearGradient>
          <radialGradient id="coreG"><stop offset="0" stop-color="#fff7c8"/><stop offset=".18" stop-color="#ffd29d"/><stop offset=".48" stop-color="#ff8f89"/><stop offset="1" stop-color="#c454dc" stop-opacity="0"/></radialGradient>
          <radialGradient id="budG"><stop offset="0" stop-color="#ffb19c"/><stop offset=".38" stop-color="#b771ff"/><stop offset="1" stop-color="#5124a9" stop-opacity=".2"/></radialGradient>
          <filter id="glassGlow" x="-70%" y="-70%" width="240%" height="240%">
            <feGaussianBlur stdDeviation="7" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="softGlow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="16"/></filter>
        </defs>

        <ellipse cx="261" cy="300" rx="115" ry="102" fill="#7b38ff" opacity=".19" filter="url(#softGlow)"/>
        <ellipse cx="263" cy="326" rx="90" ry="72" fill="#ff736f" opacity=".24" filter="url(#softGlow)"/>

        <g filter="url(#glassGlow)" stroke-linejoin="round">
          <path d="M259 342 C218 290 213 196 257 121 C296 177 329 262 293 340 C283 359 270 360 259 342Z" fill="url(#glassA)" stroke="#c7a9ff" stroke-opacity=".62" stroke-width="1.4"/>
          <path d="M282 348 C292 252 330 153 377 137 C407 205 385 297 319 354 C302 369 284 366 282 348Z" fill="url(#glassB)" stroke="#e7b5ff" stroke-opacity=".58" stroke-width="1.5"/>
          <path d="M248 351 C189 315 143 228 158 171 C212 176 253 243 267 323 C270 342 263 360 248 351Z" fill="url(#glassC)" stroke="#b99cff" stroke-opacity=".64" stroke-width="1.5"/>
          <path d="M302 363 C351 315 405 303 423 343 C409 402 359 423 306 398 C288 389 286 379 302 363Z" fill="url(#glassA)" stroke="#f0c1ff" stroke-opacity=".56" stroke-width="1.45"/>
          <path d="M233 367 C170 345 93 349 62 398 C113 446 198 434 264 394 C282 383 266 377 233 367Z" fill="url(#glassB)" stroke="#bda7ff" stroke-opacity=".62" stroke-width="1.5"/>
          <path d="M285 383 C233 366 151 394 119 461 C181 493 271 457 322 405 C337 390 317 390 285 383Z" fill="url(#glassC)" stroke="#d2b0ff" stroke-opacity=".67" stroke-width="1.6"/>
          <path d="M300 389 C350 361 395 372 406 410 C373 449 332 458 294 426 C278 413 280 401 300 389Z" fill="url(#glassB)" stroke="#ffc2de" stroke-opacity=".52" stroke-width="1.4"/>
        </g>

        <g fill="none" stroke-linecap="round" opacity=".76">
          <path d="M250 333 C240 272 247 208 264 159" stroke="#eee4ff" stroke-width="2.1"/>
          <path d="M291 339 C326 275 349 214 372 174" stroke="#ffd2ef" stroke-width="1.7"/>
          <path d="M238 344 C205 304 181 251 169 202" stroke="#baa1ff" stroke-width="1.6"/>
          <path d="M304 382 C351 363 382 348 409 348" stroke="#ffe0ed" stroke-width="1.5"/>
          <path d="M244 378 C185 387 125 406 88 418" stroke="#c9b5ff" stroke-width="1.55"/>
          <path d="M284 401 C224 421 175 449 146 462" stroke="#ffd1e0" stroke-width="1.6"/>
        </g>

        <ellipse cx="267" cy="349" rx="84" ry="80" fill="url(#coreG)" opacity=".63" filter="url(#glassGlow)"/>
        <g stroke-linecap="round" filter="url(#glassGlow)">
          <path d="M267 361 L231 294 M267 360 L243 281 M270 361 L255 274 M273 362 L269 269 M275 362 L282 276 M278 362 L297 286 M281 363 L309 301" stroke="#ffad93" stroke-width="4"/>
          <path d="M267 358 L235 301 M269 358 L249 290 M272 358 L264 282 M275 358 L280 289 M278 358 L296 299" stroke="#ffd6a7" stroke-width="1.8"/>
          <g fill="#ffe4b2"><circle cx="231" cy="294" r="4"/><circle cx="243" cy="281" r="4"/><circle cx="255" cy="274" r="4"/><circle cx="269" cy="269" r="4"/><circle cx="282" cy="276" r="4"/><circle cx="297" cy="286" r="4"/><circle cx="309" cy="301" r="4"/></g>
        </g>

        <g filter="url(#glassGlow)">
          <path d="M298 415 C313 477 330 530 306 585 C292 617 270 646 256 684 L319 684 C324 648 344 614 350 576 C362 505 337 449 318 407Z" fill="url(#stemG)" opacity=".87" stroke="#a779ff" stroke-opacity=".45" stroke-width="1.5"/>
          <path d="M313 463 C350 438 374 438 392 456 C372 482 345 490 321 478Z" fill="url(#glassA)" stroke="#cf9cff" stroke-opacity=".5"/>
          <path d="M318 548 C360 530 394 538 411 565 C378 590 347 587 319 570Z" fill="url(#glassB)" stroke="#d09fff" stroke-opacity=".5"/>
          <path d="M286 504 C254 486 221 488 199 509 C227 531 258 530 288 519Z" fill="url(#glassC)" stroke="#b98aff" stroke-opacity=".48"/>
        </g>

        <g filter="url(#glassGlow)">
          <ellipse cx="86" cy="152" rx="20" ry="45" transform="rotate(-34 86 152)" fill="url(#budG)" opacity=".78"/>
          <ellipse cx="392" cy="424" rx="18" ry="39" transform="rotate(38 392 424)" fill="url(#budG)" opacity=".72"/>
          <ellipse cx="122" cy="604" rx="17" ry="38" transform="rotate(-41 122 604)" fill="url(#budG)" opacity=".66"/>
          <ellipse cx="379" cy="612" rx="15" ry="34" transform="rotate(28 379 612)" fill="url(#budG)" opacity=".55"/>
          <ellipse cx="48" cy="444" rx="8" ry="17" transform="rotate(-43 48 444)" fill="url(#budG)" opacity=".72"/>
        </g>
      </svg>`;
  }

  function mount(){
    ensureStyles();
    const section=document.querySelector('.intro-reference');
    if(!section||section.dataset.introV2==='1')return;
    const oldButton=section.querySelector('.intro-reference-cta[data-stage]');
    const requested=oldButton?.dataset.stage||'auth';
    const nextStage=VALID_STAGES.has(requested)?requested:'auth';
    section.dataset.introV2='1';
    section.classList.add('intro-v2');
    section.setAttribute('aria-label','Reclaim. Make space for you. Namaste. Room to grow. A little change. A little more you.');
    section.innerHTML=`
      <div class="intro-v2-inner">
        <header class="intro-v2-header">
          <div class="intro-v2-brand">RECLAIM</div>
          <div class="intro-v2-mantra">MAKE SPACE<br>FOR YOU</div>
        </header>
        <div class="intro-v2-art" aria-hidden="true">${flower()}</div>
        <div class="intro-v2-copy">
          <span class="intro-v2-namaste">Namaste.</span>
          <h1 class="intro-v2-title">Room to<br><em>grow.</em></h1>
        </div>
        <div class="intro-v2-bottom">
          <p class="intro-v2-subtitle">A little change. A little more you.</p>
          <button class="intro-reference-cta" data-stage="${nextStage}" aria-label="Begin journey">
            <span>Begin journey</span><b class="intro-v2-arrow" aria-hidden="true">→</b>
          </button>
          <p class="intro-v2-paths">Quit <i>·</i> Reduce <i>·</i> Track</p>
        </div>
      </div>`;
  }

  const observer=new MutationObserver(()=>mount());
  observer.observe(document.documentElement,{childList:true,subtree:true});
  mount();
})();
