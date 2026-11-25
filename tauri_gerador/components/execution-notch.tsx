import {useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {AIThinkingOrb} from './ui/ai-thiking-orb-and-input';

function ExecutionNotch(){
 const [entering,setEntering]=useState(true),[revision,setRevision]=useState(0);
 const lastStart=useRef<number|null>(null);
 useEffect(()=>{
  const surface=window as any;
  surface.startExecutionNotch=(generation=Date.now())=>{
   if(lastStart.current===generation)return;
   lastStart.current=generation;
   document.body.classList.remove('execution-leave');setEntering(true);setRevision(v=>v+1);
  };
  // Native entry can arrive before React mounts; replay that request exactly once.
  if(surface.__itsflowExecutionStart!=null)surface.startExecutionNotch(surface.__itsflowExecutionStart);
  return()=>{delete (window as any).startExecutionNotch;};
 },[]);
 useEffect(()=>{const timer=setTimeout(()=>setEntering(false),2200);return()=>clearTimeout(timer);},[revision]);
 return <div key={revision} className="execution-notch" role="status" aria-live="polite">
  <AIThinkingOrb size={48} active />
  <span><strong>Sync <em>itsflow</em></strong><small key={String(entering)}>{entering?'Entrando no Desktop…':'Executando no Desktop'}</small></span>
  <i aria-hidden="true" />
 </div>;
}
createRoot(document.getElementById('execution-root')!).render(<ExecutionNotch/>);
