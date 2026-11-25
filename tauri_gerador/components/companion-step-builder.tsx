import {useEffect,useRef,useState,type MouseEvent,type PointerEvent} from 'react';
import {Check,MousePointer2,Scan,ShieldCheck,TextCursorInput} from 'lucide-react';
import {CompanionSectionMap,type CompanionSection} from './companion-section-map';
export type {CompanionSection} from './companion-section-map';

export type CompanionStep={id:string;kind:string;label:string;description?:string;value?:string;image?:{data_url:string};clicks?:number;on_success?:string;on_failure?:string;anchor_x?:number;anchor_y?:number;confirmed?:boolean;requires_confirmation?:boolean;suggestion?:string;builder_stage?:number;recognition?:'image'|'ocr';text?:string;ocr_region?:Region};
type Region={x:number;y:number;width:number;height:number};
type Mode='clique1'|'clique2'|'reconhecer'|'validacao'|'texto';
const choices:{mode:Mode;name:string;kind:string;clicks:number;hint:string}[]=[
 {mode:'clique1',name:'1 clique',kind:'desktop_click',clicks:1,hint:'Reconhecer o alvo e clicar uma vez.'},
 {mode:'clique2',name:'2 cliques',kind:'desktop_click',clicks:2,hint:'Reconhecer o alvo e dar um duplo clique.'},
 {mode:'reconhecer',name:'Reconhecer',kind:'observe',clicks:1,hint:'Apenas localizar e confirmar a imagem, sem clicar.'},
 {mode:'validacao',name:'Validação',kind:'desktop_validation',clicks:1,hint:'Conferir um caso específico, sem clicar. Defina o que ocorre em cada resultado.'},
 {mode:'texto',name:'Preencher campo',kind:'desktop_text',clicks:1,hint:'Reconhecer e clicar no campo, depois preencher o texto ou variável.'},
];
const modeOf=(step:CompanionStep):Mode=>step.kind==='desktop_validation'?'validacao':step.kind==='desktop_text'?'texto':step.kind==='observe'?'reconhecer':step.clicks===2?'clique2':'clique1';

type Props={sections?:CompanionSection[];targetSection?:string;step:CompanionStep;index:number;disabled:boolean;editable:boolean;saved?:boolean;command:(op:string,extra?:Record<string,unknown>)=>Promise<void>};
export function CompanionStepBuilder({step,index,disabled,editable,saved=false,command,sections=[],targetSection}:Props){
 const [mode,setMode]=useState<Mode>(modeOf(step)),[label,setLabel]=useState(step.label),[purpose,setPurpose]=useState(step.description||''),[value,setValue]=useState(step.value||''),[success,setSuccess]=useState(step.on_success||'continuar'),[failure,setFailure]=useState(step.on_failure||'parar'),[anchor,setAnchor]=useState({x:step.anchor_x??.5,y:step.anchor_y??.5}),[dirty,setDirty]=useState(false);
 const image=useRef<HTMLImageElement>(null),choice=choices.find(item=>item.mode===mode)!;
 const [stage,setStage]=useState(step.confirmed?(targetSection?4:3):step.builder_stage??0),[recognition,setRecognition]=useState<'image'|'ocr'>(step.recognition||'image'),[ocrText,setOcrText]=useState(step.text||''),[region,setRegion]=useState<Region>(step.ocr_region||{x:0,y:0,width:1,height:1}),[marking,setMarking]=useState(false);
 const [mapLoading,setMapLoading]=useState(false);
 async function refreshMap(){setMapLoading(true);try{await command('map_sections');}finally{setMapLoading(false);}}
 useEffect(()=>{if(stage===3)void refreshMap();},[stage]);
 const origin=useRef<{x:number;y:number}|null>(null),suppressClick=useRef(false);
 useEffect(()=>{setPurpose(step.description||'');},[step.description]);
 useEffect(()=>{if(step.confirmed)setDirty(false);},[step.confirmed]);
 const confirmed=!!step.confirmed&&!dirty,clicks=choice.kind==='desktop_click'||choice.kind==='desktop_text';
 function payload(extra:Record<string,unknown>={}){return {kind:choice.kind,clicks:choice.clicks,label,description:purpose,value,on_success:success,on_failure:failure,anchor_x:anchor.x,anchor_y:anchor.y,recognition,text:ocrText,ocr_region:region,builder_stage:stage,...extra};}
 function advance(next:number){setStage(next);void command('edit',payload({builder_stage:next}));}
 function choose(next:Mode){
  const selected=choices.find(item=>item.mode===next)!;setMode(next);setDirty(true);
  const found=next==='validacao'?'parar':'continuar',missing=next==='validacao'?'continuar':'parar';setSuccess(found);setFailure(missing);
  setStage(1);void command('edit',payload({kind:selected.kind,clicks:selected.clicks,on_success:found,on_failure:missing,builder_stage:1}));
 }
 function pickPoint(event:MouseEvent<HTMLButtonElement>){
  if(suppressClick.current){suppressClick.current=false;return;}
  const element=image.current;if(!element||!clicks||!editable||disabled||marking||stage!==2)return;
  const rect=element.getBoundingClientRect(),scale=Math.min(rect.width/element.naturalWidth,rect.height/element.naturalHeight),width=element.naturalWidth*scale,height=element.naturalHeight*scale;
  const x=(event.clientX-rect.left-(rect.width-width)/2)/width,y=(event.clientY-rect.top-(rect.height-height)/2)/height;
  if(x<0||x>1||y<0||y>1)return;
  setAnchor({x,y});setDirty(true);void command('edit',payload({anchor_x:x,anchor_y:y}));
 }
 function point(event:PointerEvent){const rect=image.current!.getBoundingClientRect();return {x:Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width)),y:Math.max(0,Math.min(1,(event.clientY-rect.top)/rect.height))};}
 function draw(event:PointerEvent<HTMLButtonElement>,end=false){
  if(!marking||!origin.current||!image.current)return;
  const next=point(event),start=origin.current,box={x:Math.min(start.x,next.x),y:Math.min(start.y,next.y),width:Math.abs(start.x-next.x),height:Math.abs(start.y-next.y)};
  if(box.width>.01&&box.height>.01){setRegion(box);setDirty(true);if(end)void command('edit',payload({ocr_region:box}));}
  if(end){origin.current=null;setMarking(false);}
 }
 const suggested=choices.find(item=>item.mode===step.suggestion);
 return <section className="companion-builder" aria-label="Bloco em construção" data-confirmed={confirmed} data-stage={stage}>
  <div className="companion-stage-heading"><small>ETAPA {stage+1} DE 5</small><h2>{['O que fazer nesta área?','Qual é a finalidade?','Como reconhecer o alvo?','Onde colocar o bloco?','Pronto para o mapa'][stage]}</h2>{stage>0&&editable&&<button disabled={disabled} onClick={()=>advance(stage-1)}>Voltar</button>}</div>
  {stage===3&&<div className="companion-sections"><CompanionSectionMap sections={sections} selected={targetSection} label={label} disabled={disabled} loading={mapLoading} onSelect={id=>void command('destination',{target_section:id})} onRefresh={()=>void refreshMap()}/><button className="companion-confirm" disabled={disabled||mapLoading||!targetSection||targetSection!=='__new__'&&!sections.some(section=>section.id===targetSection)} onClick={()=>advance(4)}>Revisar destino</button></div>}
  {stage===0&&<>{step.image&&<img className="companion-selection-preview" src={step.image.data_url} alt="Área selecionada"/>}<div className="companion-mode-choices" role="group" aria-label="Finalidade do recorte">{choices.map(item=><button type="button" key={item.mode} disabled={disabled||!editable} title={item.hint} onClick={()=>choose(item.mode)}>{item.mode==='validacao'?<ShieldCheck size={12}/>:item.mode==='reconhecer'?<Scan size={12}/>:item.mode==='texto'?<TextCursorInput size={12}/>:<MousePointer2 size={12}/>}<span>{item.name}</span></button>)}</div>
  {suggested&&editable&&<button className="companion-suggestion" disabled={disabled} onClick={()=>choose(suggested.mode)}>IA sugere: {suggested.name}<span>Escolher</span></button>}</>}
  {(stage===2||stage===4)&&<>
  {stage===2&&<><p className="companion-mode-help">Use a imagem ou confira também o texto que aparece nela.</p><label className="companion-inline-value">Reconhecimento<select aria-label="Tipo de reconhecimento" value={recognition} disabled={disabled||!editable} onChange={event=>{const next=event.target.value as 'image'|'ocr';setRecognition(next);setDirty(true);void command('edit',payload({recognition:next}));}}><option value="image">Somente imagem</option><option value="ocr">Imagem + texto OCR</option></select></label>{recognition==='ocr'&&<><label className="companion-inline-value">Texto que deve aparecer<input aria-label="Texto esperado no OCR" value={ocrText} maxLength={500} placeholder="Ex.: Operação concluída" onChange={event=>{setOcrText(event.target.value);setDirty(true);}} onBlur={()=>void command('edit',payload())}/></label><button className="companion-ocr-adjust" aria-pressed={marking} onClick={()=>setMarking(!marking)}>{marking?'Arraste sobre o texto na imagem':'Ajustar região do OCR'}</button></>}</>}
  <article className="companion-block-mini" aria-label="Prévia do bloco real">
   <header><span>{String(index).padStart(2,'0')}</span><strong>{mode==='validacao'?'VALIDAÇÃO':'RECONHECIMENTO'}</strong><small>{saved?<><Check size={10}/>No mapa</>:confirmed?<><Check size={10}/>No rascunho</>:'Em construção'}</small></header>
   <strong className="companion-review-title">{label}</strong>
   {step.image&&<button className="companion-block-image" data-marking={marking} title={marking?'Arraste para marcar o texto':clicks?'Clique na imagem para ajustar o ponto da ação':'Só reconhecimento. Nenhum clique será executado.'} disabled={disabled||!editable||stage!==2||(!clicks&&!marking)} aria-label="Definir ponto do clique" onClick={pickPoint} onPointerDown={event=>{if(marking&&image.current){suppressClick.current=true;origin.current=point(event);event.currentTarget.setPointerCapture(event.pointerId);event.preventDefault();}}} onPointerMove={event=>draw(event)} onPointerUp={event=>draw(event,true)} onPointerCancel={()=>{origin.current=null;suppressClick.current=false;setMarking(false);}}>
    <span className="companion-image-surface"><img ref={image} src={step.image.data_url} alt="Área selecionada para o bloco" onLoad={()=>{if(image.current){const img=image.current;img.parentElement?.style.setProperty('--image-ratio',String(img.naturalWidth/img.naturalHeight));}}}/>
    {recognition==='ocr'&&<i className="companion-ocr-region" style={{left:`${region.x*100}%`,top:`${region.y*100}%`,width:`${region.width*100}%`,height:`${region.height*100}%`}}/>}{clicks&&<i className="companion-anchor" style={{left:`${anchor.x*100}%`,top:`${anchor.y*100}%`}}><MousePointer2 size={11}/></i>}</span><span className="companion-image-action">{clicks?choice.clicks===2?'2 CLIQUES':mode==='texto'?'CLIQUE + TEXTO':'1 CLIQUE':'SEM CLIQUE'}</span>
   </button>}
   {stage===4&&<div className="companion-block-flows"><div><small>SE ENCONTRAR</small><strong>{success==='parar'?'Parar automação':mode==='texto'?'Clicar e preencher':clicks?`${choice.clicks===2?'2 cliques':'1 clique'} e continuar`:'Reconhecer e continuar'}</strong></div><div><small>SE NÃO ENCONTRAR</small><strong>{failure==='parar'?'Parar automação':'Continuar sem clicar'}</strong></div></div>}
  </article>
  {stage===4&&<><p className="companion-mode-help">{purpose}</p>{recognition==='ocr'&&<p className="companion-mode-help">OCR: {ocrText}</p>}{mode==='texto'&&<p className="companion-mode-help">Preencher: {value}</p>}</>}
  </>}
  {stage===1&&<><p className="companion-mode-help">{choice.hint}</p><label className="companion-inline-value">Nome do bloco<input aria-label="Nome do bloco" value={label} maxLength={100} onChange={event=>{setLabel(event.target.value);setDirty(true);}}/></label>
  <label className="companion-purpose">Finalidade<input aria-label="Finalidade do bloco" value={purpose} maxLength={1000} placeholder="Descreva aqui ou explique no chat…" disabled={disabled||!editable} onChange={event=>{setPurpose(event.target.value);setDirty(true);}} onBlur={()=>{if(editable)void command('edit',payload());}}/></label>
  {mode==='texto'&&<label className="companion-inline-value">Texto ou variável para preencher<input aria-label="Texto ou variável" value={value} maxLength={400} onChange={event=>{setValue(event.target.value);setDirty(true);}}/></label>}
  {mode==='validacao'&&<div className="companion-validation-rules"><label>Quando aparecer<select aria-label="Validação encontrada" value={success} onChange={event=>{setSuccess(event.target.value);setDirty(true);}}><option value="parar">Parar automação</option><option value="continuar">Continuar</option></select></label><label>Se não aparecer<select aria-label="Validação ausente" value={failure} onChange={event=>{setFailure(event.target.value);setDirty(true);}}><option value="continuar">Continuar</option><option value="parar">Parar automação</option></select></label></div>}
  <button className="companion-confirm" disabled={disabled||!purpose.trim()||mode==='texto'&&!value.trim()} onClick={()=>advance(2)}>Continuar para reconhecimento</button></>}
  {editable&&stage===2&&<button className="companion-confirm" disabled={disabled||recognition==='ocr'&&!ocrText.trim()} onClick={()=>void command('confirm',payload({builder_stage:3})).then(()=>{setDirty(false);setStage(3);})}><Check size={13}/>Concluir etapa</button>}
  {stage===4&&<p className="companion-mode-help">Destino: {targetSection==='__new__'?'Nova seção':sections.find(section=>section.id===targetSection)?.name||'Escolha uma seção'}</p>}
  {stage===4&&!saved&&editable&&confirmed&&<button className="companion-confirm" disabled={disabled||!targetSection||targetSection!=='__new__'&&!sections.some(section=>section.id===targetSection)} onClick={()=>void command('import')}><Check size={13}/>Enviar etapas ao mapa</button>}
 </section>;
}
