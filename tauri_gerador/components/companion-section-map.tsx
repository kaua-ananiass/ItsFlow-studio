import {Check,Plus,RefreshCw} from 'lucide-react';

export type CompanionSection={id:string;name:string;page:string;engine?:string;blocks:{order:number;title:string;type?:string}[];insertion?:{allowed:boolean;reason:string;after_order?:number;orphan_orders:number[];edges:{source:number;target:number;label:string}[]}};
type Props={sections:CompanionSection[];selected?:string;label:string;disabled:boolean;loading:boolean;onSelect:(id:string)=>void;onRefresh:()=>void};
const point=(index:number)=>({x:12+(Math.floor(index/3)%2?2-index%3:index%3)*102,y:12+Math.floor(index/3)*86});

export function CompanionSectionMap({sections,selected,label,disabled,loading,onSelect,onRefresh}:Props){
 return <div className="companion-mini-map-wrap">
  <div className="companion-mini-map-toolbar"><span>Clique na seção do mapa</span><button type="button" title="Atualizar mapa" aria-label="Atualizar mapa" disabled={disabled||loading} onClick={onRefresh}><RefreshCw size={13} className={loading?'is-loading':''}/></button></div>
  <div className="companion-mini-map" role="group" aria-label="Miniatura do mapa de comandos" aria-busy={loading}>
   {loading&&!sections.length?<p role="status">Carregando mapa…</p>:sections.map((section,sectionIndex)=>{
    const active=selected===section.id,blocked=section.insertion?.allowed===false;
    const nodes=[...section.blocks.map(block=>({...block,isNew:false})),...(active&&!blocked?[{order:0,title:label,type:'novo',isNew:true}]:[])];
    const links=section.insertion?[...section.insertion.edges,...(active&&!blocked&&section.insertion.after_order?[{source:section.insertion.after_order,target:0,label:'Novo bloco'}]:[])]:nodes.slice(1).map((node,index)=>({source:nodes[index].order,target:node.order,label:''}));
    const height=24+Math.max(1,Math.ceil(nodes.length/3))*86;
    return <button type="button" className="companion-mini-map-section" data-engine={section.engine||'desktop'} data-blocked={blocked} title={section.insertion?.reason} key={section.id} aria-label={`Selecionar seção ${section.name}`} aria-pressed={active} disabled={disabled||loading||blocked} onClick={()=>onSelect(section.id)}>
     <span className="companion-mini-map-heading"><span><small>SEÇÃO {String(sectionIndex+1).padStart(2,'0')} · {section.engine==='chrome'?`CHROME · PÁGINA ${section.page}`:'DESKTOP'}</small><strong>{section.name}</strong></span><span>{active?<Check size={14}/>:<small>{section.blocks.length} blocos</small>}</span></span>
     <svg viewBox={`0 0 320 ${height}`} role="img" aria-label={`${section.blocks.length} blocos em ${section.name}`}>
      {links.map((edge,index)=>{
       const source=nodes.findIndex(node=>node.order===edge.source),target=nodes.findIndex(node=>node.order===edge.target);
       if(source<0)return null;
       const a=point(source);
       if(target<0)return <g key={`outside-${index}`}><path d={`M${a.x+44} ${a.y+62} v8`}/><text x={a.x+44} y={a.y+81} textAnchor="middle" className="mini-node-external">{edge.label} → {edge.target}</text></g>;
       const b=point(target),same=a.y===b.y,forward=b.x>a.x;
       const x1=same?a.x+(forward?88:0):a.x+44,y1=same?a.y+31:a.y+62;
       const x2=same?b.x+(forward?0:88):b.x+44,y2=same?b.y+31:b.y;
       return <path key={`line-${index}`} className={nodes[target].isNew?'is-new':''} d={same?`M${x1} ${y1} C${(x1+x2)/2} ${y1-12},${(x1+x2)/2} ${y2+12},${x2} ${y2}`:`M${x1} ${y1} C${x1} ${y1+12},${x2} ${y2-12},${x2} ${y2}`}/>;
      })}
      {nodes.map((node,index)=>{const {x,y}=point(index);return <g key={node.isNew?'new':node.order} transform={`translate(${x},${y})`} className={node.isNew?'is-new':section.insertion?.orphan_orders.includes(node.order)?'is-orphan':''}>
       <rect width="88" height="62" rx="7"/>
       <rect className="mini-node-number" x="5" y="5" width="17" height="11" rx="3"/>
       <text x="13.5" y="13" textAnchor="middle" className="mini-node-order">{node.isNew?'+':String(node.order).padStart(2,'0')}</text>
       <text x="27" y="13" className="mini-node-type">{node.isNew?'NOVO BLOCO':node.type?.includes('imagem')||node.type?.includes('ocr')?'RECONHECER':'BLOCO'}</text>
       <text x="7" y="31" className="mini-node-title">{node.title.slice(0,18)}{node.title.length>18?'…':''}</text>
       <rect className="mini-node-action" x="7" y="42" width="38" height="7" rx="3.5"/>
       <rect className="mini-node-detail" x="49" y="42" width="30" height="7" rx="3.5"/>
       <title>{node.title}</title>
      </g>;})}
      {!nodes.length&&<text x="160" y="49" textAnchor="middle" className="mini-map-empty">Seção vazia</text>}
     </svg>
     {section.insertion&&<span className="companion-insertion-status" role={blocked?'note':undefined}>{blocked?'Sem continuação livre · ':''}{section.insertion.reason}</span>}
    </button>;
   })}
   <button type="button" className="companion-mini-map-new" aria-pressed={selected==='__new__'} disabled={disabled||loading} onClick={()=>onSelect('__new__')}><Plus size={14}/>Nova seção{selected==='__new__'&&<Check size={13}/>}</button>
   {selected==='__new__'&&<p className="companion-mode-help">A nova seção será independente. Conecte uma saída livre de outro bloco a ela no mapa para incluí-la no fluxo.</p>}
  </div>
 </div>;
}
