/opt/homebrew/Library/Homebrew/cmd/shellenv.sh: line 18: /bin/ps: Operation not permitted
(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const mountHero = (hero) => {
    if (hero.dataset.liveHeroReady === 'true') return;
    hero.dataset.liveHeroReady = 'true';

    const darkArt = hero.querySelector('.runner-art-dark');
    const lightArt = hero.querySelector('.runner-art-light');
    if (!darkArt || !lightArt) return;

    darkArt.src = 'assets/runner-live-v2.png';
    lightArt.src = 'assets/meditation-live-v2.png';
    hero.querySelectorAll('.runner-particles').forEach((layer) => layer.remove());

    const canvas = document.createElement('canvas');
    canvas.className = 'live-hero-particles';
    canvas.setAttribute('aria-hidden', 'true');
    hero.appendChild(canvas);

    const context = canvas.getContext('2d', { alpha: true });
    const particles = [];
    let width = 0;
    let height = 0;
    let lastTime = performance.now();
    let spawnBudget = 0;
    let boostUntil = 0;

    const resize = () => {
      const rect = hero.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.round(width * ratio));
      canvas.height = Math.max(1, Math.round(height * ratio));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const createParticle = (lightMode, boosted) => {
      const originX = width - 58 - Math.random() * 66;
      const originY = 42 + Math.random() * Math.min(102, height * .42);
      const life = 1100 + Math.random() * 1700;
      const violet = lightMode ? [83, 48, 181] : [177, 154, 255];
      const white = lightMode ? [110, 79, 194] : [245, 242, 255];
      particles.push({
        x: originX, y: originY,
        vx: -(24 + Math.random() * (boosted ? 62 : 38)),
        vy: -10 + Math.random() * 20,
        wave: Math.random() * Math.PI * 2,
        waveSpeed: .9 + Math.random() * 1.5,
        waveSize: 4 + Math.random() * 10,
        size: .7 + Math.random() * (boosted ? 2.4 : 1.7),
        age: 0, life,
        color: Math.random() > .38 ? violet : white,
        sparkle: Math.random() > .82,
      });
    };

    const render = (now) => {
      if (!canvas.isConnected) return;
      const elapsed = Math.min((now - lastTime) / 1000, .05);
      lastTime = now;
      context.clearRect(0, 0, width, height);

      if (!reduceMotion.matches && document.visibilityState === 'visible') {
        const lightMode = document.documentElement.dataset.theme === 'light';
        const boosted = now < boostUntil;
        spawnBudget += elapsed * (boosted ? 52 : 22);
        while (spawnBudget >= 1 && particles.length < 74) {
          createParticle(lightMode, boosted);
          spawnBudget -= 1;
        }

        for (let index = particles.length - 1; index >= 0; index -= 1) {
          const particle = particles[index];
          particle.age += elapsed * 1000;
          if (particle.age >= particle.life || particle.x < -12) {
            particles.splice(index, 1);
            continue;
          }

          const progress = particle.age / particle.life;
          particle.x += particle.vx * elapsed;
          particle.y += particle.vy * elapsed;
          const waveY = Math.sin(particle.wave + progress * particle.waveSpeed * Math.PI * 2) * particle.waveSize;
          const alpha = Math.sin(Math.PI * progress) * (particle.sparkle ? .92 : .62);
          const [red, green, blue] = particle.color;

          context.beginPath();
          context.fillStyle = `rgba(${red},${green},${blue},${alpha})`;
          context.shadowColor = `rgba(${red},${green},${blue},${alpha})`;
          context.shadowBlur = particle.sparkle ? 9 : 4;
          context.arc(particle.x, particle.y + waveY, particle.size * (1 - progress * .42), 0, Math.PI * 2);
          context.fill();

          if (particle.sparkle) {
            context.beginPath();
            context.strokeStyle = `rgba(${red},${green},${blue},${alpha * .48})`;
            context.lineWidth = .65;
            context.moveTo(particle.x - particle.size * 2.7, particle.y + waveY);
            context.lineTo(particle.x + particle.size * 2.7, particle.y + waveY);
            context.stroke();
          }
        }
      } else {
        particles.length = 0;
      }

      context.shadowBlur = 0;
      requestAnimationFrame(render);
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(hero);
    hero.addEventListener('pointerdown', () => { boostUntil = performance.now() + 1200; });
    resize();
    requestAnimationFrame(render);
  };

  const mountVisibleHeroes = () => document.querySelectorAll('.hero-runner').forEach(mountHero);
  const app = document.querySelector('#app');
  if (!app) return;
  mountVisibleHeroes();
  new MutationObserver(mountVisibleHeroes).observe(app, { childList: true, subtree: true });
})();
