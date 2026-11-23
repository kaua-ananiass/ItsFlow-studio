// Animate only a real tab change. Map/video geometry stays fixed throughout.
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const running = new Set();
let frame = 0;

function cancel() {
  cancelAnimationFrame(frame);
  frame = 0;
  for (const animation of running) animation.cancel();
  running.clear();
}
motion.addEventListener('change', () => { if (motion.matches) cancel(); });

export function revealWorkspace(panel, tab) {
  cancel();
  if (!panel || motion.matches || typeof panel.animate !== 'function') return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    if (!panel.isConnected || !panel.classList.contains('is-active')) return;
    function play(element, frames, options, id) {
      const animation = element.animate(frames, options);
      animation.id = id;
      running.add(animation);
      animation.finished.then(() => running.delete(animation), () => running.delete(animation));
    }
    play(panel, [{opacity: .25}, {opacity: 1}], {duration: 240, easing: 'ease-out'}, 'workspace-fade');
    // Never translate the map or native video surfaces: their coordinates are
    // also used by fitting, capture and pointer input.
    const selector = tab === 'integrations'
      ? '.fdchat-sidebar, .fdchat-header, .itsflow-universal-welcome, .fdchat-composer:not([data-processing="true"])'
      : tab === 'commands' || tab === 'agent-screen'
        ? ':scope > section > header'
        : ':scope > section > :is(header, section, .launcher-top-zone)';
    const targets = [...panel.querySelectorAll(selector)].filter(element => {
      const style = getComputedStyle(element);
      return element.getClientRects().length && style.visibility !== 'hidden' && style.opacity !== '0';
    }).slice(0, 6);
    targets.forEach((element, index) => {
      if (targets.some(parent => parent !== element && parent.contains(element))) return;
      play(element, [{opacity: 0, transform: 'translateY(7px)'}, {opacity: 1, transform: 'translateY(0)'}],
        {duration: 310, delay: index * 28, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards'}, 'workspace-reveal');
    });
  });
}
