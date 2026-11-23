(()=>{
 if(globalThis.__itsflowDemo){globalThis.__itsflowDemo.refresh();return;}
 let session=null,timer=0,pending=null;const sensitive=/password|senha|token|secret|cvv|cvc|cartao|cardnumber|cc-|one-time|otp|2fa|verification|authorization/i;
 const blocked=element=>!(element instanceof Element)||element.getRootNode()!==document||element.closest('[contenteditable], [data-itsflow-private]')||element.matches('input[type=password],input[type=hidden],input[type=file]')||sensitive.test([element.id,element.getAttribute('name'),element.getAttribute('autocomplete'),element.getAttribute('aria-label')].join(' '));
 const url=()=>location.href;
 const textField=element=>element instanceof HTMLTextAreaElement||(element instanceof HTMLInputElement&&['text','search','email','tel','url','number',''].includes(element.type));
 function selector(element){
  const unique=s=>{try{return document.querySelectorAll(s).length===1}catch{return false}};
  if(element.id){const s='#'+CSS.escape(element.id);if(unique(s))return s;}
  for(const name of ['data-testid','name','aria-label']){const value=element.getAttribute(name);if(value&&value.length<120){const s=element.localName+'['+name+'='+JSON.stringify(value)+']';if(unique(s))return s;}}
  const parts=[];for(let e=element;e&&e!==document.documentElement;e=e.parentElement){const siblings=[...(e.parentElement?.children||[])].filter(item=>item.localName===e.localName);parts.unshift(e.localName+':nth-of-type('+(siblings.indexOf(e)+1)+')');const s=parts.join(' > ');if(s.length>500)break;if(unique(s))return s;}return '';
 }
 let badge,visual,visualRoot,pointFrame=0,pointTimer=0,feedbackTimer=0,currentTarget=null;
 const capture=globalThis.installItsflowMessageCapture?.({getSession:()=>session,hideOverlays:()=>{stopPoint();if(visual)visual.style.visibility='hidden';if(badge)badge.hidden=true;},restoreOverlays:()=>{if(visual)visual.style.visibility='';void refresh();},onStatus:text=>{if(badge){badge.hidden=false;badge.textContent=text;setTimeout(()=>void refresh(),3500);}}});
 const reduce=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
 function sendGlow(point){
  if(reduce())return;visuals();const dot=document.createElement('div');
  Object.assign(dot.style,{position:'fixed',left:'0',top:'0',width:'9px',height:'9px',borderRadius:'50%',background:'#bcffed',boxShadow:'0 0 14px 5px #79f7d888',pointerEvents:'none'});visualRoot.append(dot);
  const x=point.x,y=point.y,endX=innerWidth-4,endY=Math.max(70,Math.min(innerHeight-80,innerHeight*.35));
  dot.animate([{transform:`translate(${x}px,${y}px) scale(.5)`,opacity:0},{transform:`translate(${x+(endX-x)*.35}px,${y-35}px) scale(1)`,opacity:1,offset:.35},{transform:`translate(${endX}px,${endY}px) scale(.25)`,opacity:0}],{duration:800,easing:'cubic-bezier(.3,.1,.3,1)',fill:'forwards'}).finished.finally(()=>dot.remove());
 }
 window.addEventListener('itsflow-demo-capture-glow',event=>{if(event.detail&&Number.isFinite(event.detail.x)&&Number.isFinite(event.detail.y))sendGlow(event.detail);});
 // SPA routers often change only the hash/history and do not reload scripts.
 let lastPage=location.href;
 const routeChanged=()=>{if(session&&location.href!==lastPage){lastPage=location.href;void refresh();}};
 window.addEventListener('hashchange',routeChanged);window.addEventListener('popstate',routeChanged);
 let routeTimer=setInterval(routeChanged,650);
 window.addEventListener('pagehide',()=>{clearInterval(routeTimer);routeTimer=0;});
 window.addEventListener('pageshow',()=>{if(!routeTimer)routeTimer=setInterval(routeChanged,650);routeChanged();});
 function visuals(){
  if(visual)return;
  visual=document.createElement('div');visual.dataset.itsflowDemoOverlay='true';
  Object.assign(visual.style,{position:'fixed',inset:'0',zIndex:2147483647,pointerEvents:'none'});
  visualRoot=visual.attachShadow({mode:'open'});
  visualRoot.innerHTML=`<style>
   :host{all:initial;pointer-events:none}*{box-sizing:border-box} .box{position:fixed;border:2px solid #67e8d1;border-radius:9px;background:#69e9d00a;box-shadow:0 0 0 5px #56e9cb16,0 0 24px #48d9c92b;opacity:0;transition:opacity .2s}
   .cursor{position:fixed;left:0;top:0;opacity:0;filter:drop-shadow(0 2px 4px #04101880);will-change:transform;transition:opacity .18s}.cursor svg{width:26px;height:31px;overflow:visible}.cursor span{position:absolute;left:23px;top:20px;background:#0c292e;color:#b9ffed;border:1px solid #69e5cf66;border-radius:7px;padding:5px 9px;font:600 11px system-ui;white-space:nowrap}
   .hint{position:fixed;padding:8px 12px;border:1px solid #68e8ce66;background:#09222bef;color:#baffed;border-radius:10px;max-width:260px;font:12px system-ui;line-height:1.5;box-shadow:0 5px 22px #0003;opacity:0;transition:opacity .2s}
   .toast{position:fixed;display:flex;align-items:center;gap:7px;padding:7px 11px;border-radius:20px;border:1px solid #7ae9cc5c;background:#08252deb;color:#c5ffed;font:500 11px system-ui;box-shadow:0 4px 18px #0002;white-space:nowrap}.toast b{color:#79efd0}.ring{position:fixed;width:24px;height:24px;border:1.5px solid #8af6da;border-radius:50%;box-shadow:0 0 0 4px #69f0d31a;transform:translate(-50%,-50%)}
   [hidden]{display:none!important}@media(prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
  </style><div class="box"></div><div class="cursor"><svg viewBox="0 0 26 31"><path d="M3 2L4 25L10 19L15 29L20 26L15 17L24 16Z" fill="#b7ffec" stroke="#073d42" stroke-width="1.6" stroke-linejoin="round"/></svg><span>Assistente</span></div><div class="hint"></div><div class="toast" hidden><b>✓</b><span>Clique salvo</span></div><div class="ring" hidden></div>`;
  document.documentElement.append(visual);
 }
 function stopPoint(){clearTimeout(pointTimer);cancelAnimationFrame(pointFrame);currentTarget=null;if(visualRoot){visualRoot.querySelector('.cursor').getAnimations().forEach(animation=>animation.cancel());for(const name of ['box','cursor','hint'])visualRoot.querySelector('.'+name).style.opacity='0';}}
 function feedback(element,point){
  visuals();const rect=element.getBoundingClientRect(),x=point?.x??rect.left+rect.width/2,y=point?.y??rect.top+rect.height/2;
  const toast=visualRoot.querySelector('.toast'),ring=visualRoot.querySelector('.ring');clearTimeout(feedbackTimer);
  for(const el of [toast,ring]){el.getAnimations().forEach(a=>a.cancel());el.hidden=false;}
  Object.assign(toast.style,{left:Math.max(8,Math.min(innerWidth-126,x+14))+'px',top:Math.max(8,Math.min(innerHeight-40,y+18))+'px'});
  Object.assign(ring.style,{left:x+'px',top:y+'px'});
  if(!reduce()){toast.animate([{opacity:0,translate:'0 5px'},{opacity:1,translate:'0 0',offset:.18},{opacity:1,offset:.75},{opacity:0,translate:'0 -4px'}],{duration:1450,fill:'forwards'});ring.animate([{opacity:.8,scale:.7},{opacity:0,scale:2}],{duration:550,fill:'forwards'});}
  feedbackTimer=setTimeout(()=>{toast.hidden=true;ring.hidden=true;},1500);
 }
 function pointTarget(message){
  if(!session||message.sessionId!==session.id||message.url!==location.href)return {ok:false,error:'A página da demonstração mudou.'};
  let matches;try{matches=[...document.querySelectorAll(message.selector)].filter(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&s.visibility==='visible'&&s.display!=='none'&&Number(s.opacity)>0;});}catch{return {ok:false,error:'Alvo inválido.'};}
  if(matches.length!==1||blocked(matches[0]))return {ok:false,error:'O campo não está disponível ou há mais de um alvo. Capture-o novamente.'};
  stopPoint();visuals();currentTarget=matches[0];const initial=currentTarget.getBoundingClientRect();
  if(initial.top<0||initial.bottom>innerHeight||initial.left<0||initial.right>innerWidth)currentTarget.scrollIntoView({block:'center',inline:'nearest',behavior:reduce()?'instant':'smooth'});
  const box=visualRoot.querySelector('.box'),cursor=visualRoot.querySelector('.cursor'),hint=visualRoot.querySelector('.hint');hint.textContent=String(message.label||'Este campo')+' · Esc para ocultar';
  let first=true;
  function track(){if(!currentTarget?.isConnected){stopPoint();return;}const r=currentTarget.getBoundingClientRect();
   Object.assign(box.style,{left:r.left-5+'px',top:r.top-5+'px',width:r.width+10+'px',height:r.height+10+'px',opacity:'1'});
   const x=Math.max(8,Math.min(innerWidth-125,r.right-8)),y=Math.max(8,Math.min(innerHeight-65,r.top+r.height/2));
   if(first&&!reduce()){cursor.animate([{transform:`translate(${Math.max(12,x-90)}px,${Math.max(12,y+65)}px)`},{transform:`translate(${x}px,${y}px)`}],{duration:650,easing:'cubic-bezier(.22,1,.36,1)'});}
   Object.assign(cursor.style,{transform:`translate(${x}px,${y}px)`,opacity:'1'});
   Object.assign(hint.style,{left:Math.max(8,Math.min(innerWidth-270,r.left))+'px',top:Math.max(8,Math.min(innerHeight-58,r.bottom+14))+'px',opacity:'1'});first=false;pointFrame=requestAnimationFrame(track);
  }
  track();pointTimer=setTimeout(stopPoint,8000);return {ok:true};
 }
 async function refresh(){const result=await chrome.runtime.sendMessage({type:'itsflow-demo-page-state'}).catch(()=>null);session=result?.state||null;if(!badge){badge=document.createElement('div');badge.dataset.itsflowDemoBadge='true';Object.assign(badge.style,{position:'fixed',bottom:'16px',right:'16px',zIndex:2147483647,padding:'9px 13px',borderRadius:'20px',background:'#061926',border:'1px solid #42d7be66',color:'#96f5d9',font:'12px system-ui',pointerEvents:'none'});document.documentElement.append(badge);}badge.textContent=session?.status==='recording'?'● itsflow · Demonstrando esta aba':'itsflow · Demonstração pausada';badge.hidden=!session||session.status==='stopped';}
 function send(kind,element,point){if(session?.status!=='recording'||location.origin!==session.origin||blocked(element))return;const target=selector(element);if(!target)return;const label=String(element.getAttribute('aria-label')||element.labels?.[0]?.textContent||element.getAttribute('name')||(kind==='click'&&!element.matches('input,textarea,select')?element.textContent:'Campo')).replace(/\s+/g,' ').trim().slice(0,100);void chrome.runtime.sendMessage({type:'itsflow-demo-event',sessionId:session.id,event:{kind,selector:target,label,url:url()}}).then(result=>{if(!result?.ok)void refresh();else{if(result.state)session={id:result.state.id,status:result.state.status,origin:result.state.origin};if(kind==='click'||kind==='input'){if(element.isConnected)feedback(element,point);const r=element.getBoundingClientRect();sendGlow(point||{x:r.left+r.width/2,y:r.top+r.height/2});}void refresh();}}).catch(()=>{});}
 function flush(){clearTimeout(timer);if(pending){send('input',pending);pending=null;}}
 document.addEventListener('click',event=>{if(!event.isTrusted)return;flush();const element=event.target instanceof Element?event.target.closest('button,a,input,textarea,select,[role=button],[role=link]'):null;if(element)send(textField(element)?'input':'click',element,{x:event.clientX,y:event.clientY});},true);
 document.addEventListener('input',event=>{if(!event.isTrusted||blocked(event.target)||!textField(event.target))return;if(pending!==event.target){flush();send('input',event.target);}pending=event.target;clearTimeout(timer);timer=setTimeout(flush,500);},true);
 document.addEventListener('change',event=>{if(!event.isTrusted||blocked(event.target)||!textField(event.target))return;pending=event.target;flush();},true);
 document.addEventListener('keydown',event=>{if(event.key==='Escape')stopPoint();},true);
 window.addEventListener('pagehide',()=>{flush();stopPoint();});chrome.runtime.onMessage.addListener((message,sender,respond)=>{if(message.type==='itsflow-demo-state-changed'){void refresh();stopPoint();capture?.cancel();}if(message.type==='itsflow-demo-select-region'){flush();stopPoint();respond(capture?.start(message)||{ok:false,error:'Recarregue a aba para ativar a captura de mensagem.'});return false;}if(message.type==='itsflow-demo-point-target'){respond(pointTarget(message));return false;}});globalThis.__itsflowDemo={refresh};void refresh();
})();
