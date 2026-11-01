const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root='E:/学习/简历作品集/AI应用/Infinite-Canvas画布/用户版/无限画布';
const src=fs.readFileSync(root+'/static/js/canvas.js','utf8');
const block=src.slice(src.indexOf('// Field-only text history'),src.indexOf('function cloneNode('));
const c={canvas:{id:'one'},nodes:[{id:'p',type:'prompt',text:'old',x:0}],connections:[],selected:new Set(),undoStack:[],redoStack:[],undoCanvasId:'one',UNDO_MAX:50,dragNode:null,resizeNode:null,queueMicrotask,
serializableCanvasNodes(){return c.nodes;},setStatus(){},refreshNodes(){},syncGeneratorInputs(){},scheduleGeneratorInputSync(){},scheduleSave(){},canvasDataConnections:()=>[],sanitizeConnections(){},render(){},syncAllKvPromptOutputs(){},scheduleKvGraphRefresh(){}};
vm.createContext(c);vm.runInContext(block,c);
function control(){
 const handlers={};return {dataset:{},addEventListener(k,f){(handlers[k]??=[]).push(f);},emit(k,event={}){(handlers[k]||[]).forEach(f=>f(event));}};
}
const flush=()=>new Promise(r=>queueMicrotask(r));
(async()=>{
 const input=control();c.bindCanvasTextHistory(input,c.nodes[0],'text');input.emit('focus');
 for(const value of ['n','ne','new']){input.emit('input');c.nodes[0].text=value;await flush();}
 assert.equal(c.undoStack.length,1);
 input.emit('blur');c.nodes.push({id:'image',type:'image',url:'new-image.png'});
 c.performUndo();assert.equal(c.nodes[0].text,'old');assert.equal(c.nodes[1].url,'new-image.png');
 c.performRedo();assert.equal(c.nodes[0].text,'new');
 console.log('PASS continuous input grouped; undo/redo preserves new image');
 c.pushUndo();c.nodes[0].x=100;c.performUndo();assert.equal(c.nodes[0].x,0);c.performUndo();assert.equal(c.nodes[0].text,'old');
 c.performRedo();c.performRedo();assert.equal(c.nodes[0].text,'new');assert.equal(c.nodes[0].x,100);
 console.log('PASS mixed field and snapshot history order');
 input.emit('focus');input.emit('compositionstart');input.emit('input',{isComposing:true});c.nodes[0].text='zhong';await flush();
 const count=c.undoStack.length;
 c.nodes[0].text='中文';input.emit('compositionend');await flush();assert.equal(c.undoStack.length,count+1);input.emit('blur');
 c.performUndo();assert.equal(c.nodes[0].text,'new');
 console.log('PASS composition commits one step');
 input.emit('focus');input.emit('input');c.nodes[0].text='temporary';await flush();
 const withChange=c.undoStack.length;
 input.emit('input',{inputType:'historyUndo'});c.nodes[0].text='new';await flush();input.emit('blur');
 assert.equal(c.undoStack.length,withChange-1);
 console.log('PASS native undo to original removes empty entry');
 c.nodes.push({id:'g',type:'kvReferenceGallery',slots:[{slotId:'s',prompt:'before',imageUrl:'first'}]});
 const gallery=control();c.bindCanvasTextHistory(gallery,c.nodes[2],'prompt','s');gallery.emit('focus');gallery.emit('input');c.nodes[2].slots[0].prompt='after';await flush();gallery.emit('blur');
 c.nodes[2].slots[0].imageUrl='latest';c.performUndo();assert.equal(c.nodes[2].slots[0].prompt,'before');assert.equal(c.nodes[2].slots[0].imageUrl,'latest');
 c.performRedo();c.nodes[2].slots[0].prompt='external';const len=c.undoStack.length;c.performUndo();assert.equal(c.nodes[2].slots[0].prompt,'external');assert.equal(c.undoStack.length,len);
 console.log('PASS slot-field isolation; external edit conflict protected');
 c.canvas={id:'two'};c.performUndo();assert.equal(c.undoStack.length,0);
 console.log('PASS canvas history boundary');
})().catch(e=>{console.error(e);process.exitCode=1;});