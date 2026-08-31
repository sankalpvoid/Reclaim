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
    const screen=document.querySelector('.screen.full'); if(!screen)return;
    const h1=[...screen.querySelectorAll('h1')].find(el=>el.textContent.replace(/\s+/g,' ').trim()==='HOW ARE YOU TODAY?');
    if(!h1)return;
    const p=h1.nextElementSibling;
    if(p?.classList.contains('muted')&&!p.dataset.named){p.dataset.named='1';p.innerHTML=`${name}, your journey matters.<br>Let's keep going.`}
  }
  function addHomeName(name){
    const screen=document.querySelector('.home-screen'); if(!screen)return;
    const hero=screen.querySelector('.home-hero-copy'); if(!hero||hero.querySelector('.name-greeting'))return;
    const el=document.createElement('div'); el.className='name-greeting'; el.textContent=`${greeting()}, ${name.toUpperCase()}.`; hero.prepend(el);
  }
  function addSupportName(name){
    const screen=document.querySelector('.struggling-support'); if(!screen)return;
    const heading=[...screen.querySelectorAll('h1,h2')].find(el=>/TODAY FEELS HARD/i.test(el.textContent));
    if(heading&&!heading.dataset.named){heading.dataset.named='1';heading.textContent=`TODAY FEELS HARD, ${name.toUpperCase()}.`}
  }
  function personalize(){const name=firstName();if(!name)return;addMoodName(name);addHomeName(name);addSupportName(name)}
  function schedule(){requestAnimationFrame(()=>requestAnimationFrame(personalize));setTimeout(personalize,500);setTimeout(personalize,1400)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
  document.addEventListener('click',schedule,{passive:true});
  document.addEventListener('submit',schedule,{passive:true});
})();
