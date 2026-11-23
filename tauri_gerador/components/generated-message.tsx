import {useEffect,useMemo,useRef,useState,type CSSProperties} from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Reveal the completed Markdown as words, preserving its formatting and layout.
// This is presentation only: the saved answer and copy action keep the full text.
function revealWords(){
 return (tree:any)=>{
  let index=0;
  function visit(node:any){
   if(!Array.isArray(node.children))return;
   node.children=node.children.flatMap((child:any)=>{
    if(child.type!=='text'){visit(child);return [child];}
    return (child.value.match(/\s+|\S+/gu)||[]).map((part:string)=>/^\s+$/u.test(part)?{type:'text',value:part}:{type:'element',tagName:'span',properties:{className:['itsflow-generated-word'],style:`animation-delay:calc(var(--word-step) * ${index++})`},children:[{type:'text',value:part}]});
   });
  }
  visit(tree);
 };
}
const components={a:({children}:any)=><span className="fdchat-link-text">{children}</span>,img:()=>null};

export function GeneratedMessage({text,animate=false}:{text:string;animate?:boolean}){
 const element=useRef<HTMLDivElement>(null),[phase,setPhase]=useState<'waiting'|'running'|'done'>(animate?'waiting':'done');
 const words=text.match(/\S+/gu)?.length||1,duration=Math.min(1800,Math.max(280,words*12));
 const plugins=useMemo(()=>animate?[revealWords]:[],[animate]);
 useEffect(()=>{
  if(!animate){setPhase('done');return;}
  const media=matchMedia('(prefers-reduced-motion: reduce)');
  if(media.matches){setPhase('done');return;}
  setPhase('waiting');let timer:ReturnType<typeof setTimeout>|undefined,finish:ReturnType<typeof setTimeout>|undefined,started=false;
  const host=element.current?.closest('.fdchat-conversation');
  const observer=new MutationObserver(begin);
  function begin(){
   if(started||host?.querySelector('.itsflow-morph-stage'))return;
   started=true;observer.disconnect();
   timer=setTimeout(()=>{setPhase('running');finish=setTimeout(()=>setPhase('done'),duration+160);},140);
  }
  if(host)observer.observe(host,{childList:true,subtree:true});begin();
  const reduce=()=>{if(media.matches){clearTimeout(timer);clearTimeout(finish);observer.disconnect();setPhase('done');}};
  media.addEventListener('change',reduce);
  return()=>{clearTimeout(timer);clearTimeout(finish);observer.disconnect();media.removeEventListener('change',reduce);};
 },[text,animate,duration]);
 return <div ref={element} className="fdchat-markdown itsflow-generated-message" data-reveal={phase} style={{'--word-step':`${duration/Math.max(1,words-1)}ms`} as CSSProperties}>
  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={plugins} components={components}>{text}</ReactMarkdown>
 </div>;
}
