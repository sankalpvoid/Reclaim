(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mounted = new WeakMap();

  function mountHero(hero) {
    if (mounted.has(hero)) return;

    const darkArt = hero.querySelector('.runner-art-dark');
    if (!darkArt) return;

    // The inline light-mode image has proved fragile in preview builds. Reuse
    // the known-good runner PNG for both themes and let CSS recolour it.
    // Removing the unused image also guarantees it can never enter document
    // flow as a giant broken-image box and push the dashboard content away.
    hero.querySelectorAll('.runner-art-light, .runner-particles').forEach((node) => node.remove());
    darkArt.classList.add('runner-art-live');
    darkArt.addEventListener('error', () => {
      darkArt.hidden = true;
    }, { once: true });

    const canvas = document.createElement('canvas');
    canvas.className = 'live-hero-particles';
    canvas.setAttribute('aria-hidden', 'true');
    hero.appendChild(canvas);

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) {
      canvas.remove();
      return;
    }

    let width = 0;
    let height = 0;
    let last = performance.now();
    let spawnBudget = 0;
    let burstUntil = 0;
    let frame = 0;
    const particles = [];

    function resize() {
      const rect = hero.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, rect.width);
      // Keep the animated layer inside the artwork band. It must never size
      // itself from (or contribute to) the full page/dashboard height.
      height = Math.max(1, Math.min(196, rect.height));
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function isLight() {
      return document.documentElement.dataset.theme === 'light';
    }

    function spawn(boosted = false) {
      if (!width || !height) return;
      const light = isLight();

      const originX = width * (0.70 + Math.random() * 0.15);
      const originY = height * (0.20 + Math.random() * 0.46);
      const life = 1800 + Math.random() * 2500;
      const speed = (boosted ? 76 : 48) + Math.random() * (boosted ? 64 : 48);
      const size = (boosted ? 1.5 : 1.05) + Math.random() * (boosted ? 3.6 : 2.7);
      const palette = light
        ? [[101, 55, 235], [126, 83, 247], [72, 38, 157], [173, 142, 255]]
        : [[187, 163, 255], [126, 83, 247], [244, 239, 255], [107, 63, 246]];
      const color = palette[(Math.random() * palette.length) | 0];

      particles.push({
        x: originX,
        y: originY,
        vx: -speed,
        vy: -9 + Math.random() * 18,
        age: 0,
        life,
        size,
        color,
        phase: Math.random() * Math.PI * 2,
        wobble: 5 + Math.random() * 15,
        wobbleRate: 0.75 + Math.random() * 1.4,
        glow: Math.random() > 0.55,
        streak: Math.random() > 0.72,
      });
    }

    function drawParticle(p, progress) {
      const easedAlpha = Math.sin(Math.PI * progress);
      const alpha = easedAlpha * (p.glow ? 0.9 : 0.68);
      const [r, g, b] = p.color;
      const wave = Math.sin(p.phase + progress * Math.PI * 2 * p.wobbleRate) * p.wobble;
      const y = p.y + wave;
      const radius = Math.max(0.45, p.size * (1 - progress * 0.55));

      if (p.streak) {
        const tail = 9 + p.size * 5;
        const gradient = ctx.createLinearGradient(p.x, y, p.x + tail, y);
        gradient.addColorStop(0, `rgba(${r},${g},${b},${alpha})`);
        gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.beginPath();
        ctx.strokeStyle = gradient;
        ctx.lineWidth = Math.max(0.6, radius * 0.7);
        ctx.moveTo(p.x, y);
        ctx.lineTo(p.x + tail, y);
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
      ctx.shadowColor = `rgba(${r},${g},${b},${alpha})`;
      ctx.shadowBlur = p.glow ? 9 : 4;
      ctx.arc(p.x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    function render(now) {
      if (!canvas.isConnected) return;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      ctx.clearRect(0, 0, width, height);

      if (!reduceMotion.matches && document.visibilityState === 'visible') {
        const boosted = now < burstUntil;
        spawnBudget += dt * (boosted ? 70 : 34);
        while (spawnBudget >= 1 && particles.length < (boosted ? 125 : 92)) {
          spawn(boosted);
          spawnBudget -= 1;
        }

        for (let i = particles.length - 1; i >= 0; i -= 1) {
          const p = particles[i];
          p.age += dt * 1000;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          const progress = p.age / p.life;
          if (progress >= 1 || p.x < -28) {
            particles.splice(i, 1);
            continue;
          }
          drawParticle(p, progress);
        }
      } else {
        particles.length = 0;
      }

      ctx.shadowBlur = 0;
      frame = requestAnimationFrame(render);
    }

    function burst() {
      if (reduceMotion.matches) return;
      burstUntil = performance.now() + 950;
      for (let i = 0; i < 18; i += 1) spawn(true);
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(hero);
    hero.addEventListener('pointerdown', burst, { passive: true });
    resize();
    for (let i = 0; i < 28; i += 1) spawn(false);
    frame = requestAnimationFrame(render);

    mounted.set(hero, {
      destroy() {
        cancelAnimationFrame(frame);
        resizeObserver.disconnect();
        hero.removeEventListener('pointerdown', burst);
        canvas.remove();
      },
    });
  }

  function mountVisibleHeroes() {
    document.querySelectorAll('.home-screen .hero-runner').forEach(mountHero);
  }

  const app = document.querySelector('#app');
  if (!app) return;
  mountVisibleHeroes();
  new MutationObserver(() => requestAnimationFrame(mountVisibleHeroes)).observe(app, { childList: true });
})();
