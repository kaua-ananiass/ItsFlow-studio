// Particle renderer adapted from the user-supplied MorphOrb reference.
import {useEffect,useLayoutEffect,useRef,useState,type RefObject,type CSSProperties} from 'react';
import {createPortal} from 'react-dom';
import {ArrowUp,Sparkles} from 'lucide-react';
const ORB_R=66,CANVAS=220;
type Ease = (t: number) => number;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const fmt = (v: number) => String(Math.round(v * 1e4) / 1e4);
const TAU = Math.PI * 2;

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function cubicBezier(x1: number, y1: number, x2: number, y2: number): Ease {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  const solve = (x: number) => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const e = sx(t) - x;
      if (Math.abs(e) < 1e-6) return t;
      const d = dx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    let lo = 0, hi = 1;
    t = x;
    for (let i = 0; i < 40; i++) {
      const e = sx(t);
      if (Math.abs(e - x) < 1e-6) break;
      if (x > e) lo = t; else hi = t;
      t = (hi - lo) / 2 + lo;
    }
    return t;
  };
  return (x) => (x <= 0 ? 0 : x >= 1 ? 1 : sy(solve(x)));
}

const E = {
  out: cubicBezier(0.22, 1, 0.36, 1),
  io: cubicBezier(0.65, 0, 0.35, 1),
  in: cubicBezier(0.4, 0, 1, 1),
  fly: cubicBezier(0.5, 0, 0.1, 1),
  grow: cubicBezier(0.3, 0, 0.2, 1),
  vortex: cubicBezier(0.6, 0, 0.2, 1),
  spring: cubicBezier(0.34, 1.4, 0.64, 1),
  card: cubicBezier(0.65, 0, 0.2, 1),
  lin: (t: number) => t,
};

const bez = (t: number, p0: number, c: number, p2: number) => (1 - t) * (1 - t) * p0 + 2 * (1 - t) * t * c + t * t * p2;

/* ───────────────────────── timeline data ───────────────────────── */
const RINGS = 16;
const DOT_LIST = (() => {
  const rand = mulberry32(7);
  const out: { x: number; y: number; z: number; u: number; seed: number }[] = [];
  for (let k = 0; k < RINGS; k++) {
    const y = 1 - ((k + 0.5) / RINGS) * 2;
    const r = Math.sqrt(1 - y * y);
    const m = Math.max(4, Math.round(30 * r));
    for (let j = 0; j < m; j++) {
      const a = (j / m) * TAU + k * 0.35;
      out.push({ x: Math.cos(a) * r, y, z: Math.sin(a) * r, u: (1 - y) / 2, seed: rand() * 6.283 });
    }
  }
  return out;
})();
const N = DOT_LIST.length;
const DX = Float32Array.from(DOT_LIST, (d) => d.x);
const DY = Float32Array.from(DOT_LIST, (d) => d.y);
const DZ = Float32Array.from(DOT_LIST, (d) => d.z);
const DU = Float32Array.from(DOT_LIST, (d) => d.u);
const DS = Float32Array.from(DOT_LIST, (d) => d.seed);

const G_STEPS = 24, A_STEPS = 48;
const COLORS: string[] = (() => {
  const out: string[] = [];
  for (let gi = 0; gi <= G_STEPS; gi++) {
    const g = gi / G_STEPS;
    const r = Math.round(lerp(150, 58, g)), gg = Math.round(lerp(239, 230, g)), b = Math.round(lerp(225, 126, g));
    for (let ai = 0; ai <= A_STEPS; ai++) out.push(`rgba(${r},${gg},${b},${(ai / A_STEPS).toFixed(3)})`);
  }
  return out;
})();

interface OrbParams {
  k: number; alpha: number; spin: number; rot: number; sweep: number; pop: number;
  vortex: number; gain: number; floor: number; rad: number; prog: number;
}
const ORB_KEYS = ["k", "alpha", "spin", "sweep", "pop", "vortex", "gain", "floor", "rad"] as const;

function createOrb(canvas: HTMLCanvasElement, getSpeed: () => number, isReduced: () => boolean) {
  const P: OrbParams = { k: 0, alpha: 0, spin: 0, rot: 0, sweep: 0, pop: 1, vortex: 0, gain: 1, floor: 0, rad: 0, prog: 0 };
  const ctx = canvas.getContext("2d");
  const lit = new Float32Array(N);
  const SX = new Float32Array(N), SY = new Float32Array(N), SR = new Float32Array(N), SD = new Float32Array(N);
  const SC = new Int16Array(N);
  const pw = [1, 0, 0, 0];
  let time = 0, raf = 0, last = 0, dead = false;

  const reset = () => {
    P.k = 0; P.alpha = 0; P.spin = 0; P.rot = 0; P.sweep = 0; P.pop = 1; P.vortex = 0; P.gain = 1; P.floor = 0; P.rad = 0; P.prog = 0;
    lit.fill(0);
    pw[0] = 1; pw[1] = 0; pw[2] = 0; pw[3] = 0;
    time = isReduced() ? 1.2 : 0;
  };
  reset();

  if (!ctx) return { P, ensure() {}, reset, destroy() {} };

  const displayWidth=parseFloat(getComputedStyle(canvas).width)||CANVAS;
  const dpr = Math.min(3,(window.devicePixelRatio || 1)*Math.max(1,displayWidth/CANVAS));
  canvas.width = Math.round(CANVAS * dpr);
  canvas.height = Math.round(CANVAS * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const S = 0.6, CP = Math.cos(0.35), SP = Math.sin(0.35), C0 = CANVAS / 2;

  const draw = (dt: number) => {
    ctx.clearRect(0, 0, CANVAS, CANVAS);
    time += dt;
    P.rot += P.spin * dt;
    const yaw = P.rot + P.vortex, cyw = Math.cos(yaw), syw = Math.sin(yaw);
    const stepW = dt / 0.35;
    for (let q = 0; q < 4; q++) {
      const d = (q === P.prog ? 1 : 0) - pw[q];
      pw[q] += Math.abs(d) <= stepW ? d : d > 0 ? stepW : -stepW;
    }
    const decay = Math.exp(-dt / 0.5);
    const h0 = (time * 300) % N, h3 = (time * 480) % N;
    const a1 = time * 0.8, b1 = Math.sin(time * 0.5) * 0.9;
    const f1x = Math.cos(b1) * Math.cos(a1), f1y = Math.sin(b1), f1z = Math.cos(b1) * Math.sin(a1);
    const a2 = time * 0.55 + 2.1, b2 = Math.cos(time * 0.42) * 0.9;
    const f2x = Math.cos(b2) * Math.cos(a2), f2y = Math.sin(b2), f2z = Math.cos(b2) * Math.sin(a2);
    const lat = Math.sin(time * 2.2);
    const swirlK = P.vortex * 1.5;

    for (let n = 0; n < N; n++) {
      const dx = DX[n], dy = DY[n], dz = DZ[n], u = DU[n];

      /* light programs: dots are lit in turn */
      let pulse = 0;
      if (pw[0] > 0.001) {
        let dd = Math.abs(n - h0); if (dd > N - dd) dd = N - dd;
        const v = Math.max(0, 1 - dd / 16);
        pulse = Math.max(pulse, v * v * pw[0]);
      }
      if (pw[1] > 0.001) {
        const v1 = Math.max(0, (dx * f1x + dy * f1y + dz * f1z - 0.72) / 0.28);
        const v2 = Math.max(0, (dx * f2x + dy * f2y + dz * f2z - 0.72) / 0.28);
        const v = Math.max(v1, v2);
        pulse = Math.max(pulse, v * v * pw[1]);
      }
      if (pw[2] > 0.001) {
        const e = dy - lat;
        const v = Math.max(0, 1 - (e * e) / 0.02);
        pulse = Math.max(pulse, v * v * pw[2]);
      }
      if (pw[3] > 0.001) {
        let dd = Math.abs(n - h3); if (dd > N - dd) dd = N - dd;
        const v = Math.max(0, 1 - dd / 22);
        pulse = Math.max(pulse, v * v * pw[3]);
      }
      const l = Math.max(lit[n] * decay, pulse * P.gain);
      lit[n] = l;

      /* per-dot appearance: top dots first, bottom collapse first */
      const ki = clamp01(P.k * (1 + S) - S * u);
      if (ki <= 0.001) { SC[n] = -1; continue; }
      const eo = E.out(ki), kk = eo * P.pop;

      const x1 = dx * cyw + dz * syw, z1 = -dx * syw + dz * cyw;
      const y2 = dy * CP - z1 * SP, z2 = dy * SP + z1 * CP;
      const f = 2.8 / (2.8 - z2), depth = (z2 + 1) / 2;
      let ox = x1 * ORB_R * kk * f, oy = -y2 * ORB_R * kk * f;
      if (swirlK > 0.001) {
        const sw = (1 - ki) * swirlK, cc = Math.cos(sw), ss = Math.sin(sw);
        const tx = ox * cc - oy * ss;
        oy = ox * ss + oy * cc;
        ox = tx;
      }

      const g = clamp01((P.sweep * 1.4 - u) / 0.4);
      let a = 0.1 + 0.035 * Math.sin(DS[n] + time * 1.6) * (1 - g) + 0.32 * depth * depth + 0.75 * l * (1 - g) + g * (0.55 + 0.4 * depth) + 2 * g * (1 - g);
      a = Math.max(a, P.floor * (0.7 + 0.3 * depth));
      if (a > 1) a = 1;
      a *= eo * P.alpha;

      SX[n] = C0 + ox;
      SY[n] = C0 + oy;
      SD[n] = depth;
      SR[n] = (1.15 * (0.45 + 0.75 * depth) * f + 0.9 * l + g * 0.25) * (1 + P.rad) * (0.4 + 0.6 * eo);
      const ai = Math.round(a * A_STEPS), gi = Math.round(g * G_STEPS);
      SC[n] = ai <= 0 ? -1 : gi * (A_STEPS + 1) + ai;
    }

    /* two passes: back half first, then front half */
    for (let pass = 0; pass < 2; pass++) {
      for (let n = 0; n < N; n++) {
        const c = SC[n];
        if (c < 0) continue;
        if ((SD[n] >= 0.5) !== (pass === 1)) continue;
        ctx.fillStyle = COLORS[c];
        ctx.beginPath();
        ctx.arc(SX[n], SY[n], SR[n], 0, TAU);
        ctx.fill();
      }
    }
  };

  const frame = (now: number) => {
    raf = 0;
    if (dead) return;
    const dt = isReduced() ? 0 : Math.max(0, Math.min(0.05, (now - last) / 1000)) * getSpeed();
    last = now;
    draw(dt);
    if (P.alpha > 0.002 && !isReduced()) raf = requestAnimationFrame(frame);
    else if(P.alpha<=0.002) ctx.clearRect(0, 0, CANVAS, CANVAS);
  };

  const ensure = () => {
    if (raf || dead || P.alpha <= 0.002) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };

  const destroy = () => {
    dead = true;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };

  return { P, ensure, reset, destroy };
}

export function AIThinkingOrb({active=true,paused=false,status='',size=132,completed=false}:{active?:boolean;paused?:boolean;status?:string;size?:number;completed?:boolean}){
 const canvas=useRef<HTMLCanvasElement>(null),refresh=useRef<(()=>void)|null>(null),state=useRef({active,paused,status,completed});state.current={active,paused,status,completed};
 useEffect(()=>{
  if(!canvas.current)return;
  const media=matchMedia('(prefers-reduced-motion: reduce)');let frame=0,dead=false,previous=performance.now();
  const orb=createOrb(canvas.current,()=>1,()=>media.matches);
  const update=(now:number)=>{
   if(dead)return;
   const current=state.current,show=!current.paused&&document.visibilityState!=='hidden',dt=Math.min(.05,(now-previous)/1000);previous=now;
   const blend=media.matches?1:1-Math.exp(-dt*6);
   orb.P.k+=(1-orb.P.k)*blend;orb.P.alpha+=((show?1:0)-orb.P.alpha)*blend;orb.P.spin=current.active?.4:.08;
   orb.P.gain=current.active?1:.2;orb.P.prog=/Configurando|Salvando|Aplicando/.test(current.status)?3:/contexto|Conferindo/.test(current.status)?2:0;
   orb.P.sweep+=((current.completed?1:0)-orb.P.sweep)*blend;orb.P.floor+=((current.completed?.75:0)-orb.P.floor)*blend;
   if(show)orb.ensure();if(show&&!media.matches)frame=requestAnimationFrame(update);
  };
  const resume=()=>{cancelAnimationFrame(frame);previous=performance.now();frame=requestAnimationFrame(update);};
  refresh.current=resume;
  document.addEventListener('visibilitychange',resume);media.addEventListener('change',resume);
  frame=requestAnimationFrame(update);
  return()=>{dead=true;refresh.current=null;cancelAnimationFrame(frame);orb.destroy();document.removeEventListener('visibilitychange',resume);media.removeEventListener('change',resume);};
 },[paused]);
 useEffect(()=>{if(matchMedia('(prefers-reduced-motion: reduce)').matches)refresh.current?.();},[completed,status]);
 return <canvas ref={canvas} className="itsflow-thinking-orb" data-completed={completed} style={{width:size,height:size}} aria-hidden="true"/>;
}

export interface MorphOrbProps{
 value:string;onChange:(value:string)=>void;onSubmit:()=>void;inputRef:RefObject<HTMLTextAreaElement|null>;
 busy:boolean;disabled?:boolean;sendDisabled?:boolean;status:string;activityLabel?:string;paused?:boolean;progress?:string[];outcome?:'idle'|'pending'|'success'|'error';
}
export default function MorphOrbAndInput({value,onChange,onSubmit,inputRef,busy,disabled,sendDisabled,status,activityLabel,paused,progress=[],outcome='idle'}:MorphOrbProps){
 const form=useRef<HTMLFormElement>(null),flight=useRef<HTMLDivElement>(null),stageRoot=useRef<HTMLDivElement>(null),lastText=useRef(value),origin=useRef<DOMRect|null>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const [stage,setStage]=useState<{host:HTMLElement;x:number;y:number;width:number;text:string}|null>(null),[settling,setSettling]=useState(false);
 if(value.trim())lastText.current=value;
 useLayoutEffect(()=>{
  if(timer.current){clearTimeout(timer.current);timer.current=null;}
  if(busy&&form.current){
   const host=form.current.closest('.fdchat-conversation') as HTMLElement|null;
   if(host){const source=origin.current||form.current.getBoundingClientRect(),target=host.getBoundingClientRect(),center=Math.max(target.top+80,Math.min(innerHeight/2,target.bottom-140));origin.current=null;setSettling(false);setStage({host,x:source.left+source.width/2-target.left-target.width/2,y:source.top+source.height/2-center,width:source.width,text:activityLabel||lastText.current});}
  }else if(!busy&&stage){setSettling(true);timer.current=setTimeout(()=>{setStage(null);setSettling(false);},matchMedia('(prefers-reduced-motion: reduce)').matches?1:outcome==='success'?1110:460);}
  return()=>{if(timer.current)clearTimeout(timer.current);};
 },[busy]);
 useLayoutEffect(()=>{
  if(!stage)return;
  const update=()=>{
   const rect=stage.host.getBoundingClientRect(),top=Math.max(0,rect.top),bottom=Math.min(innerHeight,rect.bottom);
   const center=Math.max(top+80,Math.min(innerHeight/2,bottom-140));
   stageRoot.current?.style.setProperty('--orb-center-y',`${center-rect.top}px`);
   const preferred=innerHeight<=760||rect.width<=650?360:460;
   stageRoot.current?.style.setProperty('--orb-size',`${Math.max(180,Math.min(preferred,rect.width-32,bottom-top-100))}px`);
  };
  update();const observer=new ResizeObserver(update);observer.observe(stage.host);
  window.addEventListener('resize',update);window.addEventListener('scroll',update,true);
  return()=>{observer.disconnect();window.removeEventListener('resize',update);window.removeEventListener('scroll',update,true);};
 },[stage?.host]);
 useLayoutEffect(()=>{
  if(!stage||!flight.current)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const animation=flight.current.animate([
   {transform:`translate(calc(-50% + ${stage.x}px),calc(-50% + ${stage.y}px)) scale(1)`,width:`${stage.width}px`,opacity:1,borderRadius:'26px'},
   {offset:.34,transform:`translate(calc(-50% + ${stage.x*.86}px),calc(-50% + ${stage.y*.86}px)) scale(.96)`,width:'68px',opacity:.95,borderRadius:'50px'},
   {offset:.83,transform:'translate(-50%,-50%) scale(.5)',width:'68px',opacity:.7,borderRadius:'50px'},
   {transform:'translate(-50%,-50%) scale(.2)',width:'68px',opacity:0,borderRadius:'50px'},
  ],{duration:reduced?1:900,easing:'cubic-bezier(.22,1,.36,1)',fill:'forwards'});
  return()=>animation.cancel();
 },[stage]);
 const send=()=>{if(busy||stage||sendDisabled)return;origin.current=form.current?.getBoundingClientRect()||null;onSubmit();};
 return <><form ref={form} className="fdchat-composer itsflow-morph-composer" data-processing={busy||!!stage} onSubmit={event=>{event.preventDefault();send();}}>
  <div className="itsflow-composer-aurora" aria-hidden="true"/>
  <div className="itsflow-composer-input"><Sparkles size={20} aria-hidden="true"/><label className="sr-only" htmlFor="flowChatInput">Mensagem para o itsflow</label>
   <textarea ref={inputRef} id="flowChatInput" data-ai="prompt" rows={1} value={value} maxLength={8000} onChange={event=>onChange(event.target.value)} placeholder="Peça algo ou tire uma dúvida…" disabled={disabled||busy} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();send();}}}/>
   <button type="submit" className="fdchat-send" data-ai="generate" aria-label="Enviar mensagem" disabled={sendDisabled||busy}><ArrowUp size={19}/></button>
  </div>
 </form>{stage&&createPortal(<div ref={stageRoot} className="itsflow-morph-stage" data-settling={settling} data-outcome={outcome}>
  <div ref={flight} className="itsflow-flight-pill" aria-hidden="true"><Sparkles size={20}/><span>{stage.text}</span></div>
  <div className="itsflow-composer-processing" role="status"><div className="itsflow-orb-halo" aria-hidden="true"/><AIThinkingOrb active={!settling} completed={settling&&outcome==='success'} paused={paused} status={status} size={460}/><span className="itsflow-processing-label" key={settling?outcome:status}>{settling?(outcome==='success'?'Concluído':'Não foi possível concluir'):status||'Pensando…'}</span><ul className="itsflow-progress-notes" aria-label="Etapas do pedido">{progress.slice(-3).map((text,index)=><li key={text} style={{'--note-index':index} as CSSProperties}><i aria-hidden="true"/>{text}</li>)}</ul></div>
 </div>,stage.host)}</>;
}
