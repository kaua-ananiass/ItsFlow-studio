import {runAssistantBatch} from './assistant-batch';
import {useEffect,useRef,useState} from 'react';
import {GeneratedMessage} from './generated-message';
import {ArrowRight,Bot,Check,Copy,Layers3,Plus,Settings2,PanelLeft,Search,Pencil,Trash2} from 'lucide-react';
import MorphOrbAndInput from '@/components/ui/ai-thiking-orb-and-input';
import {type Guide,type GuideStep,type GuideNavigation} from './guided-flow';
type Session={client_id?:string;accounts?:{id:string;label:string;email?:string;connected:boolean}[];connected?:boolean;sharing?:boolean;email?:string;revoked?:boolean};
type Model={slug:string;display_name:string;visibility:string};
import {useChatThreads,type Thread,type Message,type Automation} from './chat-threads';
export interface ChatBridge{revealBlock?:(blockId:string)=>Promise<void>;assistOperation?:(step:GuideStep,operation:()=>Promise<any>)=>Promise<any>;editorAction?:(action:string,blockId:string)=>Promise<void>;mountMap?:(host:HTMLElement)=>()=>void;getEditorContext?:()=>{block_id:string|null;order:number|null;workspace:string;title?:string|null;type?:string|null};navigate?:(target:GuideNavigation&{chat_id?:string})=>Promise<void>;getAutomation?:()=>Automation|null;openAutomation?:(id:string)=>Promise<void>;invoke:(command:string,payload:unknown)=>Promise<any>;beforeGenerate:()=>Promise<unknown>;beforeMutate?:()=>Promise<unknown>;apply:(roadmap:any,placement?:GuideStep['placement'])=>void;getPage:()=>string;openMap:()=>void;listenDelta?:(handler:(event:{request_id:string;delta:string})=>void)=>Promise<()=>void>;}
const failure=(error:unknown)=>error instanceof Error?error.message:String(error);
export function FlowChat({bridge}:{bridge:ChatBridge}){
 const [session,setSession]=useState<Session>({}),[models,setModels]=useState<Model[]>([]),[model,setModel]=useState('');
 const store=useChatThreads(bridge),thread=store.active;
 const {messages,prompt,guide}=thread;
 const [sidebar,setSidebar]=useState(false),[search,setSearch]=useState(''),[renaming,setRenaming]=useState(''),[rename,setRename]=useState(''),[deleted,setDeleted]=useState<Thread|null>(null),[requestThread,setRequestThread]=useState('');
 function field<K extends keyof Thread>(key:K,value:Thread[K]|((previous:Thread[K])=>Thread[K])){store.update(thread.id,t=>({[key]:typeof value==='function'?(value as (p:Thread[K])=>Thread[K])(t[key]):value}));}
 const setMessages=(v:Message[]|((p:Message[])=>Message[]))=>field('messages',v),setPrompt=(v:string)=>field('prompt',v);
 const activeThreadRef=useRef(thread.id);activeThreadRef.current=thread.id;
 const currentAutomation=bridge.getAutomation?.()||null;
 const [workbench,setWorkbench]=useState(false),[selectedBlock,setSelectedBlock]=useState<{order:number|null;type?:string;title?:string|null}>({order:null});
 const [undo,setUndo]=useState<{token:string;revision:string;threadId:string}|null>(null);
 const mapHost=useRef<HTMLDivElement>(null);
 useEffect(()=>{window.dispatchEvent(new Event('flow-chat-guide-dismiss'));},[thread.id,workbench]);
 useEffect(()=>{if(!workbench||!mapHost.current||!bridge.mountMap)return;return bridge.mountMap(mapHost.current);},[workbench]);
 useEffect(()=>{const select=(e:Event)=>setSelectedBlock((e as CustomEvent).detail);window.addEventListener('flow-chat-map-selection',select);return()=>window.removeEventListener('flow-chat-map-selection',select);},[]);
 function openWorkbench(){if(!checkAutomation())return;setWorkbench(true);setSidebar(false);}
 const mismatched=!!thread.automation&&thread.automation.id!==currentAutomation?.id;
 useEffect(()=>{const media=matchMedia('(max-width:900px)');const change=()=>{if(media.matches)setSidebar(false);};media.addEventListener('change',change);return()=>media.removeEventListener('change',change);},[]);
 function choose(id:string){store.select(id);setNotice('');nearBottom.current=true;if(innerWidth<=900)setSidebar(false);}
 function finishRename(){if(rename.trim())store.update(renaming,{title:rename.trim().slice(0,100),renamed:true});setRenaming('');}
 function checkAutomation(){const current=bridge.getAutomation?.()||null;if(thread.automation&&current?.id!==thread.automation.id){setNotice('Abra a automação vinculada a esta conversa para continuar.');return false;}if(!thread.automation&&current)store.update(thread.id,{automation:current});return true;}

 const [visualOperation,setVisualOperation]=useState(true),[activityLabel,setActivityLabel]=useState('');
 const [busy,setBusy]=useState(false),[phase,setPhase]=useState(''),[notice,setNotice]=useState(''),[settings,setSettings]=useState(false);
 const [progress,setProgress]=useState<string[]>([]),[outcome,setOutcome]=useState<'idle'|'pending'|'success'|'error'>('idle');
 const [freshReply,setFreshReply]=useState<string|null>(null);
 useEffect(()=>setFreshReply(null),[thread.id]);
 const reportProgress=(text:string)=>setProgress(previous=>[...previous.filter(item=>item!==text),text].slice(-3));
 const [copied,setCopied]=useState(''),[visible,setVisible]=useState(true);
 const root=useRef<HTMLDivElement>(null),log=useRef<HTMLDivElement>(null),input=useRef<HTMLTextAreaElement>(null),locked=useRef(false),nearBottom=useRef(true);
 const invoke=(action:string,extra:Record<string,unknown>={})=>bridge.invoke('chatgpt_action',{request:{action,...extra}});
 useEffect(()=>{const el=root.current;if(!el||!('IntersectionObserver'in window))return;const o=new IntersectionObserver(([entry])=>setVisible(entry.isIntersecting));o.observe(el);return()=>o.disconnect();},[]);
 useEffect(()=>{if(nearBottom.current&&log.current)log.current.scrollTop=log.current.scrollHeight;},[messages,phase]);
 useEffect(()=>{if(input.current){input.current.style.height='auto';input.current.style.height=`${Math.min(160,input.current.scrollHeight)}px`;}},[prompt]);
 async function recoverConnection(error:unknown){if(!/invalid_grant|invalid_client|CHATGPT_RECONNECT_REQUIRED/.test(failure(error)))return;setModels([]);setModel('');setSidebar(true);setSettings(true);try{setSession(await invoke('status'));}catch{/* Keep the original authentication error visible. */}}
 async function loadModels(){const response=await invoke('models');const list=(response.models||[]).filter((m:Model)=>m.visibility==='list'&&m.slug);setModels(list);setModel(previous=>list.some((m:Model)=>m.slug===previous)?previous:list[0]?.slug||'');if(!list.length)throw Error('Nenhum modelo disponível. Confira a autorização do plano no ChatGPT.');}
 useEffect(()=>{let alive=true;(async()=>{try{const result=await invoke('status');if(!alive)return;setSession(result);if(result.sharing)await loadModels();else{setSidebar(true);setSettings(true);}}catch(error){if(alive){setNotice(failure(error));await recoverConnection(error);}}})();return()=>{alive=false;};},[]);
 async function operation(label:string,work:()=>Promise<void>,visual=true){if(locked.current)return;locked.current=true;setVisualOperation(visual);setActivityLabel(label);setOutcome('pending');setProgress(label?[label]:[]);setBusy(true);setPhase(label);setNotice('');try{await work();setOutcome('success');}catch(error){setOutcome('error');setNotice(failure(error));await recoverConnection(error);}finally{locked.current=false;setBusy(false);setPhase('');setActivityLabel('');}}
 async function connect(newAccount=false){await operation('Conectando…',async()=>{setNotice(newAccount?'No navegador, entre com a conta que deseja adicionar. A conta atual será preservada.':'Conclua o login da conta selecionada no navegador e volte ao Studio.');const result=await invoke('login',{new_account:newAccount,account_id:newAccount?undefined:session.client_id});setModels([]);setModel('');setSession(result);if(result.sharing){await loadModels();setSettings(false);setNotice('ChatGPT conectado. Pode começar a conversa.');}else setNotice('Login concluído. Autorize o uso do plano para conversar.');});}
 async function disconnect(){await operation('Desconectando…',async()=>{const result=await invoke('logout');setSession(result);setModels([]);setModel('');setNotice(result.revoked===false?'Desconectado neste computador. Revise o acesso também nas configurações do ChatGPT.':'ChatGPT desconectado.');});}
 function newConversation(){store.create();setNotice('');nearBottom.current=true;if(innerWidth<=900)setSidebar(false);input.current?.focus();}
 async function submit(){
  const text=prompt.trim();if(!text||locked.current)return;
  if(!session.sharing||!model){setSidebar(true);setSettings(true);setNotice('Conecte sua conta para enviar.');return;}
  if(!store.ready||!checkAutomation())return;
  const targetId=thread.id,messageId=crypto.randomUUID();
  setFreshReply(messageId);
  store.update(targetId,t=>({title:t.renamed||t.messages.length?t.title:text.replace(/\s+/g,' ').slice(0,64),mode:'guide',proposal:null}));
  setRequestThread(targetId);locked.current=true;setVisualOperation(true);setOutcome('pending');setProgress(['Preparando o contexto da conversa.']);setBusy(true);setPhase('Preparando o contexto...');setNotice('');setPrompt('');nearBottom.current=true;
  setMessages(previous=>[...previous,{id:crypto.randomUUID(),role:'user',text,status:'complete'},{id:messageId,role:'assistant',text:'',status:'pending'}]);
  let answer='';
  try{
   await bridge.beforeGenerate();reportProgress('Configuração atual do mapa preparada.');setPhase('Pensando no seu pedido...');reportProgress('Aguardando a resposta do assistente para este pedido.');
   const result:Guide=await invoke('universal',{prompt:text,guide_state:guide,editor_context:bridge.getEditorContext?.(),assistant_mode:true,model,automation_id:(thread.automation||bridge.getAutomation?.())?.id,history:thread.history.slice(-12).map(turn=>({...turn,content:turn.content.slice(0,2000)})),request_id:crypto.randomUUID()});
   answer=String(result.message||'');if(!answer.trim())throw Error('A resposta terminou sem uma mensagem. Tente novamente.');
   reportProgress(result.questions?.length?'Há informações para esclarecer antes de agir.':result.steps.length?'Resposta recebida. Conferindo as etapas solicitadas.':'Resposta recebida. Preparando a apresentação.');
   store.update(targetId,()=>({guide:result}));
   const current=()=>activeThreadRef.current===targetId;
   if(!result.questions?.length&&result.steps.length&&current()){
    const edits=result.steps.some(step=>!['reuse','manual'].includes(step.kind)||!!step.configuration||!!step.editor_action);
    if(bridge.mountMap){setWorkbench(true);setSidebar(false);await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));}
    if(edits){
     window.dispatchEvent(new CustomEvent('flow-chat-guide-dismiss'));
     if(result.steps.some(step=>step.editor_action||step.kind==='manual')){
      if(result.steps.length!==1)throw Error('Esse pedido inclui uma etapa manual. Descreva primeiro essa etapa para continuar sem alterar o mapa parcialmente.');
      const step=result.steps[0];setPhase('Configurando '+step.title+'...');reportProgress('Abrindo a etapa: '+step.title);
      if(step.kind==='manual')await bridge.navigate?.({tab:step.tab||'commands',title:step.title,reason:step.instruction,chat_id:targetId});
      else await assistStep(result,step,targetId);
     }else{
      const completed=await runAssistantBatch(result,async(plan,step)=>{setPhase('Configurando '+step.title+'...');reportProgress('Configurando no editor: '+step.title);const updated=await assistStep(plan,step,targetId,true);reportProgress('Etapa salva: '+step.title);return updated;},current);
      const last=completed.steps.at(-1);if(last?.block_id&&current())await bridge.revealBlock?.(last.block_id);
      answer+='\n\nAlterações salvas no mapa: '+completed.steps.map(step=>step.title).join(', ')+'. A automação não foi executada.';
     }
    }else{
     const step=result.steps[0];await bridge.navigate?.({tab:step.tab||'commands',order:step.source_order,block_id:step.block_id,title:step.title,reason:step.instruction,focus:step.focus||result.navigation?.focus,chat_id:targetId});
    }
   }else if(!result.questions?.length&&result.navigation&&current())await bridge.navigate?.({...result.navigation,chat_id:targetId});
   store.update(targetId,t=>({messages:t.messages.map(m=>m.id===messageId?{...m,text:answer,status:'complete'}:m),history:[...t.history,{role:'user',content:text},{role:'assistant',content:answer}]}));
   setOutcome('success');
  }catch(error){
   await recoverConnection(error);
   setOutcome('error');reportProgress('O pedido foi interrompido. Veja o aviso para continuar.');
   store.update(targetId,t=>({messages:t.messages.map(m=>m.id===messageId?{...m,text:answer,status:'error',error:failure(error)}:m),prompt:text}));
  }finally{setRequestThread('');locked.current=false;setBusy(false);setPhase('');if(activeThreadRef.current===targetId)requestAnimationFrame(()=>input.current?.focus());}
 }
 async function navigateStep(step:GuideStep){if(!checkAutomation())return;await operation('Abrindo configuração…',async()=>{if(!bridge.navigate)throw Error('A navegação guiada não está disponível nesta janela.');await bridge.beforeGenerate();await bridge.navigate({tab:step.kind==='manual'?(step.tab||'commands'):'commands',order:step.source_order,block_id:step.block_id,reason:step.instruction,title:step.title,focus:step.focus,chat_id:thread.id});});}
 function refreshPlan(plan:Guide,context:any):Guide{return {...plan,revision:context.revision,steps:plan.steps.map(step=>{if(!step.source_order&&!step.block_id)return step;const block=context.blocks.find((b:any)=>step.block_id?b.block_id===step.block_id:b.source_order===step.source_order);return block?{...step,...block.editable,title:block.title||step.title,source_order:block.source_order,block_id:block.block_id,configured:block.configured,missing:block.missing}:{...step,configured:false,missing:['O bloco foi removido. Peça ao assistente para atualizar esta etapa.']};})};}
 async function refreshGuidance(target=thread){if(!target.guide)return;const current=bridge.getAutomation?.();if(target.automation&&target.automation.id!==current?.id){setNotice('Abra a automação desta conversa para conferir seus blocos.');return;}await operation('Conferindo os blocos salvos…',async()=>{await bridge.beforeGenerate();const context=await bridge.invoke('map_paths_action',{request:{action:'ai_guide_context',include_values:true}});store.update(target.id,t=>({guide:t.guide?refreshPlan(t.guide,context):null}));setNotice('Configuração salva conferida. Conte o que você fez para o assistente orientar a próxima etapa.');});}
 useEffect(()=>{const back=(event:Event)=>{const id=(event as CustomEvent).detail?.threadId;const target=store.threads.find(t=>t.id===id)||thread;store.select(target.id);void refreshGuidance(target);};window.addEventListener('flow-chat-guide-return',back);return()=>window.removeEventListener('flow-chat-guide-return',back);},[store.threads,busy]);
 async function assistStep(plan:Guide,step:GuideStep,targetId:string,quiet=false):Promise<Guide>{
  const commit=()=>bridge.invoke('map_paths_action',{request:{action:'ai_assist_apply',revision:plan.revision,guide_id:targetId,name:plan.name,step,parent:bridge.getPage(),pageId:'1'}});
  const result=bridge.assistOperation?await bridge.assistOperation(step,commit):await commit();
  bridge.apply(result.roadmap,step.placement);
  const block=result.context.blocks.find((b:any)=>b.block_id===result.block_id);
  if(!block)throw Error('Confira o bloco no mapa antes de continuar.');
  const nextPlan=refreshPlan({...plan,steps:plan.steps.map(s=>s.id===step.id?{...s,...step,source_order:block.source_order,block_id:result.block_id}:s)},result.context);
  nextPlan.steps=nextPlan.steps.map(s=>{const anchor=s.placement?.anchor_id&&result.context.blocks.find((b:any)=>b.block_id===s.placement?.anchor_id);return anchor?{...s,placement:{...s.placement!,anchor_order:anchor.source_order}}:s;});
  store.update(targetId,()=>({guide:nextPlan}));
  if(result.undo_token)setUndo({token:result.undo_token,revision:result.context.revision,threadId:targetId});
  setNotice(result.message);
  if(!quiet&&activeThreadRef.current===targetId){
   await bridge.navigate?.({tab:'commands',order:block.source_order,block_id:result.block_id,title:step.title,reason:step.instruction,focus:step.focus,chat_id:targetId});
   if(step.editor_action)await bridge.editorAction?.(step.editor_action,result.block_id);
  }
  return nextPlan;
 }
 async function undoAssistant(){if(!undo||undo.threadId!==thread.id||!checkAutomation())return;await operation('Desfazendo a edi\u00e7\u00e3o...',async()=>{const result=await bridge.invoke('map_paths_action',{request:{action:'ai_assist_undo',revision:undo.revision,undo_token:undo.token}});bridge.apply(result.roadmap);setUndo(null);setNotice(result.message);store.update(thread.id,t=>({guide:t.guide?refreshPlan(t.guide,result.context):null}));});}
 async function copyMessage(m:Message){try{await navigator.clipboard.writeText(m.text);setCopied(m.id);setTimeout(()=>setCopied(''),1800);}catch{setNotice('Não foi possível copiar. Você pode selecionar o texto da resposta.');}}
 return <div className="fdchat-workspace" data-workbench={workbench}>
  {workbench&&<section className="fdchat-map-pane" aria-label="Mapa real da automação"><header className="fdchat-map-pane-header"><div><strong>Mapa + conversa</strong><p>Os mesmos blocos do mapa. Configure aqui e tire suas dúvidas ao lado.</p></div><button type="button" onClick={()=>setWorkbench(false)}>Voltar ao chat</button></header><div ref={mapHost} className="fdchat-map-host"/></section>}
  <div ref={root} className="fdchat dark" data-sidebar={sidebar} data-accounts={settings} data-theme="dark" data-busy={busy&&visualOperation} data-empty={!messages.length}>
  <aside className="fdchat-sidebar" aria-label="Histórico de conversas" hidden={!sidebar}>
   <div className="fdchat-sidebar-top"><strong>Suas conversas</strong><div className="fdchat-sidebar-tools"><button type="button" aria-label="Conta e modelo do ChatGPT" title="Conta e modelo" aria-expanded={settings} aria-controls="chat-account-settings" onClick={()=>setSettings(!settings)}><Settings2 size={16}/></button><button aria-label="Ocultar histórico" onClick={()=>setSidebar(false)}><PanelLeft size={17}/></button></div></div>
  <div className="fdchat-account-reveal" data-open={settings} aria-hidden={!settings} inert={!settings}><div className="fdchat-account-reveal-inner"><section id="chat-account-settings" className="fdchat-settings" aria-label="Conexão e modelo"><div className="fdchat-account-heading"><strong>{session.connected?session.email||'Conta ChatGPT conectada':'Use sua conta ChatGPT'}</strong><p>{session.sharing?'O uso segue a disponibilidade do seu plano.':'Entre pelo navegador oficial. Sem chave de API.'}</p></div><label className="fdchat-account-picker">Conta ChatGPT<select aria-label="Conta ChatGPT" value={session.client_id||''} disabled={busy||!session.accounts?.length} onChange={event=>{const id=event.target.value;void operation('Trocando conta...',async()=>{const result=await invoke('select_account',{account_id:id});setSession(result);setModels([]);setModel('');if(result.sharing)await loadModels();setNotice('Conta selecionada. As mensagens seguintes usar\u00e3o esta conta.');});}}>{!session.accounts?.length&&<option value="">Nenhuma conta adicionada</option>}{session.accounts?.map(account=><option key={account.id} value={account.id}>{account.label}{account.connected?'':' \u00b7 Desconectada'}</option>)}</select></label><div className="fdchat-account-actions"><button data-ai="add-account" disabled={busy} onClick={()=>connect(true)}>Adicionar conta ChatGPT</button>{session.client_id&&<button data-ai="reconnect" disabled={busy} onClick={()=>connect(false)}>Reconectar</button>}{!session.client_id&&(!session.connected||!session.sharing)&&<button data-ai="connect" data-oai-siwc-button disabled={busy} onClick={()=>connect(false)}>Continue with ChatGPT</button>}{session.connected&&<><button data-ai="usage" disabled={busy} onClick={()=>operation('',async()=>{await invoke('usage');})}>Gerenciar uso</button><button data-ai="disconnect" disabled={busy} onClick={disconnect}>Desconectar</button></>}{phase==='Conectando…'&&<button data-ai="cancel" onClick={()=>invoke('cancel')}>Cancelar conexão</button>}</div>{session.sharing&&<label className="fdchat-model-label">Modelo<select data-ai="model" value={model} onChange={event=>setModel(event.target.value)} disabled={busy}>{models.map(m=><option key={m.slug} value={m.slug}>{m.display_name||m.slug}</option>)}</select><button disabled={busy} onClick={()=>operation('',loadModels)}>Atualizar</button></label>}<p className="fdchat-privacy">Sua conversa, plano e configurações dos blocos são enviados. Prints, arquivos e valores de planilhas não são enviados automaticamente.</p></section></div></div>
   <button className="fdchat-new" onClick={newConversation} disabled={!store.ready}><Plus size={17}/>Nova conversa</button>
   <label className="fdchat-search"><Search size={15}/><input aria-label="Buscar conversas" placeholder="Buscar conversa" value={search} onChange={e=>setSearch(e.target.value)}/></label>
   <nav className="fdchat-threads" aria-label="Conversas salvas">{[...store.threads].sort((a,b)=>b.updatedAt-a.updatedAt).filter(t=>(t.title+' '+(t.automation?.name||'')).toLocaleLowerCase().includes(search.toLocaleLowerCase())).map(t=><div key={t.id} className="fdchat-thread" data-active={t.id===thread.id} data-chat-id={t.id}>
    {renaming===t.id?<input autoFocus aria-label="Nome da conversa" value={rename} onChange={e=>setRename(e.target.value)} onBlur={finishRename} onKeyDown={e=>{if(e.key==='Enter')finishRename();if(e.key==='Escape')setRenaming('');}}/>:<button className="fdchat-thread-select" aria-current={t.id===thread.id?'page':undefined} onClick={()=>choose(t.id)}><span>{t.title}</span><small>{t.id===requestThread?'Respondendo…':t.automation?.name||'Planejamento de automação'}</small></button>}
    <div className="fdchat-thread-actions"><button aria-label={`Renomear ${t.title}`} onClick={()=>{setRename(t.title);setRenaming(t.id);}}><Pencil size={13}/></button><button disabled={t.id===requestThread} aria-label={`Excluir ${t.title}`} onClick={()=>setDeleted(store.remove(t.id)||null)}><Trash2 size={13}/></button></div>
   </div>)}</nav>
   <footer>{store.error?<p role="alert">{store.error}</p>:<span>{!store.ready?'Carregando conversas…':store.saving?'Salvando…':'Salvo neste computador'}</span>}{deleted&&<div>Conversa excluída.<button onClick={()=>{store.undo(deleted);setDeleted(null);}}>Desfazer</button></div>}</footer>
  </aside><div className="fdchat-stage">
  <header className="fdchat-header"><button className="fdchat-history-toggle" aria-label="Histórico de conversas" aria-expanded={sidebar} onClick={()=>setSidebar(!sidebar)}><PanelLeft size={18}/></button><div className="fdchat-brand"><span className="fdchat-brand-symbol sync-chat-symbol" aria-hidden="true"><Bot size={26} strokeWidth={1.5}/></span><div><h2>Sync</h2><p title={session.sharing?"Conta conectada":"Conecte sua conta para começar"}><i data-connected={!!session.sharing}/>Assistente do Flow</p></div><span className="fdchat-beta">BETA</span></div><div className="fdchat-header-actions"><button type="button" data-ai="desktop-demonstration" disabled={busy} onClick={()=>{if(checkAutomation())void operation('Abrindo assistente no desktop…',async()=>{const started=performance.now();const result=await bridge.invoke('start_desktop_assistant',{});if(!matchMedia('(prefers-reduced-motion: reduce)').matches)await new Promise(resolve=>setTimeout(resolve,Math.max(0,1100-(performance.now()-started))));setNotice(result.message||'Assistente aberto. Demonstre uma ação por vez.');});}}><Plus size={15}/>Demonstrar no desktop</button>{undo?.threadId===thread.id&&<button type="button" disabled={busy} onClick={undoAssistant}>Desfazer edição</button>}{bridge.mountMap&&<button type="button" data-ai="workbench" aria-pressed={workbench} disabled={busy} onClick={()=>workbench?setWorkbench(false):openWorkbench()}><Layers3 size={16}/>{workbench?'Somente conversa':'Mapa + conversa'}</button>}</div></header>

  {workbench&&<><div className="fdchat-map-context"><span>{selectedBlock.order?`Analisando bloco ${selectedBlock.order}${selectedBlock.title?` ? ${selectedBlock.title}`:''}`:'Escolha um bloco no mapa ou descreva a primeira etapa.'}</span><button type="button" disabled={busy||!selectedBlock.order} onClick={()=>{setPrompt(`Me explique os campos e como configurar o bloco ${selectedBlock.order} que está aberto.`);input.current?.focus();const current=bridge.getEditorContext?.();if(current?.block_id)void operation('Mostrando os campos...',async()=>{await bridge.navigate?.({tab:'commands',block_id:current.block_id||undefined,order:current.order||undefined,title:`Como configurar o bloco ${selectedBlock.order}`,reason:'Vamos percorrer os controles reais deste bloco. Pode perguntar na conversa ao lado.',chat_id:thread.id});});}}>Tirar dúvida deste bloco</button></div></>}
  {thread.automation&&<div className="fdchat-automation"><span>Automação · <strong>{thread.automation.name}</strong></span>{mismatched&&<button disabled={busy} onClick={()=>operation('Abrindo automação…',async()=>{await bridge.openAutomation?.(thread.automation!.id);setNotice('Automação aberta. Você pode continuar esta conversa.');})}>Abrir automação <ArrowRight size={13}/></button>}</div>}
  <div className="fdchat-layout" data-preview={false}><main className="fdchat-conversation">
   <div className="fdchat-log" ref={log} role="log" aria-label="Conversa com o itsflow" aria-live="polite" aria-relevant="additions text" onScroll={()=>{if(log.current)nearBottom.current=log.current.scrollHeight-log.current.scrollTop-log.current.clientHeight<90;}}>
    {!messages.length?<section className="fdchat-welcome itsflow-universal-welcome"><p className="fdchat-eyebrow">ITSFLOW INTELLIGENCE</p><h3>O que vamos fazer hoje?</h3><p>Uma ideia, uma dúvida ou seu próximo fluxo.</p></section>:messages.map(m=><article key={m.id} className={`fdchat-message fdchat-message-${m.role}`} data-state={m.status}>{m.role==='assistant'&&<span className="fdchat-avatar"><img src="./assets/itsflow-mark.svg" alt="itsflow"/></span>}<div className="fdchat-message-content"><span className="fdchat-speaker">{m.role==='user'?'Você':'itsflow'}</span>{m.text&&(m.role==='user'?<p className="fdchat-user-text">{m.text}</p>:<GeneratedMessage text={m.text} animate={m.status==='complete'&&m.id===freshReply}/>)}
     {m.status==='pending'&&<span className="sr-only">Processando pedido</span>}
     {m.error&&<div className="fdchat-error" role="alert"><strong>{m.text?'A resposta foi interrompida':'Não foi possível concluir'}</strong><p>{m.error}</p>{m.error.includes('subscription_sharing_usage_limit_exceeded')&&<button disabled={busy} onClick={()=>operation('',async()=>{await invoke('usage');})}>Gerenciar uso no ChatGPT <ArrowRight size={14}/></button>}<small>Sua mensagem foi mantida no campo abaixo.</small></div>}
     {m.role==='assistant'&&m.status==='complete'&&<button className="fdchat-copy" aria-label="Copiar resposta" onClick={()=>copyMessage(m)}>{copied===m.id?<Check size={13}/>:<Copy size={13}/>}<span>{copied===m.id?'Copiado':'Copiar'}</span></button>}</div></article>)}
    {guide&&!!guide.questions.length&&<section className="fdchat-guide-questions" aria-label="Perguntas antes de continuar"><strong>Para continuar</strong>{guide.questions.map((question,index)=><button key={index} disabled={busy} onClick={()=>{setPrompt(question+'\nMinha resposta: ');input.current?.focus();}}>{question}<ArrowRight size={14}/></button>)}</section>}
    {guide&&workbench&&!!guide.steps.length&&<section className="fdchat-map-steps" aria-label="Etapas no mapa"><header><strong>No mapa</strong><button disabled={busy} onClick={()=>refreshGuidance()}>Conferir mapa</button></header>{guide.steps.filter(step=>step.block_id||step.kind==='manual').map((step,i)=><button key={step.id} disabled={busy} data-guide-step={step.id} onClick={()=>navigateStep(step)}><span>{String(i+1).padStart(2,'0')}</span><div><strong>{step.title}</strong><small>{step.block_id?`Abrir bloco ${step.source_order}`:step.instruction}</small></div><ArrowRight size={14}/></button>)}</section>}
   </div>
   <MorphOrbAndInput value={prompt} onChange={setPrompt} onSubmit={()=>void submit()} inputRef={input} busy={busy&&visualOperation} disabled={!store.ready||requestThread===thread.id} sendDisabled={!prompt.trim()||busy||!session.sharing||!model} status={phase} activityLabel={activityLabel} progress={progress} outcome={outcome} paused={!visible}/>
   <footer className="fdchat-composer-note">{session.connected&&<button type="button" className="fdchat-usage-link" data-ai="usage-footer" disabled={busy} title="Abre as configurações de uso na sua conta ChatGPT" onClick={()=>operation('',async()=>{await invoke('usage');})}>Ver uso no ChatGPT <ArrowRight size={12}/></button>}<span>Peça, pergunte e acompanhe por aqui.</span><span>Enter envia · Shift + Enter quebra a linha</span></footer>
  </main></div>
  {notice&&<output className="fdchat-notice" data-ai="status" role="status">{notice}</output>}
 </div></div></div>;
}
