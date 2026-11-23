// Explicit screenshot-region selection. It consumes only selection gestures,
// never dispatches a click, and never reads input values.
globalThis.installItsflowMessageCapture=({getSession,hideOverlays,restoreOverlays,onStatus})=>{
 let selection=null,capturing=false,blockClickUntil=0;
 const swallow=event=>{event.preventDefault();event.stopImmediatePropagation();};
 function cancel(){selection?.host.remove();selection=null;}
 function start(message){
  if(!getSession()||message.sessionId!==getSession().id||capturing)return {ok:false,error:'Captura indisponível. Reabra a demonstração.'};
  cancel();const host=document.createElement('div');host.dataset.itsflowCapture='true';
  Object.assign(host.style,{position:'fixed',inset:'0',zIndex:2147483647});const root=host.attachShadow({mode:'open'});
  root.innerHTML='<style>:host{all:initial}.shade{position:fixed;inset:0;background:#07162b33;cursor:crosshair;touch-action:none}.box{position:fixed;border:1.5px solid #82ebd6;border-radius:4px;box-shadow:0 0 0 9999px #030b2255;background:#78dfcc08;pointer-events:none}.label{position:fixed;top:20px;left:50%;transform:translateX(-50%);padding:10px 15px;border:1px solid #72dec967;border-radius:11px;background:#08232cf5;color:#b7f8e8;font:12px system-ui;white-space:nowrap;pointer-events:none}[hidden]{display:none}</style><div class="shade"><div class="box" hidden></div><div class="label">Analisar mensagem · arraste para recortar · Esc cancela</div></div>';
  document.documentElement.append(host);selection={host,box:root.querySelector('.box'),start:null,rect:null};return {ok:true};
 }
 const inside=(a,b)=>a.width>0&&a.height>0&&a.left>=b.x&&a.right<=b.x+b.width&&a.top>=b.y&&a.bottom<=b.y+b.height;
 const intersects=(a,b)=>a.width>0&&a.height>0&&a.left<b.x+b.width&&a.right>b.x&&a.top<b.y+b.height&&a.bottom>b.y;
 function textIn(rect){
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let node,count=0;const texts=[];
  while((node=walker.nextNode())&&count++<10000){const parent=node.parentElement;if(!node.textContent.trim()||!parent||parent.closest('script,style,input,textarea,[contenteditable],[data-itsflow-private],[data-itsflow-demo-overlay],[data-itsflow-demo-badge],[data-itsflow-capture]'))continue;
   if(parent.checkVisibility&&!parent.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}))continue;
   const range=document.createRange();range.selectNodeContents(node);const rects=[...range.getClientRects()].filter(r=>r.width>0&&r.height>0);if(rects.length&&rects.every(r=>inside(r,rect)))texts.push(node.textContent.trim());if(texts.join(' ').length>500)break;
  }return texts.join(' ').replace(/\s+/g,' ').slice(0,500);
 }
 async function save(rect){
  const session=getSession();capturing=true;blockClickUntil=performance.now()+350;cancel();
  try{
   if(!session||!rect||rect.width<12||rect.height<12)throw Error('Selecione uma área maior da mensagem.');
   // A message capture should not include editable or explicitly private fields.
   if([...document.querySelectorAll('input,textarea,[contenteditable],[data-itsflow-private]')].some(el=>intersects(el.getBoundingClientRect(),rect)))throw Error('Selecione somente a mensagem, sem campos de preenchimento.');
   const text=textIn(rect);hideOverlays();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
   const result=await chrome.runtime.sendMessage({type:'itsflow-demo-capture',sessionId:session.id,rect,viewport:{width:innerWidth,height:innerHeight},text});
   if(!result?.ok)throw Error(result?.error||'Não foi possível salvar a captura.');
   restoreOverlays();onStatus('✓ Captura salva');window.dispatchEvent(new CustomEvent('itsflow-demo-capture-glow',{detail:{x:rect.x+rect.width/2,y:rect.y+rect.height/2}}));
  }catch(error){restoreOverlays();onStatus(String(error.message||error));}
  finally{capturing=false;}
 }
 const handlers={
  pointerdown(event){if(!selection&&!capturing)return;swallow(event);if(selection&&event.button===0)selection.start={x:event.clientX,y:event.clientY};},
  pointermove(event){if(!selection&&!capturing)return;swallow(event);if(!selection?.start)return;const x=Math.max(0,Math.min(selection.start.x,event.clientX)),y=Math.max(0,Math.min(selection.start.y,event.clientY)),right=Math.min(innerWidth,Math.max(selection.start.x,event.clientX)),bottom=Math.min(innerHeight,Math.max(selection.start.y,event.clientY));selection.rect={x,y,width:right-x,height:bottom-y};selection.box.hidden=false;Object.assign(selection.box.style,{left:x+'px',top:y+'px',width:right-x+'px',height:bottom-y+'px'});},
  pointerup(event){if(!selection&&!capturing)return;swallow(event);if(selection?.start)void save(selection.rect);},
  click(event){if(selection||capturing||performance.now()<blockClickUntil)swallow(event);},
  keydown(event){if(!selection&&!capturing)return;swallow(event);if(selection&&event.key==='Escape'){cancel();onStatus('Captura cancelada');}},
  pagehide(){cancel();}
 };
 for(const [name,handler]of Object.entries(handlers))window.addEventListener(name,handler,true);
 return {start,cancel,isActive:()=>!!selection||capturing,destroy(){cancel();for(const [name,handler]of Object.entries(handlers))window.removeEventListener(name,handler,true);}};
};
