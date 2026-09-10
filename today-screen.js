// Presentation only. app.js and smoking-journey-ui.js own state and event binding.
export function todayHero(icon){
  return `<div class="today-welcome"><img src="assets/living-petal.webp" alt="" aria-hidden="true" fetchpriority="high"><div><p class="today-kicker">AT YOUR PACE</p><h2>One small<br>shift.</h2><p>What would help right now?</p></div></div><button class="primary today-support" data-view="craving">${icon('support')}<span>Get craving support</span>${icon('arrow_forward')}</button>`;
}
export function todayNextStep(icon){
  return `<article class="today-next-step"><img src="assets/activity-stretch.webp" alt="" aria-hidden="true" loading="lazy"><div><p class="today-kicker">YOUR NEXT SMALL STEP</p><h2>A 5-minute<br>movement break.</h2><p>A short walk, at your pace.</p><button class="secondary" data-tool="walk">Take a walk ${icon('arrow_forward')}</button></div></article>`;
}
