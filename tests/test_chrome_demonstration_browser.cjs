const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../flowdetect_chrome');
(async()=>{
 const server=http.createServer((req,res)=>{const name=req.url.split('?')[0].slice(1)||'demonstration.html';const file=path.join(root,name);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404).end();return;}res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.svg')?'image/svg+xml':'text/html');res.end(fs.readFileSync(file));});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  const page=await browser.newPage({viewport:{width:410,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   let state=null;const listeners=[];
   const studio={automation:{id:'a1',name:'Demonstração de teste'},revision:'r1'};
   window.sent=[];window.receiveStep=(kind='click')=>{const oldValue=structuredClone(state);state.status='paused';state.review_id='step-'+kind;state.events.push(kind==='observe'?{...state.events.find(event=>event.id==='snapshot'),id:state.review_id}:{id:state.review_id,kind:'click',label:'Salvar',url:'https://example.com/'});for(const fn of listeners)fn({itsflowDemonstrationV1:{oldValue,newValue:structuredClone(state)}},'session');};
   window.chrome={runtime:{sendMessage:async message=>{
    window.sent.push(message);const action=message.type.replace('itsflow-demo-','');
    if(action==='status')return {ok:true,state,studio};
    if(action==='start'){state={id:'12345678-1234-1234-1234-123456789abc',status:'recording',automation:studio.automation,events:[{id:'n1',kind:'navigate',label:'Abrir página',url:'https://example.com/'},{id:'snapshot',kind:'observe',label:'Analisar mensagem',url:'https://example.com/',text:'Concluído',image:{data_url:'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="240" height="60"%3E%3Crect width="240" height="60" fill="%23154d40"/%3E%3Ctext x="18" y="36" fill="white"%3EProcesso concluído%3C/text%3E%3C/svg%3E'}}],tabId:42};return {ok:true,state};}
    if(action==='chat'){await new Promise(resolve=>setTimeout(resolve,700));return {ok:true,message:'**Demonstração analisada.** Para que serve o botão Salvar? Posso apontar o campo na página para você.',targets:[{id:'c1',label:'Salvar'}]};}
    return {ok:true,state};
   }},storage:{onChanged:{addListener:fn=>listeners.push(fn),removeListener:()=>{}}}};
  });
  await page.goto(origin+'/demonstration.html');await page.getByRole('button',{name:'Demonstrar esta aba'}).click();
  await page.getByRole('textbox',{name:'Mensagem ao assistente'}).fill('O que faço agora?');await page.getByRole('button',{name:'Enviar',exact:true}).click();
  await page.locator('.demo-thinking canvas').waitFor();await page.locator('.demo-thinking[data-completed=true]').waitFor();
  const out=path.resolve(__dirname,'../output/chrome-demonstration');fs.mkdirSync(out,{recursive:true});
  await page.screenshot({path:path.join(out,'completed.png')});
  await page.locator('.itsflow-generated-message[data-reveal=done]').waitFor();
  await page.waitForFunction(()=>window.sent.some(m=>m.type==='itsflow-demo-point'&&m.id==='c1'));
  await page.getByRole('button',{name:'Mostrar: Salvar'}).click();
  assert.match(await page.locator('.demo-log').innerText(),/Demonstração analisada/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:path.join(out,'panel.png')});
  // Long conversations scroll independently; the draft and composer stay reachable.
  await page.evaluate(()=>{const filler=document.createElement('div');filler.style.minHeight='2500px';document.querySelector('.demo-log').append(filler);document.querySelector('.demo-log').scrollTop=2500;});
  await page.getByRole('button',{name:/Rascunho/}).click();
  assert.equal(await page.locator('.demo-capture-preview').count(),1);
  assert.equal(await page.getByRole('textbox',{name:'Texto de Analisar mensagem'}).inputValue(),'Concluído');
  for(const viewport of [{width:410,height:900},{width:320,height:600}]){
   await page.setViewportSize(viewport);
   const geometry=await page.evaluate(()=>({bottom:document.querySelector('.demo-dock').getBoundingClientRect().bottom,top:document.querySelector('.demo-draft-toggle').getBoundingClientRect().top,bodyHeight:document.documentElement.scrollHeight,height:innerHeight,width:document.documentElement.scrollWidth}));
   assert.ok(geometry.bottom<=viewport.height+1,JSON.stringify(geometry));assert.ok(geometry.top>0);assert.equal(geometry.bodyHeight,viewport.height);assert.ok(geometry.width<=viewport.width);
  }
  await page.setViewportSize({width:410,height:900});
  await page.screenshot({path:path.join(out,'snapshot-draft.png')});
  const before=await page.evaluate(()=>window.sent.filter(message=>message.type==='itsflow-demo-chat').length);
  await page.evaluate(()=>window.receiveStep());
  await page.locator('.demo-arrival').waitFor();
  await page.waitForFunction(before=>window.sent.filter(message=>message.type==='itsflow-demo-chat').length===before+1,before);
  await page.locator('.demo-thinking[data-completed=true]').waitFor();
  await page.locator('.demo-thinking').waitFor({state:'detached'});
  assert.equal(await page.getByRole('button',{name:'Gravar próxima etapa'}).isDisabled(),true);
  assert.equal(await page.evaluate(()=>window.sent.filter(message=>message.type==='itsflow-demo-chat').length),before+1);
  assert.equal(await page.locator('[data-role=user]').count(),1,'automatic analysis does not invent a user message');
  await page.evaluate(()=>window.receiveStep('observe'));
  await page.waitForFunction(()=>window.sent.some(message=>message.type==='itsflow-demo-chat'&&message.image_event==='step-observe'));
  await page.locator('.demo-thinking[data-completed=true]').waitFor();await page.locator('.demo-thinking').waitFor({state:'detached'});
  await page.getByRole('button',{name:/Rascunho/}).click();
  await page.getByRole('button',{name:'Analisar imagem',exact:true}).first().click();
  await page.waitForFunction(()=>window.sent.some(message=>message.type==='itsflow-demo-chat'&&message.image_event==='snapshot'));
  assert.deepEqual(errors,[]);
  // Real trusted browser input verifies the observer never cancels a normal task
  // and never captures field values or sensitive controls.
  await page.goto(origin+'/demonstration.html');
  await page.setContent('<label for="company">Empresa</label><input id="company"><input type="password" id="password"><input id="card" autocomplete="cc-csc"><button id="save">Salvar</button><output id="result"></output>');
  await page.evaluate(()=>{
   window.captured=[];window.pageStates=[];window.chrome={runtime:{sendMessage:async message=>{if(message.type==='itsflow-demo-page-state'){window.pageStates.push(location.href);return {ok:true,state:{id:'s1',status:'recording',origin:location.origin}};}window.captured.push(message);return {ok:true};},onMessage:{addListener:fn=>{window.contentMessage=fn;}}}};
   document.querySelector('#save').addEventListener('click',()=>document.querySelector('#result').textContent='Salvo normalmente');
  });
  await page.addScriptTag({path:path.join(root,'demonstration-capture-content.js')});
  await page.addScriptTag({path:path.join(root,'demonstration-content.js')});
  await page.locator('[data-itsflow-demo-badge]').waitFor();
  await page.evaluate(()=>history.pushState({},'','#spa-message'));
  await page.waitForFunction(()=>window.pageStates.some(url=>url.endsWith('#spa-message')));
  await page.evaluate(()=>history.replaceState({},'','#spa-next'));
  await page.waitForFunction(()=>window.pageStates.some(url=>url.endsWith('#spa-next')));
  await page.locator('#company').fill('PRIVATE INPUT');await page.locator('#password').fill('SECRET PASSWORD');await page.locator('#card').fill('999');await page.locator('#save').click();
  await page.waitForFunction(()=>window.captured.some(m=>m.event?.selector==='#save'));
  const captured=await page.evaluate(()=>window.captured);
  assert.equal(await page.locator('#result').innerText(),'Salvo normalmente');
  assert.ok(captured.some(m=>m.event?.kind==='input'&&m.event.selector==='#company'));
  assert.ok(!JSON.stringify(captured).match(/PRIVATE INPUT|SECRET PASSWORD|999|#password|#card/));
  assert.ok(captured.every(m=>!('value'in m.event)));
  await page.locator('[data-itsflow-demo-overlay]').locator('.toast').waitFor();
  assert.match(await page.locator('[data-itsflow-demo-overlay]').locator('.toast').innerText(),/Clique salvo/);
  const point=async selector=>page.evaluate(selector=>new Promise(resolve=>window.contentMessage({type:'itsflow-demo-point-target',sessionId:'s1',url:location.href,selector,label:'Empresa'},null,resolve)),selector);
  assert.equal((await point('#company')).ok,true);
  await page.locator('[data-itsflow-demo-overlay]').locator('.cursor').waitFor();
  assert.match(await page.locator('[data-itsflow-demo-overlay]').locator('.cursor').innerText(),/Assistente/);
  assert.equal(await page.locator('#result').innerText(),'Salvo normalmente');
  const alignment=await page.evaluate(()=>{const box=document.querySelector('[data-itsflow-demo-overlay]').shadowRoot.querySelector('.box').getBoundingClientRect(),field=document.querySelector('#company').getBoundingClientRect();return Math.abs(box.left-field.left+5);});assert.ok(alignment<1);
  assert.equal((await point('#password')).ok,false);
  await point('#company');await page.keyboard.press('Escape');
  assert.equal(await page.locator('[data-itsflow-demo-overlay]').locator('.cursor').evaluate(el=>el.style.opacity),'0');
  await page.emulateMedia({reducedMotion:'reduce'});await point('#company');
  await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('[data-itsflow-demo-overlay]').shadowRoot.querySelector('.cursor')).opacity)>.95);
  assert.equal(await page.locator('[data-itsflow-demo-overlay]').evaluate(el=>getComputedStyle(el).pointerEvents),'none');
  await page.screenshot({path:path.join(out,'pointer.png')});
  // Region selection must consume its gesture without sending a click to the page.
  await page.evaluate(()=>{const message=document.createElement('div');message.id='message';message.textContent='Operação concluída com sucesso';Object.assign(message.style,{position:'absolute',left:'30px',top:'160px',width:'300px',height:'90px',padding:'15px',background:'#d6f5e9',color:'#123f32'});message.onclick=()=>window.unwantedClick=true;document.body.append(message);});
  const select=()=>page.evaluate(()=>new Promise(resolve=>window.contentMessage({type:'itsflow-demo-select-region',sessionId:'s1'},null,resolve)));
  assert.equal((await select()).ok,true);await page.keyboard.press('Escape');assert.equal(await page.locator('[data-itsflow-capture]').count(),0);
  await select();await page.mouse.move(26,155);await page.mouse.down();await page.mouse.move(337,257,{steps:6});
  await page.screenshot({path:path.join(out,'select-message.png')});await page.mouse.up();
  await page.waitForFunction(()=>window.captured.some(m=>m.type==='itsflow-demo-capture'));
  const snapshot=await page.evaluate(()=>window.captured.find(m=>m.type==='itsflow-demo-capture'));
  assert.equal(snapshot.text,'Operação concluída com sucesso');assert.equal(snapshot.rect.width,311);assert.equal(await page.evaluate(()=>!!window.unwantedClick),false);
  assert.equal(await page.locator('[data-itsflow-capture]').count(),0);
  // Correct crop at device scale, without including adjacent pixels.
  const crop=await page.evaluate(async()=>{const {cropDemonstrationCapture}=await import('/demonstration.js');const canvas=new OffscreenCanvas(800,600),ctx=canvas.getContext('2d');ctx.fillStyle='red';ctx.fillRect(0,0,800,600);ctx.fillStyle='green';ctx.fillRect(20,40,200,100);const blob=await canvas.convertToBlob();const data=URL.createObjectURL(blob);try{const result=await cropDemonstrationCapture(data,{x:10,y:20,width:100,height:50},{width:400,height:300});const image=await createImageBitmap(await(await fetch(result.data_url)).blob());const out=new OffscreenCanvas(result.width,result.height),outCtx=out.getContext('2d');outCtx.drawImage(image,0,0);return {...result,pixel:[...outCtx.getImageData(0,0,1,1).data]};}finally{URL.revokeObjectURL(data);}});
  assert.equal(crop.width,200);assert.equal(crop.height,100);assert.deepEqual(crop.pixel,[0,128,0,255]);
  console.log('PASS fixed draft dock, long chat, green orb, word reveal, trusted click feedback, non-clicking assistant pointer, sensitive fields, Escape and reduced motion');
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
