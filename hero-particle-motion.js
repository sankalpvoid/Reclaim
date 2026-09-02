(() => {
  const decorateHero = () => {
    document
      .querySelectorAll('.hero-runner .runner-art:not(.runner-particles)')
      .forEach((artwork) => {
        if (artwork.dataset.particleMotionReady === 'true') return;

        artwork.dataset.particleMotionReady = 'true';
        const fragment = document.createDocumentFragment();

        ['near', 'far'].forEach((distance) => {
          const particles = artwork.cloneNode(false);
          particles.removeAttribute('alt');
          particles.setAttribute('aria-hidden', 'true');
          particles.removeAttribute('data-particle-motion-ready');
          particles.classList.add('runner-particles', `runner-particles-${distance}`);
          fragment.appendChild(particles);
        });

        artwork.after(fragment);
      });
  };

  const app = document.querySelector('#app');
  if (!app) return;

  decorateHero();
  new MutationObserver(decorateHero).observe(app, { childList: true, subtree: true });
})();
