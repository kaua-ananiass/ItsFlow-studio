// Demonstration capture is explicit, tab-bound and never executes page actions.
const KEY='itsflowDemonstrationV1';
export const safePageUrl=value=>{const u=new URL(value);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)throw Error('Abra uma página HTTP/HTTPS sem credenciais na URL.');return u.href;};
export async function cropDemonstrationCapture(dataUrl,rect,viewport){
 const bitmap=await createImageBitmap(await (await fetch(dataUrl)).blob());
 try{
  const sx=bitmap.width/viewport.width,sy=bitmap.height/viewport.height;
  const scale=Math.min(1,1200/(rect.width*sx),800/(rect.height*sy));
  const width=Math.max(1,Math.round(rect.width*sx*scale)),height=Math.max(1,Math.round(rect.height*sy*scale));
  const canvas=new OffscreenCanvas(width,height);canvas.getContext('2d').drawImage(bitmap,rect.x*sx,rect.y*sy,rect.width*sx,rect.height*sy,0,0,width,height);
  let blob=await canvas.convertToBlob({type:'image/png'});
  if(blob.size>220000)blob=await canvas.convertToBlob({type:'image/jpeg',quality:.8});
  if(blob.size>300000)throw Error('A captura ficou grande. Selecione somente a mensagem.');
  const bytes=new Uint8Array(await blob.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return {data_url:`data:${blob.type};base64,${btoa(binary)}`,width,height};
 }finally{bitmap.close();}
}
export function installDemonstration({bridge,tabBusy=()=>false,captureRegion=async(tab,rect,viewport)=>cropDemonstrationCapture(await chrome.tabs.captureVisibleTab(tab.windowId,{format:'png'}),rect,viewport)}){
 let queue=Promise.resolve();
 const read=async()=> (await chrome.storage.session.get(KEY))[KEY]||null;
 const write=async state=>{await chrome.storage.session.set({[KEY]:state});return state;};
 const serialized=fn=>{const next=queue.then(fn);queue=next.catch(()=>{});return next;};
 async function stateFor(sender){const state=await read();if(!state||state.tabId!==sender.tab?.id)return null;return state;}
 const append=(state,event)=>{if(state.events.length>=50){state.status='paused';state.notice='Limite de 50 ações. Revise e envie este trecho ao Studio.';return null;}const saved={...event,id:crypto.randomUUID(),at:Date.now()};state.events.push(saved);return saved;};
 const review=(state,event)=>{if(event){state.status='paused';state.review_id=event.id;state.notice='Etapa capturada. Explique no chat o que ela faz antes de gravar a próxima.';}};
 async function navigation(state,value){
  if(!state||state.imported||state.status==='stopped')return;
  const url=safePageUrl(value);if(url===state.url)return;
  state.url=url;
  const pending=state.events.find(event=>event.id===state.review_id);
  if(pending)pending.resulting_url=url;
  const event=append(state,{kind:'navigate',url,label:'Navegar para página'});
  if(new URL(url).origin!==state.origin){state.status='paused';state.notice='Novo site detectado. Retome a gravação para autorizar capturas nele.';}
  else if(!pending)review(state,event);
  await write(state);
 }
 chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  if(!String(message?.type||'').startsWith('itsflow-demo-'))return;
  const pageMessage=['itsflow-demo-page-state','itsflow-demo-event','itsflow-demo-capture'].includes(message.type);
  if(!pageMessage&&sender.tab)return;
  const task=pageMessage?serialized(async()=>{
   const state=await stateFor(sender);if(!state)return {ok:true,state:null};
   if(message.type==='itsflow-demo-page-state'){
    if(sender.frameId===0)await navigation(state,sender.url||sender.tab.url);
    return {ok:true,state:{id:state.id,status:state.status,origin:state.origin}};
   }
   if(message.type==='itsflow-demo-capture'){
    if(state.review_id)throw Error('Explique a etapa atual no chat antes de capturar outra mensagem.');
    if(message.sessionId!==state.id||sender.frameId!==0||state.imported||tabBusy(state.tabId))throw Error('Captura indisponível nesta aba.');
    if(state.events.length>=50||state.events.filter(event=>event.kind==='observe').length>=8)throw Error('Envie este trecho antes de fazer mais capturas.');
    const rect=message.rect||{},viewport=message.viewport||{};
    if(![rect.x,rect.y,rect.width,rect.height,viewport.width,viewport.height].every(Number.isFinite)||rect.width<12||rect.height<12||rect.x<0||rect.y<0||viewport.width<=0||viewport.height<=0||rect.x+rect.width>viewport.width+1||rect.y+rect.height>viewport.height+1)throw Error('Selecione uma área válida da mensagem.');
    const tab=await chrome.tabs.get(state.tabId),[active]=await chrome.tabs.query({active:true,lastFocusedWindow:true});
    if(active?.id!==state.tabId||safePageUrl(tab.url)!==safePageUrl(sender.url||sender.tab.url)||new URL(tab.url).origin!==state.origin)throw Error('Volte à aba da demonstração para capturar.');
    const image=await captureRegion(tab,rect,viewport);
    const [after]=await chrome.tabs.query({active:true,lastFocusedWindow:true}),current=await chrome.tabs.get(state.tabId);
    if(after?.id!==state.tabId||safePageUrl(current.url)!==safePageUrl(tab.url))throw Error('A aba mudou durante a captura. Tente novamente.');
    review(state,append(state,{kind:'observe',label:'Analisar mensagem',url:safePageUrl(tab.url),image,text:String(message.text||'').slice(0,500),value:''}));
    return {ok:true,state:await write(state)};
   }
   if(state.status!=='recording'||message.sessionId!==state.id||sender.frameId>0)return {ok:false,error:'Captura inativa nesta aba.'};
   if(tabBusy(state.tabId)){state.status='paused';state.notice='A execução de uma automação pausou a demonstração.';await write(state);return {ok:false,error:state.notice};}
   const url=safePageUrl(sender.url||sender.tab.url);
   if(new URL(url).origin!==state.origin){state.status='paused';state.notice='Outro site foi aberto. Retome explicitamente para gravar este site.';await write(state);return {ok:false,error:state.notice};}
   const event=message.event||{};
   if(!['click','input'].includes(event.kind)||typeof event.selector!=='string'||!event.selector||event.selector.length>500)return {ok:false,error:'Elemento não suportado.'};
   const label=String(event.label||'Elemento').replace(/[\x00-\x1f]/g,' ').slice(0,100);
   const previous=state.events.at(-1);
   if(event.kind==='input'&&previous?.kind==='input'&&previous.selector===event.selector){previous.at=Date.now();return {ok:true,state:await write(state)};}
   const saved=append(state,{kind:event.kind,selector:event.selector,label,url,value:''});review(state,saved);return {ok:!!saved,state:await write(state),error:saved?undefined:state.notice};
  }):(async()=>{
   if(message.type==='itsflow-demo-status')return {ok:true,state:await serialized(read),studio:await bridge({operation:'status'}).catch(error=>({error:String(error.message||error)}))};
   if(message.type==='itsflow-demo-select'){
    const state=await read();if(!state||state.imported||tabBusy(state.tabId))throw Error('Inicie uma demonstração antes de capturar.');
    if(state.review_id)throw Error('Explique a etapa atual antes de capturar outra mensagem.');
    const [tab]=await chrome.tabs.query({active:true,lastFocusedWindow:true});
    if(tab?.id!==state.tabId||new URL(tab.url).origin!==state.origin)throw Error('Volte à aba da demonstração para selecionar a mensagem.');
    const result=await chrome.tabs.sendMessage(state.tabId,{type:'itsflow-demo-select-region',sessionId:state.id});
    if(!result?.ok)throw Error(result?.error||'Recarregue a aba para ativar a captura.');return {ok:true,message:'Arraste sobre a mensagem na página. Esc cancela.'};
   }
   if(message.type==='itsflow-demo-point'){
    const state=await read(),event=state?.events.find(item=>item.id===message.id&&['click','input'].includes(item.kind));
    if(!event)throw Error('Esse alvo não faz parte da demonstração.');
    if(tabBusy(state.tabId))throw Error('Aguarde a automação terminar antes de destacar um campo.');
    const [active]=await chrome.tabs.query({active:true,lastFocusedWindow:true});
    if(active?.id!==state.tabId)throw Error('Volte à aba da demonstração para ver o destaque.');
    const tab=await chrome.tabs.get(state.tabId);
    if(safePageUrl(tab.url)!==event.url)throw Error('Esse campo pertence a outra página. Volte à página em que ele foi capturado.');
    const result=await chrome.tabs.sendMessage(state.tabId,{type:'itsflow-demo-point-target',sessionId:state.id,url:event.url,selector:event.selector,label:event.label});
    if(!result?.ok)throw Error(result?.error||'Recarregue a aba para ativar o cursor do assistente.');
    return {ok:true};
   }
   if(message.type==='itsflow-demo-chat'){
    const state=await serialized(async()=>{const current=await read();if(!current)throw Error('Inicie uma demonstração primeiro.');
     if(message.review_answer&&message.review_answer===current.review_id&&String(message.prompt||'').trim()){
      const event=current.events.find(event=>event.id===current.review_id);if(event)event.description=String(message.prompt).trim().slice(0,1000);
      current.review_id=null;current.notice='Etapa explicada. Clique em Gravar próxima etapa quando estiver pronto.';await write(current);
     }return current;});
    const selected=message.image_event?state.events.find(event=>event.id===message.image_event&&event.kind==='observe'):null;
    if(message.image_event&&!selected)throw Error('A captura selecionada não está mais no rascunho.');
    const result=await bridge({operation:'chat',automation_id:state.automation.id,prompt:String(message.prompt||'').slice(0,4000),history:(message.history||[]).slice(-8),image:selected?.image?.data_url||null,image_event:selected?.id||null,events:state.events.map(({id,kind,label,url,text,description,resulting_url})=>{const page=new URL(url);let destination;try{const next=new URL(resulting_url);destination=next.origin+next.pathname;}catch{}return {id,kind,label,description:String(description||'').slice(0,1000),url:page.origin+page.pathname,resulting_page:destination,...(kind==='observe'?{text:String(text||'').slice(0,500)}:{})};})});
    const targets=[];const text=String(result.message||'').replace(/\[\[apontar:([^\]]+)\]\]/g,(_,id)=>{const event=state.events.find(item=>item.id===id&&['click','input'].includes(item.kind));if(event&&!targets.some(item=>item.id===id)&&targets.length<2)targets.push({id:event.id,label:event.label});return '';}).trim();
    return {ok:true,...result,message:text,targets};
   }
   return serialized(async()=>{
    let state=await read();
    if(message.type==='itsflow-demo-start'){
     if(state?.events.length&&!message.replace)throw Error('Há uma demonstração salva. Envie ou descarte antes de iniciar outra.');
     const [tab]=await chrome.tabs.query({active:true,lastFocusedWindow:true});if(!tab?.id)throw Error('Escolha a aba que deseja demonstrar.');if(tabBusy(tab.id))throw Error('Pare a automação desta aba antes de demonstrar.');
     const url=safePageUrl(tab.url),studio=await bridge({operation:'status'});if(!studio.automation?.id)throw Error('Abra uma automação no Studio para receber os blocos.');
     state={id:crypto.randomUUID(),tabId:tab.id,origin:new URL(url).origin,url,status:'recording',automation:studio.automation,revision:studio.revision,events:[],notice:''};append(state,{kind:'navigate',url,label:'Abrir página'});await write(state);
     await chrome.scripting.executeScript({target:{tabId:tab.id},files:['demonstration-capture-content.js','demonstration-content.js']});return {ok:true,state};
    }
    if(!state)throw Error('Nenhuma demonstração iniciada.');
    if(message.type==='itsflow-demo-toggle'){
     if(state.imported)throw Error('Esta demonstração já foi enviada. Comece uma nova.');
     if(state.review_id)throw Error('Explique no chat o que a etapa capturada faz antes de continuar.');
     if(state.status==='recording')state.status='paused';else{
      const tab=await chrome.tabs.get(state.tabId);if(tabBusy(tab.id))throw Error('Pare a automação antes de retomar.');const url=safePageUrl(tab.url);state.origin=new URL(url).origin;state.status='recording';state.notice='';if(state.events.at(-1)?.url!==url)append(state,{kind:'navigate',url,label:'Abrir página'});
     }
     await write(state);await chrome.tabs.sendMessage(state.tabId,{type:'itsflow-demo-state-changed'}).catch(()=>{});return {ok:true,state};
    }
    if(message.type==='itsflow-demo-stop'){state.status='stopped';await write(state);await chrome.tabs.sendMessage(state.tabId,{type:'itsflow-demo-state-changed'}).catch(()=>{});return {ok:true,state};}
    if(message.type==='itsflow-demo-discard'){await chrome.storage.session.remove(KEY);await chrome.tabs.sendMessage(state.tabId,{type:'itsflow-demo-state-changed'}).catch(()=>{});return {ok:true,state:null};}
    if(message.type==='itsflow-demo-draft'){
     if(state.imported)throw Error('Esta demonstração já foi enviada.');
     const event=state.events.find(item=>item.id===message.id);if(!event)throw Error('Ação não encontrada.');if(message.remove){state.events=state.events.filter(item=>item.id!==message.id);if(state.review_id===event.id){state.review_id=null;state.notice='Etapa removida. Você pode gravar outra.';}}else if(event.kind==='input')event.value=String(message.value||'').slice(0,400);else if(event.kind==='observe')event.text=String(message.value||'').slice(0,500);return {ok:true,state:await write(state)};
    }
    if(message.type==='itsflow-demo-destination'){const studio=await bridge({operation:'status'});if(studio.automation?.id!==state.automation.id)throw Error('Reabra no Studio a automação desta demonstração.');state.revision=studio.revision;return {ok:true,state:await write(state)};}
    if(message.type==='itsflow-demo-import'){
     if(state.status==='recording')throw Error('Encerre a gravação e revise as ações antes de enviar.');
     if(state.review_id)throw Error('Explique a última etapa no chat antes de enviar.');
     if(state.imported)throw Error('Esta demonstração já foi enviada.');if(state.events.some(e=>e.kind==='input'&&!e.value.trim()))throw Error('Preencha um texto fixo ou {{VARIAVEL}} para cada campo capturado.');
     const result=await bridge({operation:'import',automation_id:state.automation.id,revision:state.revision,session_id:state.id,events:state.events});state.imported=true;state.status='stopped';await write(state);return {ok:true,state,...result};
    }
    throw Error('Ação de demonstração desconhecida.');
   });
  })();
  task.then(respond).catch(error=>respond({ok:false,error:String(error.message||error)}));return true;
 });
 chrome.tabs.onUpdated.addListener((tabId,change,tab)=>{if(!change.url)return;void serialized(async()=>{const state=await read();if(state?.tabId===tabId)await navigation(state,change.url);}).catch(()=>{});});
 chrome.tabs.onRemoved.addListener(tabId=>{void serialized(async()=>{const state=await read();if(state?.tabId===tabId){state.status='stopped';state.notice='A aba foi fechada. O rascunho foi preservado.';await write(state);}});});
}
