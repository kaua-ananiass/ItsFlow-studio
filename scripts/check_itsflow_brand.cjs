// Visual verification against the real Studio frontend, without touching user data.
const fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const root=path.resolve(__dirname,'..'),web=path.join(root,'tauri_gerador/web'),out=path.join(root,'output/itsflow-branding');await fs.mkdir(out,{recursive:true});
 const server=http.createServer(async(req,res)=>{try{const file=path.resolve(web,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));if(!file.startsWith(web+path.sep)){res.writeHead(403).end();return;}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream');res.end(await fs.readFile(file));}catch{res.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:path.join(out,'welcome.png')});assert.equal(await page.title(),'itsflow Studio');assert.ok(await page.locator('.itsflow-welcome-mark').evaluate(el=>el.complete&&el.naturalWidth>0));
  assert.equal((await page.locator('#loginTitleText').textContent()).replace(/\s/g,''),'itsflowStudio');
  await page.addStyleTag({content:'#loginOverlay{display:none!important}.builder-shell{visibility:visible!important;pointer-events:auto!important;filter:none!important}'});
  await page.screenshot({path:path.join(out,'launcher.png')});await page.locator('#integrationsTabButton').click();await page.waitForSelector('.fdchat-brand h2');assert.equal((await page.locator('.fdchat-brand h2').textContent()).trim(),'Sync');await page.screenshot({path:path.join(out,'chat.png')});
  await page.setViewportSize({width:1080,height:720});await page.screenshot({path:path.join(out,'compact.png')});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
  await page.setViewportSize({width:256,height:256});const svg=await fs.readFile(path.join(web,'assets/itsflow-mark.svg'),'utf8');await page.setContent(`<style>html,body{margin:0;background:transparent}svg{width:256px;height:256px;display:block}</style>${svg}`);await page.screenshot({path:path.join(out,'icon.png'),omitBackground:true});
  console.log('Brand assets, launcher, chat and compact viewport: OK');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
