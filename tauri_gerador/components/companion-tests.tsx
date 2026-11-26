import {useEffect,useState} from 'react';
import {ArrowLeft,Check,ChevronRight,Eye,Play,RefreshCw} from 'lucide-react';

export type TestResult={ok:boolean;order:number;mode:string;revision?:string;error?:string;log?:string;results?:{text:string;found:boolean}[]};
type Block={order:number;id:string;type:string;title:string;image:string;text:string;keys:string[];test_screen:boolean;test_chrome:boolean;sheet:string;column:string};
type Section={id:string;name:string;engine:string;blocks:Block[]};
type Catalog={revision:string;sections:Section[]};
type Props={busy:boolean;result?:TestResult;onTesting:(order:number)=>void;onFinished:()=>void};
const tauri=(window as any).__TAURI__;
function Preview({block}:{block:Block}){
 const [src,setSrc]=useState(''),[failed,setFailed]=useState(false);
 useEffect(()=>{let active=true;setSrc('');setFailed(false);if(block.image)void tauri.core.invoke('get_recognition_image_preview',{imageId:block.image.replaceAll('\\','/').split('/').at(-1)}).then((data:any)=>{if(active)setSrc(data.src);}).catch(()=>{if(active)setFailed(true);});return()=>{active=false;};},[block.image]);
 return <div className="companion-test-preview">{block.image?(src?<img src={src} alt={`Referência do bloco ${block.order}`}/>:<small>{failed?'Imagem indisponível':'Carregando prévia…'}</small>):<pre>{block.type==='texto_livre'?block.text:block.keys?.length&&['tecla','atalho'].includes(block.type)?block.keys.join(' + '):block.column?`${block.sheet}\n${block.column}`:block.text||block.title}</pre>}</div>;
}
export function CompanionTests({busy,result,onTesting,onFinished}:Props){
 const [catalog,setCatalog]=useState<Catalog>(),[selected,setSelected]=useState<number>(),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const block=catalog?.sections.flatMap(s=>s.blocks).find(b=>b.order===selected);
 const section=catalog?.sections.find(s=>s.blocks.some(b=>b.order===selected));
 const [mode,setMode]=useState('screen');
 async function refresh(){setLoading(true);setError('');try{const data=await tauri.core.invoke('desktop_assistant_action',{request:{op:'test_catalog'}});setCatalog(data);setSelected(undefined);}catch(e){setError(String(e));}finally{setLoading(false);}}
 useEffect(()=>{void refresh();},[]);
 async function test(){
  if(!block||!catalog||busy)return;setError('');onTesting(block.order);
  try{await tauri.core.invoke('desktop_assistant_action',{request:{op:'test_block',revision:catalog.revision,order:block.order,block_id:block.id,mode}});}catch(e){setError(String(e));}finally{onFinished();}
 }
 function choose(next:Block,scope:Section){setSelected(next.order);setMode(scope.engine==='chrome'&&next.test_chrome?'chrome':next.test_screen?'screen':'chrome');}
 return <section className="companion-tests" aria-label="Testes dos blocos">
  <div className="companion-tests-heading"><div><small>SUA AUTOMAÇÃO</small><h2>{block?`Bloco ${String(block.order).padStart(2,'0')}`:'Testar blocos'}</h2></div><button aria-label="Atualizar blocos" title="Atualizar blocos" disabled={loading||busy} onClick={()=>void refresh()}><RefreshCw size={15}/></button></div>
  {loading&&<p role="status">Carregando seções e blocos…</p>}
  {!block?catalog?.sections.map(scope=><section className="companion-test-section" key={scope.id}><header><strong>{scope.name}</strong><small>{scope.engine==='chrome'?'Chrome':'Desktop'} · {scope.blocks.length}</small></header><div className="companion-test-grid">{scope.blocks.map(item=><button className="companion-test-card" key={item.order} disabled={busy} onClick={()=>choose(item,scope)}><span className="companion-test-number">{String(item.order).padStart(2,'0')}</span><Preview block={item}/><strong>{item.title}</strong><small>{item.test_screen||item.test_chrome?<><Eye size={11}/>Reconhecimento</>:'Ver bloco'}<ChevronRight size={12}/></small></button>)}</div>{!scope.blocks.length&&<p className="companion-mode-help">Seção vazia</p>}</section>):<>
   <button className="companion-test-back" disabled={busy} onClick={()=>setSelected(undefined)}><ArrowLeft size={13}/>Todas as seções</button>
   <article className="companion-test-detail"><header><strong>{block.title}</strong><small>{section?.name}</small></header><Preview block={block}/>{block.text&&!['texto_livre','tecla','atalho'].includes(block.type)&&<p>{block.text}</p>}</article>
   {block.test_screen||block.test_chrome?<><div className="companion-test-modes" role="group" aria-label="Onde testar">{block.test_screen&&<button aria-pressed={mode==='screen'} disabled={busy} onClick={()=>setMode('screen')}>Na tela</button>}{block.test_chrome&&<button aria-pressed={mode==='chrome'} disabled={busy} onClick={()=>setMode('chrome')}>No Chrome</button>}</div><p className="companion-mode-help">Deixe o alvo visível. {mode==='screen'&&block.image&&block.text?'O texto e a imagem, incluindo os símbolos, precisam corresponder. ':''}O painel recolhe durante a busca. Este teste apenas localiza e destaca, sem clicar ou digitar.</p><button className="companion-confirm" disabled={busy||loading} onClick={()=>void test()}><Play size={13}/>Testar reconhecimento</button></>:<p className="companion-mode-help">Prévia do bloco salvo. O teste isolado está disponível para reconhecimentos; texto, teclas e planilha são executados no fluxo do Studio.</p>}
  </>}
  {result&&(!result.revision||result.revision===catalog?.revision)&&(!block||result.order===block.order)&&<div className="companion-test-result" role="status" data-ok={result.ok}><strong>{result.ok?<Check size={14}/>:<Eye size={14}/>}Bloco {result.order}: {result.ok?'alvo encontrado':'teste não confirmado'}</strong>{result.error&&<p>{result.error}</p>}{result.results?.map((item,i)=><p key={i}>{item.found?'✓':'—'} {item.text}</p>)}{result.log&&<details><summary>Detalhes do teste</summary><pre>{result.log}</pre></details>}</div>}
  {error&&<div className="companion-error" role="alert">{error}</div>}
 </section>;
}
