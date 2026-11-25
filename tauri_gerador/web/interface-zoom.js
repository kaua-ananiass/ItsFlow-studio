// Page zoom is independent from the command map's own canvas zoom.
export function initInterfaceZoom({ isCapturing = () => false } = {}) {
  const storageKey = 'itsflow.interfaceZoom';
  const levels = [0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];
  let scale = 1;
  let pending = Promise.resolve();
  try {
    const saved = Number(localStorage.getItem(storageKey));
    if (levels.includes(saved)) scale = saved;
  } catch { /* Zoom still works when storage is unavailable. */ }

  function apply(next) {
    pending = pending.then(async () => {
      const webview = window.__TAURI__?.webview?.getCurrentWebview?.();
      if (webview) {
        await webview.setZoom(next);
      } else if (!window.__TAURI__) {
        document.documentElement.style.zoom = String(next);
      } else {
        throw new Error('API de zoom do Studio indisponível.');
      }
      try { localStorage.setItem(storageKey, String(next)); } catch { /* Optional. */ }
      window.dispatchEvent(new Event('resize'));
    }).catch(error => console.warn('Não foi possível ajustar o zoom da interface.', error));
  }

  if (scale !== 1) apply(scale);
  window.addEventListener('keydown', event => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey || event.isComposing || isCapturing()) return;
    let direction;
    if (['+', '='].includes(event.key) || event.code === 'NumpadAdd') direction = 1;
    else if (event.key === '-' || event.code === 'NumpadSubtract') direction = -1;
    else if (event.key === '0' || event.code === 'Numpad0') direction = 0;
    else return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const index = levels.indexOf(scale);
    scale = direction === 0 ? 1 : levels[Math.max(0, Math.min(levels.length - 1, index + direction))];
    apply(scale);
  }, { capture: true });
}
