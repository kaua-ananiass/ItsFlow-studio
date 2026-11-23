const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const root=path.resolve(__dirname,'..'),web=path.join(root,'tauri_gerador/web'),out=path.join(root,'output/chat-universal');await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://studio.test/**',async route=>{
   const name=new URL(route.request().url()).pathname.slice(1);const type=({'.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2'})[path.extname(name)]||'text/html';
   await route.fulfill({contentType:type,body:name?await fs.readFile(path.join(web,name)):'<html lang="pt-BR"><head><link rel="stylesheet" href="/vendor/fonts/fonts.css"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/chatgpt.css"><link rel="stylesheet" href="/chatgpt-react.css"><link rel="stylesheet" href="/itsflow-brand.css"><link rel="stylesheet" href="/itsflow-chat.css"></head><body><main id="chatgptWorkspace" style="height:100vh"></main></body></html>'});
  });
  await page.goto('https://studio.test/');await page.evaluate(async()=>{
   window.calls=[];window.context={revision:'r1',blocks:[{source_order:9,block_id:'block-9',title:'Reconhecimento',configured:false}]};
   const {initChatGPT}=await import('/chatgpt.js');window.mapNode=document.createElement('div');mapNode.textContent='Mapa real da automação';
   initChatGPT({getAutomation:()=>({id:'automation-1',name:'Fluxo de teste'}),getPage:()=> 'principal',getEditorContext:()=>({block_id:'block-9',order:9,workspace:window.mapMounted?'map-and-chat':'studio'}),beforeGenerate:async()=>{},mountMap:host=>{host.append(mapNode);window.mapMounted=true;return()=>{mapNode.remove();window.mapMounted=false;}},apply:roadmap=>{window.applied=roadmap;},revealBlock:async id=>{window.revealed=id;},assistOperation:async(step,commit)=>{window.cursorActions=(window.cursorActions||0)+1;return commit();},navigate:async target=>{window.navigated=target;},openMap:()=>{},invoke:async(command,{request:r={}})=>{
    window.calls.push({command,request:r});if(command==='start_desktop_assistant')return new Promise(resolve=>{window.finishDesktop=()=>resolve({running:true,message:'Assistente aberto'});});
    if(r.action==='history_load')return {version:1,revision:0,activeId:'',threads:[]};
    if(r.action==='history_save')return {revision:r.data.revision+1};
    if(r.action==='status')return {sharing:true,connected:true};
    if(r.action==='models')return {models:[{slug:'mock',display_name:'Modelo de teste',visibility:'list'}]};
    if(r.action==='universal')return new Promise((resolve,reject)=>{window.finishReply=resolve;window.rejectReply=reject;});
    if(r.action==='ai_assist_apply'){
     if(r.revision!==window.context.revision)throw Error('Revisão antiga');
     const number=window.context.blocks.length+9,id='created-'+number;window.context={revision:'r'+number,blocks:[...window.context.blocks,{block_id:id,source_order:number,title:r.step.title,configured:true}]};
     return {roadmap:{events:window.context.blocks},block_id:id,context:window.context,undo_token:'undo',message:'Salvo no editor'};
    }
    throw Error('Unexpected action: '+r.action);
   }});
  });
  await page.waitForSelector('#flowChatInput:not(:disabled)');assert.equal(await page.locator('.fdchat-modes,.fdchat-assist-mode').count(),0);assert.equal(await page.locator('.fdchat-sidebar').isVisible(),false);await page.screenshot({path:path.join(out,'idle.png')});
  let requests=0;const send=async text=>{await page.locator('#flowChatInput').fill(text);await page.getByRole('button',{name:'Enviar mensagem',exact:true}).click();await page.waitForFunction(count=>window.calls.filter(c=>c.request.action==='universal').length===count,++requests);};
  const reply=async result=>{await page.evaluate(result=>window.finishReply({name:'Conversa',revision:window.context.revision,questions:[],steps:[],...result}),result);await page.waitForSelector('.itsflow-morph-stage[data-outcome=success][data-settling=true]');assert.equal(await page.locator('.itsflow-thinking-orb').getAttribute('data-completed'),'true');assert.equal(await page.locator('.itsflow-processing-label').textContent(),'Concluído');assert.equal(await page.locator('.fdchat-composer-note').isVisible(),false,'footer stays hidden until the completion orb has left');await page.waitForTimeout(420);await page.screenshot({path:path.join(out,'completed.png')});await page.waitForSelector('.itsflow-morph-composer[data-processing=false]');await page.waitForSelector('.itsflow-generated-message[data-reveal=running]');const last=page.locator('.itsflow-generated-message[data-reveal=running] .itsflow-generated-word').last();assert.ok(Number(await last.evaluate(el=>getComputedStyle(el).opacity))<1);await page.screenshot({path:path.join(out,'generating.png')});await page.waitForSelector('.itsflow-generated-message[data-reveal=running]',{state:'detached'});};
  await send('Oi, como você pode me ajudar?');await page.waitForSelector('.itsflow-composer-processing canvas');await page.waitForTimeout(160);await page.screenshot({path:path.join(out,'flight.png')});await page.waitForTimeout(1000);
  const initialOrb=await page.locator('.itsflow-composer-processing canvas').boundingBox(),initialConversation=await page.locator('.fdchat-conversation').boundingBox();assert.ok(initialOrb.width>=459);assert.ok(Math.abs(initialOrb.x+initialOrb.width/2-initialConversation.x-initialConversation.width/2)<3);assert.ok(Math.abs(initialOrb.y+initialOrb.height/2-500)<3);
  assert.equal(await page.locator('.itsflow-composer-aurora').evaluate(el=>getComputedStyle(el,'::before').content),'none');assert.equal(await page.locator('.fdchat-log').evaluate(el=>getComputedStyle(el).opacity),'0');await page.screenshot({path:path.join(out,'thinking.png')});await reply({message:'Posso explicar os blocos e configurar o seu fluxo.'});assert.equal(await page.evaluate(()=>window.cursorActions||0),0);assert.equal(await page.locator('.fdchat-map-pane').count(),0);await page.screenshot({path:path.join(out,'answer.png')});
  await send('Crie um bloco de texto');await reply({message:'Onde devo inserir?',questions:['Antes ou depois de qual bloco?'],steps:[{id:'ignored',kind:'text',title:'Não aplicar',text:'x'}]});assert.equal(await page.evaluate(()=>window.cursorActions||0),0);await page.getByRole('button',{name:'Antes ou depois de qual bloco?',exact:true}).waitFor();
  await send('Depois do bloco 9: texto começo, reconhecimento vazio e tecla P');await reply({message:'Vou configurar os três blocos.',steps:[{id:'text',kind:'text',title:'Texto inicial',text:'começo',instruction:'Texto solicitado',placement:{anchor_id:'block-9',anchor_order:9,position:'after'}},{id:'ocr',kind:'ocr',title:'Reconhecimento vazio',instruction:'Sem imagem por enquanto',placement:{anchor_step:'text',position:'after'}},{id:'key',kind:'keys',title:'Tecla P',keys:['p'],instruction:'Uma vez',placement:{anchor_step:'ocr',position:'after'}}]});
  const edits=await page.evaluate(()=>window.calls.filter(c=>c.request.action==='ai_assist_apply').map(c=>c.request));assert.equal(edits.length,3);assert.deepEqual(edits.map(e=>e.step.kind),['text','ocr','keys']);assert.equal(edits[1].step.placement.anchor_id,'created-10');assert.equal(edits[2].step.placement.anchor_id,'created-11');assert.equal(await page.evaluate(()=>window.cursorActions),3);assert.ok((await page.locator('.fdchat-log').textContent()).includes('Alterações salvas'));await page.screenshot({path:path.join(out,'actions.png')});
  await send('Obrigado');await reply({message:'Por nada!'});assert.equal(await page.evaluate(()=>window.cursorActions),3,'Conversation must not replay previous edits');
  await send('Minha próxima pergunta');await page.evaluate(()=>window.rejectReply(Error('Falha de conexão simulada')));await page.waitForSelector('.itsflow-morph-stage[data-outcome=error]');assert.equal(await page.locator('.itsflow-thinking-orb').getAttribute('data-completed'),'false');assert.equal(await page.locator('.itsflow-processing-label').textContent(),'Não foi possível concluir');await page.waitForSelector('.itsflow-morph-composer[data-processing=false]');assert.equal(await page.locator('#flowChatInput').inputValue(),'Minha próxima pergunta');await page.locator('.fdchat-error').waitFor();
  await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:1080,height:720});await page.screenshot({path:path.join(out,'compact.png')});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>window.calls.some(c=>/execute|run_automation/.test(c.command))),false);
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.setViewportSize({width:1920,height:1080});
  const onlyChat=page.getByRole('button',{name:'Somente conversa',exact:true});if(await onlyChat.count())await onlyChat.click();
  await page.getByRole('button',{name:'Demonstrar no desktop',exact:true}).click();await page.waitForFunction(()=>window.calls.some(call=>call.command==='start_desktop_assistant'));
  assert.equal(await page.evaluate(()=>window.calls.filter(call=>call.command==='start_desktop_assistant').length),1);
  await page.locator('.itsflow-morph-stage').waitFor();assert.match(await page.locator('.itsflow-processing-label').innerText(),/Abrindo assistente/);
  assert.match(await page.locator('.itsflow-flight-pill span').innerText(),/Abrindo assistente/);
  assert.equal(await page.locator('.fdchat-composer-note').isVisible(),false);
  await page.waitForTimeout(1150);
  const desktopOrb=await page.locator('.itsflow-composer-processing canvas').boundingBox(),conversation=await page.locator('.fdchat-conversation').boundingBox();
  assert.ok(Math.abs(desktopOrb.y+desktopOrb.height/2-540)<2,'orb is vertically centered in the viewport');
  assert.ok(Math.abs(desktopOrb.x+desktopOrb.width/2-conversation.x-conversation.width/2)<2,'orb is horizontally centered in the chat');
  assert.ok(desktopOrb.width>=459,'larger orb on a full desktop viewport: '+JSON.stringify({desktopOrb,conversation,geometry:await page.locator('.itsflow-morph-stage').evaluate(el=>({size:el.style.getPropertyValue('--orb-size'),top:el.style.getPropertyValue('--orb-center-y'),viewport:[innerWidth,innerHeight]}))}));
  await page.screenshot({path:path.join(out,'desktop-opening.png')});
  await page.setViewportSize({width:1080,height:720});await page.waitForTimeout(60);
  const compactOrb=await page.locator('.itsflow-composer-processing canvas').boundingBox();assert.ok(Math.abs(compactOrb.y+compactOrb.height/2-360)<2);assert.ok(compactOrb.width<=360);
  await page.evaluate(()=>window.finishDesktop());await page.locator('.itsflow-morph-stage[data-settling=true][data-outcome=success]').waitFor();
  assert.equal(await page.locator('.itsflow-thinking-orb').getAttribute('data-completed'),'true');
  await page.locator('.itsflow-morph-stage').waitFor({state:'detached'});
  assert.equal(await page.locator('.fdchat-composer-note').isVisible(),true);assert.equal(await page.locator('#flowChatInput').inputValue(),'Minha próxima pergunta');
  console.log('Universal chat: conversation, questions, real editor batch, no replay, error recovery, animation and compact layout OK');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
