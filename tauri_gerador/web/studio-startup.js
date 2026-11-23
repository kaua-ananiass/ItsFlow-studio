/* A short brand entrance. Always releases the interface, including boot failures. */
(() => {
  const splash = document.getElementById('studioStartup');
  if (!splash) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const started = performance.now();
  const surfaces = [...document.querySelectorAll('.builder-shell, #loginOverlay')];
  const previous = surfaces.map(node => node.inert);
  surfaces.forEach(node => { node.inert = true; });
  let finished = false, timer, safety, entranceTimer;
  function reveal() {
    clearTimeout(entranceTimer);
    document.body.classList.remove('studio-interface-enter');
    // Restart only the entrance on authentication, never on ordinary updates.
    void document.body.offsetWidth;
    document.body.classList.add('studio-interface-enter');
    entranceTimer = setTimeout(() => document.body.classList.remove('studio-interface-enter'), reduced.matches ? 0 : 1200);
  }
  function finish() {
    if (finished) return;
    finished = true;
    clearTimeout(timer); clearTimeout(safety);
    window.removeEventListener('itsflow-startup-ready', ready);
    surfaces.forEach((node, index) => { node.inert = previous[index]; });
    const mark = splash.querySelector('.studio-startup-mark');
    const destination = document.body.classList.contains('is-authenticated') && document.querySelector('.workspace-tabs .itsflow-brand img');
    if (destination && !reduced.matches) {
      const from = mark.getBoundingClientRect(), to = destination.getBoundingClientRect();
      if (to.width && from.width) {
        splash.style.setProperty('--brand-x', `${to.x + to.width / 2 - from.x - from.width / 2}px`);
        splash.style.setProperty('--brand-y', `${to.y + to.height / 2 - from.y - from.height / 2}px`);
        splash.style.setProperty('--brand-scale', String(to.width / from.width));
        splash.classList.add('studio-startup-dock');
      }
    }
    splash.classList.add('studio-startup-leave');
    reveal();
    setTimeout(() => splash.remove(), reduced.matches ? 0 : 800);
  }
  function ready() {
    clearTimeout(timer);
    timer = setTimeout(finish, Math.max(0, (reduced.matches ? 0 : 1200) - (performance.now() - started)));
  }
  window.addEventListener('itsflow-startup-ready', ready);
  window.addEventListener('itsflow-interface-ready', () => { if (finished) reveal(); });
  // The intro must never block login, diagnostics or a slow/offline startup.
  safety = setTimeout(finish, reduced.matches ? 100 : 4500);
})();
