const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root='E:/学习/简历作品集/AI应用/Infinite-Canvas画布/用户版/无限画布';
const s=fs.readFileSync(root+'/static/js/canvas.js','utf8');
function block(a,b){return s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a)));}
const c={canvas:{id:'one'},nodes:[],connections:[],selected:new Set(),undoStack:[],redoStack:[],undoCanvasId:null,UNDO_MAX:50,
dragNode:null,resizeNode:null,viewport:{scale:1},nodesEl:{querySelector:()=>null},workflowTransferModal:null,
serializableCanvasNodes(list){return list||c.nodes;},
sanitizeConnections(){},syncGeneratorInputs(){},render(){},scheduleSave(){},
scheduleLinksRender(){},renderSelectionHub(){},scheduleMinimapRender(){},updateWorkflowTransferMeta(){},
defaultNodeSize:()=>({w:100,h:100}),isGameKvPopupPromptNode:()=>false,isIrregularPopupKvPromptNode:()=>false};
vm.createContext(c);
vm.runInContext(block('// Field-only text history','function cloneNode('),c);
vm.runInContext(block('function onNodeDrag(e){','function startNodeResize('),c);
const resizeStart=s.indexOf('function onNodeResize(e){');
let brace=s.indexOf('{',resizeStart),depth=1,end=brace+1;
for(;depth&&end<s.length;end++){if(s[end]==='{')depth++;if(s[end]==='}')depth--;}
vm.runInContext(s.slice(resizeStart,end),c);
c.pushUndo();c.nodes.push({id:'a',type:'prompt',x:0,y:0,w:100,h:100});
function move(x){
 const n=c.nodes[0];c.dragNode={node:n,children:[],sx:0,sy:0,ox:n.x,oy:n.y};
 c.onNodeDrag({clientX:0,clientY:0});
 const count=c.undoStack.length;
 c.onNodeDrag({clientX:x/2,clientY:0});c.onNodeDrag({clientX:x,clientY:0});
 assert.equal(c.undoStack.length,count+1);
 c.dragNode=null;
}
move(100);move(50);
assert.equal(c.nodes[0].x,150);
c.resizeNode={node:c.nodes[0],sx:0,sy:0,sw:100,sh:100};
c.onNodeResize({clientX:100,clientY:50});c.resizeNode=null;
assert.equal(c.nodes[0].w,200);
c.performUndo();assert.equal(c.nodes[0].w,100);assert.equal(c.nodes[0].x,150);
c.performUndo();assert.equal(c.nodes[0].x,100);
c.performUndo();assert.equal(c.nodes[0].x,0);assert.equal(c.nodes.length,1);
c.performUndo();assert.equal(c.nodes.length,0);
c.performRedo();c.performRedo();c.performRedo();c.performRedo();
assert.equal(c.nodes[0].x,150);assert.equal(c.nodes[0].w,200);
console.log('PASS create, two gestures, resize: four separate undo/redo steps');
const count=c.undoStack.length;c.dragNode={node:c.nodes[0],children:[],sx:0,sy:0,ox:150,oy:0};c.onNodeDrag({clientX:0,clientY:0});
assert.equal(c.undoStack.length,count);c.performUndo();assert.equal(c.undoStack.length,count);c.dragNode=null;
console.log('PASS zero movement, undo during gesture blocked');
c.canvas={id:'two'};c.nodes=[{id:'b',x:42}];c.performUndo();assert.equal(c.nodes[0].id,'b');assert.equal(c.undoStack.length,0);
console.log('PASS cross-canvas history isolation');
assert.match(block('function startNodeDrag(','function onNodeDrag('),/if\(e\.altKey\)\{\s*pushUndo\(\)/);
assert.match(s,/if\(e\.repeat\) return;\s*if\(e\.shiftKey\) performRedo/);
console.log('PASS Alt-copy and key-repeat wiring');