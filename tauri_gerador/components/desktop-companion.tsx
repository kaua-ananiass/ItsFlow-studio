import {useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ArrowUp,ArrowRight,Camera,ScanLine,Check,ChevronDown,Minus,MousePointer2,RefreshCw,Settings2,Trash2,X} from 'lucide-react';
import {AIThinkingOrb} from './ui/ai-thiking-orb-and-input';
import {GeneratedMessage} from './generated-message';
import {CompanionTests,type TestResult} from './companion-tests';
import {CompanionActionBuilder} from './companion-action-builder';
import {CompanionStepBuilder,type CompanionStep,type CompanionSection} from './companion-step-builder';

type Step=CompanionStep;
type Snapshot={testing?:boolean;test_result?:TestResult;sections?:CompanionSection[];target_section?:string;id?:string;open:boolean;armed?:boolean;busy:boolean;capturing?:boolean;error?:string;status:string;automation?:{name:string};events:Step[];messages:{role:string;content:string}[];pending?:string;imported?:boolean;last_saved?:{id:string;count:number}};
const initial:Snapshot={open:false,busy:false,status:'Seu assistente de automações',events:[],messages:[]};
const tauri=(window as any).__TAURI__;
function Companion(){
 const [state,setState]=useState<Snapshot>(initial),[text,setText]=useState(''),[settings,setSettings]=useState(false),[history,setHistory]=useState(false),[error,setError]=useState(''),[settling,setSettling]=useState(false),[sending,setSending]=useState(false),[closing,setClosing]=useState(false);
 const [savedFeedback,setSavedFeedback]=useState(false);
 const [view,setView]=useState<'build'|'tests'>('build'),[localTest,setLocalTest]=useState<number>();

 const previous=useRef<Snapshot>(initial),timer=useRef<ReturnType<typeof setTimeout>|null>(null),log=useRef<HTMLDivElement>(null),live=useRef(true),commandQueue=useRef<Promise<void>>(Promise.resolve()),eventVersion=useRef(0);
 function apply(next:Snapshot){
  if(!live.current)return;
  const before=previous.current;
  if(timer.current&&(before.busy!==next.busy||next.error)){clearTimeout(timer.current);timer.current=null;}
  if(before.busy&&!next.busy&&!next.error&&!before.testing){setSettling(true);setSavedFeedback(!!next.last_saved&&next.id!==before.id);timer.current=setTimeout(()=>{setSettling(false);setSavedFeedback(false);},matchMedia('(prefers-reduced-motion: reduce)').matches?1:1000);}
  else if(next.busy||next.error){setSettling(false);setSavedFeedback(false);}
  if(before.pending!==next.pending||before.id!==next.id){setSettings(false);setHistory(false);setText('');}
  previous.current=next;setState(next);setSending(false);setError('');setClosing(false);
 }
 async function command(op:string,extra:Record<string,unknown>={}){
  const job=commandQueue.current.catch(()=>{}).then(async()=>{
   setError('');
   try{if(['collapse','close','arm','capture'].includes(op)&&!matchMedia('(prefers-reduced-motion: reduce)').matches){setClosing(true);await new Promise(resolve=>setTimeout(resolve,180));}await tauri.core.invoke('desktop_assistant_action',{request:{op,...extra}});}catch(error){setError(String(error));setSending(false);setClosing(false);}
  });commandQueue.current=job;await job;
 }

 useEffect(()=>{
  live.current=true;let off:(()=>void)|undefined,reset:(()=>void)|undefined;
  async function refresh(){const version=eventVersion.current;try{const current=await tauri.core.invoke('desktop_assistant_action',{request:{op:'status'}});if(version===eventVersion.current)apply(current);}catch(error){if(live.current)setError(String(error));}}
  void(async()=>{off=await tauri.event.listen('desktop-assistant-state',(event:any)=>{eventVersion.current++;apply(event.payload);});reset=await tauri.event.listen('desktop-assistant-reset',()=>{setState(initial);previous.current=initial;void refresh();});if(!live.current){off?.();reset?.();return;}await refresh();})();
  return()=>{live.current=false;off?.();reset?.();if(timer.current)clearTimeout(timer.current);};
 },[]);
 useEffect(()=>{log.current?.scrollTo({top:state.pending&&!settings?0:log.current.scrollHeight,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});},[state.messages.length,state.messages.at(-1)?.content,settings,settling,state.pending]);
 const testing=!!state.testing||localTest!==undefined;
 const pending=state.events.find(step=>step.id===state.pending),last=state.messages.at(-1),busy=state.busy||!!state.capturing||settling||sending||testing;
 const currentStep=pending||state.events.at(-1);
 const canContinue=!state.capturing&&(!pending?.requires_confirmation||!!pending.confirmed)&&!state.imported&&!state.busy&&(!pending||!!pending.description)&&(pending?.kind!=='desktop_text'||!!pending.value?.trim());
 const canCapture=canContinue&&!currentStep?.kind.startsWith('manual_');
 const thinking=!testing&&(state.busy||settling||sending);
 const currentError=error||state.error||'';
 const incompatibleControl=/Controle do assistente inv[aá]lido/i.test(currentError);
 const chatLimit=currentError.includes('subscription_sharing_usage_limit_exceeded');
 const mapError=!!currentError&&!incompatibleControl&&!chatLimit&&(currentStep?.builder_stage??0)>=3;
 const retry=()=>void command(mapError?'map_sections':'retry');
 function submit(){if(!text.trim()||busy)return;const message=text.trim();setText('');setSending(true);void command('explain',{text:message});}
 return <div className="companion-notch-stage" data-expanded={state.open} data-phase={testing?'testing':state.capturing?'capturing':thinking?'thinking':state.imported?'complete':'ready'}>
  <div className="companion-notch" data-capturing={!!state.capturing}>
   <button className="companion-notch-main" aria-label={state.open?'Recolher assistente':'Abrir mini assistente'} disabled={!!state.capturing||testing} onClick={()=>void command(state.open?'collapse':'open')}><AIThinkingOrb active={testing||!state.imported&&!savedFeedback} completed={!testing&&(settling||!!state.imported||(view==='tests'&&!!state.test_result?.ok))} status={state.capturing?'Capturando área…':''} size={46}/><span><strong>Sync</strong><small aria-live="polite">{testing?`Testando${localTest?` bloco ${localTest}`:''}…`:state.test_result&&view==='tests'?state.test_result.ok?'Alvo encontrado':'Teste não confirmado':state.capturing?'Capturando área…':savedFeedback?'Salvo no mapa':thinking?'Pensando…':state.imported?'Salvo no mapa':state.last_saved&&!currentStep?'Próxima área':'Assistente do Flow'}</small></span></button>
   <button className="companion-notch-capture" aria-label="Selecionar área pelo notch" title="Selecionar uma área" disabled={busy||!canCapture} onClick={()=>void command('capture')}>{state.capturing?<ScanLine size={16}/>:<Camera size={15}/>}</button>
  </div>
  {state.open&&<main className="companion-card" data-closing={closing} data-phase={thinking?'thinking':state.error||error?'error':'ready'}>
  <header className="companion-header"><nav className="companion-main-tabs" aria-label="Área do assistente"><button aria-pressed={view==='build'} disabled={busy} onClick={()=>setView('build')}>Construir</button><button aria-pressed={view==='tests'} disabled={busy} onClick={()=>setView('tests')}>Testar blocos</button></nav><div><button title="Recolher" aria-label="Recolher assistente" onClick={()=>void command('collapse')}><Minus size={15}/></button><button title="Fechar" aria-label="Fechar assistente" onClick={()=>void command('close')}><X size={15}/></button></div></header>
  <section className="companion-body" ref={log}>
   {view==='tests'?<CompanionTests busy={busy} result={state.test_result} onTesting={order=>setLocalTest(order)} onFinished={()=>setLocalTest(undefined)}/>:<>
   {thinking?<div className="companion-thinking" key="thinking" role="status" data-completed={settling}><div className="companion-halo"/><AIThinkingOrb active={!settling} completed={settling} size={160}/><p>{settling?<><Check size={13}/>Entendi sua etapa</>:state.status||'Pensando…'}</p><small>{settling?'Vamos construir juntos.':'Conectando sua ação ao próximo passo.'}</small></div>:currentStep?<>{(!currentStep.kind.startsWith('manual_')||state.messages.some(message=>message.role==='user'))&&last?.role==='assistant'&&<div className="companion-builder-advice"><GeneratedMessage text={last.content} animate/></div>}{history&&<div className="companion-answer">{state.messages.slice(0,-1).map((message,index)=><article key={index} data-role={message.role}><GeneratedMessage text={message.content}/></article>)}</div>}{currentStep.kind.startsWith('manual_')?<CompanionActionBuilder step={currentStep} sections={state.sections||[]} targetSection={state.target_section} disabled={busy} command={command}/>:<CompanionStepBuilder sections={state.sections} targetSection={state.target_section} key={currentStep.id} step={currentStep} index={state.events.length} disabled={busy} editable={!!pending&&!state.imported} saved={!!state.imported} command={command}/>}</>:<>
    {!pending&&!state.events.length?<div className="companion-welcome"><AIThinkingOrb size={100}/><h1>Vamos fazer juntos?</h1><p>Selecione uma área, escolha a ação<br/>e veja seu bloco ganhar forma.</p><div className="companion-start-choices" aria-label="Como criar seu bloco">{[['manual_text','Texto'],['manual_keys','Tecla'],['manual_sheet','Planilha']].map(([kind,label])=><button key={kind} disabled={busy} onClick={()=>void command('create',{kind})}>{label}<ArrowRight size={13}/></button>)}<button disabled={busy} onClick={()=>void command('capture')}><Camera size={13}/>Reconhecer uma área</button></div></div>:<div className="companion-context"><span className="companion-dot"/><span>{state.imported?'Salvo no mapa':pending?'Vamos entender esta etapa':'Pronto para o próximo passo'}</span></div>}
    {!!state.messages.length&&<div className="companion-answer" key={last?.content}>
     {history?state.messages.map((message,index)=><article key={index} data-role={message.role}><small>{message.role==='user'?'Você':'itsflow'}</small><GeneratedMessage text={message.content}/></article>):last?.role==='assistant'?<GeneratedMessage text={last.content} animate={!!pending||!!state.events.length}/>:<p className="companion-user-text">{last?.content}</p>}
    </div>}
   </>}
   {settings&&!thinking&&<section className="companion-settings" aria-label="Rascunho da automação"><div className="companion-settings-heading"><span>{state.events.length} etapas no rascunho</span><button aria-label="Fechar configuração" onClick={()=>setSettings(false)}><X size={13}/></button></div>
    <ol className="companion-draft-list">{state.events.map((step,index)=><li key={step.id}><span>{String(index+1).padStart(2,'0')}</span><strong>{step.label}</strong><small>{step.confirmed?'Confirmado':'Em construção'}</small></li>)}</ol>
    <div className="companion-setting-actions"><button disabled={state.busy||!state.events.length||state.imported} onClick={()=>void command('undo')}><Trash2 size={12}/>Descartar última</button><button disabled={state.busy} onClick={()=>void command('refresh')}><RefreshCw size={12}/>Atualizar destino</button></div>
    <button className="companion-save" disabled={!canContinue||!state.events.length||!state.target_section} onClick={()=>void command('import')}>Enviar etapas ao mapa<ArrowRight size={13}/></button>
   </section>}
  </>}
  </section>
  {currentError&&<div className="companion-error" role="alert"><p>{incompatibleControl?'O Studio aberto está com uma versão anterior do controle do assistente. Feche o Studio por completo e abra novamente a versão atualizada. Seu rascunho está salvo.':chatLimit?'O limite do ChatGPT foi atingido. Você pode continuar capturando, configurando e enviando blocos ao mapa sem IA. Use o chat novamente após a renovação do limite.':currentError}</p>{pending&&!incompatibleControl&&(chatLimit?<button disabled={state.busy} onClick={()=>void command('edit')}>Continuar sem IA<ArrowRight size={12}/></button>:<button disabled={state.busy} onClick={retry}>{mapError?'Atualizar mapa':'Tentar pergunta novamente'}<RefreshCw size={12}/></button>)}</div>}
  {view==='build'&&<footer className="companion-footer">
   <form className="companion-composer" data-sending={sending} onSubmit={event=>{event.preventDefault();submit();}}><textarea aria-label="Mensagem ao mini assistente" placeholder={pending?'Conte o que essa ação faz…':'O que você quer automatizar?'} rows={2} value={text} maxLength={4000} disabled={busy} onChange={event=>setText(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();submit();}}}/><button type="submit" aria-label="Enviar mensagem" disabled={busy||!text.trim()}><ArrowUp size={17}/></button></form>
   <div className="companion-toolbar"><div><button aria-label="Configurar etapa" title="Rascunho e configuração" aria-pressed={settings} disabled={busy} onClick={()=>setSettings(!settings)}><Settings2 size={15}/><span>{state.events.length?`${state.events.length} etapas`:'Ajustes'}</span></button><button aria-label="Selecionar região" title="Selecionar uma área da tela" disabled={busy||!canCapture} onClick={()=>void command('capture')}><Camera size={15}/></button><button aria-label="Histórico da conversa" title="Ver conversa" disabled={busy} onClick={()=>{setHistory(!history);}}><ChevronDown size={15}/></button></div><button className="companion-next" disabled={!canCapture||busy} onClick={()=>void command('capture')}><span>{state.events.length?'Próxima área':'Selecionar área'}</span><MousePointer2 size={13}/></button></div>
  </footer>}
 </main>}</div>;
}
createRoot(document.getElementById('companion-root')!).render(<Companion/>);
