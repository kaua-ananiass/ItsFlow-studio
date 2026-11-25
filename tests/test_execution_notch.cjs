const {test}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');

test('execution notch reuses Sync orb, updates status and replays after returning from Chrome',async()=>{
 const root=path.resolve(__dirname,'../tauri_gerador/web');
 const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404).end();return;}
  const ext=path.extname(file);res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2'})[ext]||'application/octet-stream');
  res.end(fs.readFileSync(file));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 try{
  const page=await browser.newPage({viewport:{width:270,height:64}});const errors=[];
  await page.addInitScript(()=>{window.__itsflowExecutionStart=41;});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/execution-notch.html`);
  await page.waitForFunction(()=>document.querySelector('small')?.textContent.includes('Entrando'));
  assert.equal(await page.locator('canvas').count(),1);
  assert.equal(await page.locator('.execution-notch').evaluate(el=>getComputedStyle(el).pointerEvents),'none');
  await page.waitForFunction(()=>document.querySelector('small')?.textContent==='Executando no Desktop');
  await page.evaluate(()=>window.startExecutionNotch(41));
  assert.equal(await page.locator('small').textContent(),'Executando no Desktop');
  await page.evaluate(()=>{document.body.classList.add('execution-leave');window.__itsflowExecutionStart=42;window.startExecutionNotch(42);});
  await page.waitForFunction(()=>!document.body.classList.contains('execution-leave')&&document.querySelector('small')?.textContent.includes('Entrando'));
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
});
