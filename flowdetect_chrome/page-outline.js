// Draw a non-interactive colored frame around the actual website viewport.
// This script is injected by the extension on linked HTTP(S) tabs only.
(() => {
  if (globalThis.__flowdetectPageOutlineInstalled) return;
  globalThis.__flowdetectPageOutlineInstalled = true;
  // A Chrome extension reload can leave the previous frame in the DOM.
  // Remove only an older frame carrying this FlowDetect-specific host ID.
  document.querySelector("#__flowdetect_page_outline_host")?.remove();

  const PALETTE = new Set(["#12b5cb", "#8b5cf6", "#4ade80", "#f59e0b"]);
  let host = null;
  let transition=null;
  let tagTransition=null;

  async function leaveForDesktop(){
    if(!host)return;
    transition?.cancel();
    const current=host;
    if(!matchMedia('(prefers-reduced-motion: reduce)').matches){
      transition=current.__flowdetectSurface.animate([{opacity:1,transform:'scale(1)'},{opacity:.55,transform:'scale(1.006)',offset:.45},{opacity:0,transform:'scale(1.018)'}],{duration:380,easing:'cubic-bezier(.22,1,.36,1)',fill:'forwards'});
      try{await transition.finished;}catch{return;}
    }
    if(host===current)removeOutline();
  }

  function removeOutline() {
    transition?.cancel();transition=null;
    tagTransition?.cancel();tagTransition=null;
    host?.remove();
    host = null;
  }

  function applyOutline(page,{returning=false}={}) {
    transition?.cancel();transition=null;
    tagTransition?.cancel();tagTransition=null;
    if (!page?.id || !PALETTE.has(page.color)) {
      removeOutline();
      return;
    }
    if (!document.documentElement) return;
    if (!host || !host.isConnected) {
      host = document.createElement("div");
      host.id = "__flowdetect_page_outline_host";
      host.setAttribute("aria-hidden", "true");
      const shadow = host.attachShadow({ mode: "closed" });
      const style = document.createElement("style");
      style.textContent = `
        :host { all: initial !important; position: fixed !important; inset: 0 !important;
          z-index: 2147483647 !important; pointer-events: none !important;
          box-sizing: border-box !important; }
        .outline { position: absolute; inset: 0; border: 4px solid var(--fd-color);
          box-sizing: border-box; border-radius: 3px;
          box-shadow: inset 0 0 16px color-mix(in srgb, var(--fd-color) 28%, transparent);
          pointer-events: none; }
        .tag { position: absolute; right: 12px; top: 4px; max-width: min(210px, 64vw);
          padding: 6px 10px; border: 1px solid var(--fd-color); border-radius: 0 0 9px 9px;
          box-sizing: border-box; background: #071728; color: #fff;
          font: 700 12px/1.4 "Segoe UI", Arial, sans-serif;
          overflow-wrap: anywhere; text-align: center;
          box-shadow: 0 4px 15px rgba(0,0,0,.3); pointer-events: none; }
        @media print { :host { display: none !important; } }
      `;
      const outline = document.createElement("div");
      outline.className = "outline";
      const tag = document.createElement("div");
      tag.className = "tag";
      const surface=document.createElement('div');
      surface.style.cssText='position:absolute;inset:0;pointer-events:none';
      surface.append(outline,tag);
      shadow.append(style,surface);
      host.__flowdetectSurface=surface;
      host.__flowdetectTag = tag;
      document.documentElement.append(host);
      if(!returning&&!matchMedia('(prefers-reduced-motion: reduce)').matches)transition=surface.animate([{opacity:0,transform:'scale(1.012)'},{opacity:1,transform:'scale(1)'}],{duration:320,easing:'cubic-bezier(.22,1,.36,1)'});
    }
    host.style.setProperty("--fd-color", page.color);
    const label=`itsflow · ${String(page.name || "Página")}`;
    host.__flowdetectTag.textContent = label;
    if(returning&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
      const current=host;
      host.__flowdetectTag.textContent='itsflow · Voltando ao Chrome';
      const animation=current.__flowdetectSurface.animate([
        {opacity:0,transform:'scale(.988)',filter:'brightness(1.6)'},
        {opacity:1,transform:'scale(1)',filter:'brightness(1.35)',offset:.48},
        {opacity:1,transform:'scale(1)',filter:'brightness(1)'}
      ],{duration:880,easing:'cubic-bezier(.22,1,.36,1)'});
      transition=animation;
      tagTransition=current.__flowdetectTag.animate([
        {opacity:0,transform:'translateY(-8px)'},
        {opacity:1,transform:'translateY(0)'}
      ],{duration:650,easing:'cubic-bezier(.22,1,.36,1)'});
      animation.finished.then(()=>{if(host===current&&transition===animation){current.__flowdetectTag.textContent=label;transition=null;}}).catch(()=>{});
    }
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if(message?.type==='flowdetect-page-outline-handoff'){
      leaveForDesktop().then(()=>sendResponse?.({ok:true}));
      return true;
    }
    if (message?.type !== "flowdetect-page-outline-update") return false;
    applyOutline(message.page || null,{returning:message.returningFromDesktop===true});
    sendResponse?.({ ok: true });
    return false;
  });

  // Reconnect border after site navigation or extension service-worker restart.
  Promise.resolve(chrome.runtime.sendMessage({ type: "flowdetect-page-outline-state" }))
    .then((result) => { if (result?.ok) applyOutline(result.page || null); })
    .catch(() => {});
})();
