const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
test('click aura stays on the actual point, draws two waves for double click and never sends input',async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{const page=await browser.newPage();await page.setContent('<button id="target" style="margin:180px">Salvar</button>');
 await page.evaluate(()=>{const original=Element.prototype.attachShadow;Element.prototype.attachShadow=function(options){return original.call(this,{...options,mode:'open'});};window.chrome={runtime:{sendMessage:async()=>({}),onMessage:{addListener(){}}}};window.actualClicks=0;document.querySelector('button').addEventListener('click',()=>window.actualClicks++);});
 await page.addScriptTag({path:path.resolve(__dirname,'../flowdetect_chrome/automation-cursor.js')});
 await page.evaluate(async()=>{await FlowDetectCursor.move(document.querySelector('button'));FlowDetectCursor.indicate(document.querySelector('button'),'Clique',{x:260,y:220},2);});
 const waves=await page.evaluate(()=>{const root=document.querySelector('[data-flowdetect-overlay="cursor"]').shadowRoot;return [...root.querySelectorAll('.click-aura')].map(el=>({x:el.style.left,y:el.style.top,delay:el.getAnimations()[0].effect.getTiming().delay}));});
 assert.deepEqual(waves,[{x:'260px',y:'220px',delay:0},{x:'260px',y:'220px',delay:95}]);
 await page.waitForTimeout(750);assert.equal(await page.evaluate(()=>document.querySelector('[data-flowdetect-overlay="cursor"]').shadowRoot.querySelectorAll('.click-aura').length),0);assert.equal(await page.evaluate(()=>actualClicks),0);
 await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>FlowDetectCursor.indicate(document.querySelector('button'),'Clique',{x:300,y:240},1));assert.equal(await page.evaluate(()=>document.querySelector('[data-flowdetect-overlay="cursor"]').shadowRoot.querySelectorAll('.click-aura').length),1);await page.evaluate(()=>FlowDetectCursor.stop());assert.equal(await page.locator('[data-flowdetect-overlay="cursor"]').count(),0);
 }finally{await browser.close();}
});
