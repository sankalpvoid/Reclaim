(() => {
  const STORAGE='reclaim-state-v2', SESSION='reclaim-session-v1';
  function read(key){try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}}
  function firstName(){
    const state=read(STORAGE)||{}, session=read(SESSION)||{}, meta=session?.user?.user_metadata||{};
    const raw=state?.profile?.name||meta.full_name||meta.name||meta.display_name||'';
    return String(raw).trim().split(/\s+/)[0]||'';
  }
  function greeting(){const h=new Date().getHours();return h<12?'GOOD MORNING':h<17?'GOOD AFTERNOON':'GOOD EVENING'}
  function addMoodName(name){
    const h1=[...document.querySelectorAll('.screen h1')].find(el=>el.textContent.replace(/\s+/g,' ').trim()==='HOW ARE YOU TODAY?');
    if(!h1)return;
    const p=h1.nextElementSibling;
    if(p?.classList.contains('muted')){
      const wanted=`${name}, your journey matters.`;
      if(!p.textContent.includes(wanted))p.innerHTML=`${wanted}<br>Let's keep going.`;
    }
  }
  function addHomeName(name){
    const hero=document.querySelector('.home-screen .home-hero-copy'); if(!hero)return;
    let el=hero.querySelector('.name-greeting');
    if(!el){el=document.createElement('div');el.className='name-greeting';hero.prepend(el)}
    el.textContent=`${greeting()}, ${name.toUpperCase()}.`;
  }
  function addSupportName(name){
    const screen=document.querySelector('.struggling-support'); if(!screen)return;
    const heading=[...screen.querySelectorAll('h1,h2,h3,strong')].find(el=>/TODAY\s+FEELS\s+HARD/i.test(el.textContent.replace(/\s+/g,' ')));
    if(heading){const wanted=`TODAY FEELS HARD, ${name.toUpperCase()}.`;if(heading.textContent.trim()!==wanted)heading.textContent=wanted}
  }
  function personalize(){const name=firstName();if(!name)return;addMoodName(name);addHomeName(name);addSupportName(name)}
  function schedule(){requestAnimationFrame(()=>requestAnimationFrame(personalize));setTimeout(personalize,250);setTimeout(personalize,800)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
  document.addEventListener('click',schedule,{passive:true});
  document.addEventListener('submit',schedule,{passive:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule()});
  setInterval(personalize,750);
})();
