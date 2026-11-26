const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {test}=require('node:test');
const source=fs.readFileSync(path.join(__dirname,'../tauri_gerador/web/main.js'),'utf8');
const functions=['fitAssistCanvasWhenVisible','applyAssistCanvasView','centerAssistOrder'].map(name=>{
 const match=source.match(new RegExp(`^function ${name}\\(.*?^}`, 'ms'));
 assert.ok(match,name);return match[0];
}).join('\n');
function fixture(){
 const node={offsetLeft:48,offsetTop:72,offsetWidth:236,offsetHeight:220,dataset:{canvasX:'48',canvasY:'72'}};
 const stage={offsetWidth:700,offsetHeight:590,style:{},querySelectorAll:()=>[node]};
 const viewport={clientWidth:0,clientHeight:0,querySelector:selector=>selector==='.assist-canvas-stage'?stage:node};
 const view={x:0,y:0,scale:1,initialized:false,width:0,height:0};
 const context=vm.createContext({assistMapList:viewport,assistCanvasView:view,state:{activeTab:'integrations'}});
 vm.runInContext(functions,context);
 return {context,view,viewport,stage};
}
test('hidden startup render never saves a zero-sized canvas transform',()=>{
 const {context,view,viewport}=fixture();
 assert.equal(context.fitAssistCanvasWhenVisible(),false);
 assert.equal(view.initialized,false);
 context.state.activeTab='assist';
 assert.equal(context.fitAssistCanvasWhenVisible(),false);
 assert.equal(view.initialized,false);
 viewport.clientWidth=1600;viewport.clientHeight=850;
 assert.equal(context.fitAssistCanvasWhenVisible(),true);
 assert.equal(view.initialized,true);
 assert.ok(view.x>400&&view.y>=120);
 assert.ok(view.scale>.35);
});
test('hide and reopen preserves the user pan and zoom',()=>{
 const {context,view,viewport,stage}=fixture();
 context.state.activeTab='assist';viewport.clientWidth=1600;viewport.clientHeight=850;
 context.fitAssistCanvasWhenVisible();view.x=310;view.y=230;view.scale=.8;
 context.applyAssistCanvasView();const before=stage.style.transform;
 viewport.clientWidth=0;viewport.clientHeight=0;context.state.activeTab='integrations';
 context.fitAssistCanvasWhenVisible();
 viewport.clientWidth=1600;viewport.clientHeight=850;context.state.activeTab='assist';
 stage.style={};context.fitAssistCanvasWhenVisible();
 assert.equal(stage.style.transform,before);
});
test('resizing preserves the viewport center without resetting zoom',()=>{
 const {context,view,viewport}=fixture();
 context.state.activeTab='assist';viewport.clientWidth=1600;viewport.clientHeight=850;
 context.fitAssistCanvasWhenVisible();const {x,y,scale}=view;
 viewport.clientWidth=1800;viewport.clientHeight=950;context.fitAssistCanvasWhenVisible();
 assert.equal(view.x,x+100);assert.equal(view.y,y+50);assert.equal(view.scale,scale);
});
test('centering an order while hidden cannot move the map into a negative corner',()=>{
 const {context,view}=fixture();context.centerAssistOrder(1);
 assert.equal(view.x,0);assert.equal(view.y,0);assert.equal(view.initialized,false);
});
