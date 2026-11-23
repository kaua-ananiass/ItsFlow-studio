const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const {test}=require('node:test');
const source=fs.readFileSync(require('node:path').join(__dirname,'../flowdetect_chrome/demonstration.js'),'utf8').replaceAll('export ','');

function setup(){
 let listener,updated,data={},url='https://example.com/app?local=1#/guias',reply='Análise';const calls=[],points=[];
 const chrome={storage:{session:{get:async()=>structuredClone(data),set:async values=>{Object.assign(data,structuredClone(values));},remove:async key=>{delete data[key];}}},
  runtime:{onMessage:{addListener:fn=>{listener=fn;}}},scripting:{executeScript:async()=>{}},
  tabs:{query:async()=>[{id:42,url}],get:async()=>({id:42,url}),sendMessage:async(...args)=>{points.push(args);return {ok:true};},onUpdated:{addListener:fn=>{updated=fn;}},onRemoved:{addListener:()=>{}}}};
 const context=vm.createContext({chrome,crypto:webcrypto,URL,Date,Error,Promise});
 vm.runInContext(source,context);
 const bridge=async request=>{calls.push(request);if(request.operation==='status')return {automation:{id:'a1',name:'Teste'},revision:'r1'};if(request.operation==='chat')return {message:reply};return {imported:true,message:'Importada'};};
 context.installDemonstration({bridge,captureRegion:async()=>({data_url:'data:image/png;base64,LOCAL_ONLY',width:120,height:40})});
 const send=(action,extra={},sender={})=>new Promise(resolve=>{listener({type:'itsflow-demo-'+action,...extra},sender,resolve);});
 return {send,calls,points,navigate:value=>{url=value;updated(42,{url:value},{id:42,url:value});},setReply:value=>reply=value,setUrl:value=>url=value};
}

test('recording is tab-bound; field values stay empty and never reach chat',async()=>{
 const {send,calls}=setup();const start=await send('start');assert.equal(start.ok,true);const id=start.state.id;
 const event={kind:'input',selector:'#name',label:'Nome',value:'NEVER CAPTURE THIS'};
 await send('event',{sessionId:id,event},{tab:{id:99,url:'https://example.com/'},frameId:0});
 await send('event',{sessionId:id,event},{tab:{id:42,url:'https://example.com/'},frameId:1});
 let result=await send('event',{sessionId:id,event},{tab:{id:42,url:'https://example.com/app?secret=hidden#/guias'},frameId:0});
 assert.equal(result.state.events.length,2);assert.equal(result.state.events[1].value,'');
 assert.equal(result.state.status,'paused');assert.equal(result.state.review_id,result.state.events[1].id);
 await send('chat',{prompt:'Analise'});
 const chat=calls.find(c=>c.operation==='chat');assert.equal(chat.events[1].url,'https://example.com/app');assert.equal('selector'in chat.events[1],false);assert.equal('value'in chat.events[1],false);
 assert.equal((await send('import')).ok,false);
 await send('stop');assert.equal((await send('import')).ok,false);
 await send('chat',{prompt:'Preencher a empresa',review_answer:result.state.events[1].id});
 const field=result.state.events[1];await send('draft',{id:field.id,value:'{{EMPRESA}}'});
 result=await send('import');assert.equal(result.ok,true);assert.equal(result.state.imported,true);
 assert.equal(calls.filter(c=>c.operation==='import').length,1);
 assert.equal((await send('import')).ok,false);assert.equal((await send('toggle')).ok,false);
});

test('paused capture rejects events; another origin requires explicit resume',async()=>{
 const {send,setUrl}=setup();let result=await send('start');const id=result.state.id;
 const event={kind:'click',selector:'#save',label:'Salvar'};
 await send('toggle');assert.equal((await send('event',{sessionId:id,event},{tab:{id:42,url:'https://example.com/'},frameId:0})).ok,false);
 await send('toggle');result=await send('event',{sessionId:id,event},{tab:{id:42,url:'https://other.example/'},frameId:0});assert.equal(result.ok,false);
 result=await send('status');assert.equal(result.state.status,'paused');
 setUrl('https://other.example/new');result=await send('toggle');assert.equal(result.state.origin,'https://other.example');
 assert.equal(result.state.events.at(-1).kind,'navigate');
});

test('assistant points only to captured event IDs on the same current page, never model selectors',async()=>{
 const {send,points,setUrl,setReply,calls}=setup();const start=await send('start');
 const result=await send('event',{sessionId:start.state.id,event:{kind:'click',selector:'#save',label:'Salvar'}},{tab:{id:42,url:'https://example.com/app?local=1#/guias'},frameId:0});
 const event=result.state.events.at(-1);setReply(`Para que serve esse botão? [[apontar:${event.id}]] [[apontar:invented]]`);
 const chat=await send('chat',{prompt:'Explique'});assert.equal(chat.targets.length,1);assert.equal(chat.targets[0].id,event.id);assert.ok(!chat.message.includes('[[apontar'));
 assert.equal(calls.at(-1).events.at(-1).id,event.id);assert.equal('selector'in calls.at(-1).events.at(-1),false);
 assert.equal((await send('point',{id:'invented',selector:'body'})).ok,false);assert.equal(points.length,0);
 assert.equal((await send('point',{id:event.id})).ok,true);assert.equal(points[0][0],42);assert.equal(points[0][1].selector,'#save');
 setUrl('https://example.com/another');assert.equal((await send('point',{id:event.id})).ok,false);assert.equal(points.length,1);
});

test('message snapshots preserve non-click observation and attach only the explicitly selected crop',async()=>{
 const {send,calls}=setup();const start=await send('start');
 const sender={tab:{id:42,url:'https://example.com/app?local=1#/guias'},url:'https://example.com/app?local=1#/guias',frameId:0};
 const capture={sessionId:start.state.id,rect:{x:10,y:20,width:120,height:40},viewport:{width:800,height:600},text:'Processo concluído'};
 const result=await send('capture',capture,sender);assert.equal(result.ok,true);
 const observation=result.state.events.at(-1);assert.equal(observation.kind,'observe');assert.equal(observation.text,capture.text);assert.equal('selector'in observation,false);
 assert.match(observation.image.data_url,/LOCAL_ONLY/);
 await send('chat',{prompt:'O que significa?'});const summary=calls.at(-1).events.at(-1);assert.equal(summary.text,capture.text);assert.equal('image'in summary,false);
 assert.equal(calls.at(-1).image,null);
 await send('chat',{prompt:'Analise o recorte',image_event:observation.id});assert.match(calls.at(-1).image,/LOCAL_ONLY/);
 assert.equal((await send('chat',{prompt:'Não existe',image_event:'invented'})).ok,false);
 const invalid=await send('capture',{...capture,rect:{x:-1,y:0,width:50,height:50}},sender);assert.equal(invalid.ok,false);
 assert.equal((await send('capture',capture,{...sender,frameId:1})).ok,false);
 assert.equal((await send('capture',capture,{...sender,tab:{...sender.tab,id:99}})).state,null);
});

test('navigation is detected during pending review and SPA fallback deduplicates its URL',async()=>{
 const {send,navigate,setUrl}=setup();const start=await send('start');
 const sender={tab:{id:42,url:'https://example.com/app?local=1#/guias'},frameId:0};
 const first=await send('event',{sessionId:start.state.id,event:{kind:'click',selector:'#next',label:'Avançar'}},sender);
 navigate('https://example.com/app#/detalhe');let state=(await send('status')).state;
 assert.equal(state.events.at(-1).kind,'navigate');assert.equal(state.review_id,first.state.review_id);assert.equal(state.events.find(e=>e.id===state.review_id).resulting_url,'https://example.com/app#/detalhe');
 navigate('https://example.com/app#/detalhe');assert.equal((await send('status')).state.events.length,state.events.length);
 setUrl('https://example.com/app#/outra');await send('page-state',{}, {tab:{id:42,url:'https://example.com/app#/outra'},frameId:0});state=(await send('status')).state;
 assert.equal(state.events.at(-1).url,'https://example.com/app#/outra');
 await send('chat',{prompt:'Avança para detalhes',review_answer:state.review_id});navigate('https://example.com/app#/nova');state=(await send('status')).state;assert.equal(state.review_id,state.events.at(-1).id);
 await send('stop');const count=(await send('status')).state.events.length;navigate('https://example.com/app#/stopped');assert.equal((await send('status')).state.events.length,count);
});

test('one action pauses immediately and requires an explanation before explicitly arming the next',async()=>{
 const {send}=setup();const start=await send('start');const sender={tab:{id:42,url:'https://example.com/app?local=1#/guias'},frameId:0};
 const message={sessionId:start.state.id,event:{kind:'click',selector:'#save',label:'Salvar'}};
 const first=await send('event',message,sender);assert.equal(first.state.status,'paused');
 assert.equal((await send('event',message,sender)).ok,false);
 assert.equal((await send('toggle')).ok,false);assert.equal((await send('select')).ok,false);
 await send('chat',{prompt:'Salva os dados preenchidos',review_answer:first.state.review_id});
 const status=await send('status');assert.equal(status.state.review_id,null);assert.equal(status.state.status,'paused');assert.equal(status.state.events.at(-1).description,'Salva os dados preenchidos');
 assert.equal((await send('toggle')).state.status,'recording');
 const second=await send('event',message,sender);assert.notEqual(second.state.review_id,first.state.review_id);assert.equal(second.state.events.length,3);
 await send('draft',{id:second.state.review_id,remove:true});assert.equal((await send('toggle')).ok,true);
});
