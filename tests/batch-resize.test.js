'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../static/js/batch-resize.js'),'utf8');
const canvasSource=fs.readFileSync(path.join(__dirname,'../static/js/canvas.js'),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function section(start,end){return canvasSource.slice(canvasSource.indexOf(start),canvasSource.indexOf(end,canvasSource.indexOf(start)));}
function setup(overrides={}){
    let id=0;
    const requests=[];
    const context=vm.createContext({nodes:[],connections:[],selected:new Set(),canvas:{id:'test'},
        uid:()=>`id-${++id}`,pushUndo:()=>{},render:()=>{},refreshNodes:()=>{},scheduleSave:()=>{},saveCanvas:async()=>{},
        imageApiProviders:()=>[{id:'qa'}],allImageModels:()=>['image-model'],
        resolveImageProviderId:value=>value,resolveImageModel:value=>value,normalizedImageQuality:value=>value,
        runSnapshot:(node,prompt,refs)=>({node,prompt,refs}),makePendingForRun:(id,run,_node,_options,task)=>({id,run,startedAt:100,...task}),
        outputUrlValue:item=>typeof item==='string'?item:item.url,extensionFromNameOrUrl:()=>'.png',
        requestMetaFromResult:()=>({provider_id:'qa'}),nowMs:()=>200,addGenerationLog:()=>{},
        nodesEl:{querySelector:()=>({offsetHeight:550,style:{}})},CSS:{escape:value=>value},...overrides});
    vm.runInContext(section('const SIZE_MAP =','const CUSTOM_IMAGE_MODELS_KEY'),context);
    vm.runInContext(section('function apiImageSize(','function nearestFourKSizeFor('),context);
    vm.runInContext(section('function parseRatioValue(','function gcdInt('),context);
    vm.runInContext(source,context);
    const node={id:'source',type:'batchResize',x:100,y:100,resizeImages:Array.from({length:5},(_,i)=>({id:`image-${i}`,url:`/image-${i}.png`,name:`original-${i}.png`,anchor:''})),
        resizeSizes:[{id:'wide',ratio:'wide'},{id:'story',ratio:'story'}],resizeResolution:'1k',
        resizeApiVersion:2,apiProvider:'qa',model:'image-model',quality:'high',supplementalPrompt:'Keep all logos.'};
    context.nodes.push(node);
    context.createCanvasImageTask=async payload=>{requests.push(payload);return {task_id:`task-${requests.length}`};};
    context.findPendingTask=taskId=>{
        const out=context.nodes.find(output=>(output._pending||[]).some(p=>p.canvasTaskId===taskId));
        return out?{out,pending:out._pending.find(p=>p.canvasTaskId===taskId)}:null;
    };
    context.finish=taskId=>{
        const found=context.findPendingTask(taskId);
        if(found) context.completeBatchResizeTask(found.out,found.pending,{images:[`/result-${taskId}.png`]});
        return 'succeeded';
    };
    context.pollCanvasImageTask=async taskId=>context.finish(taskId);
    return {context,node,requests};
}
test('API prompt uses the exact ratio instruction and only optional supplemental text',()=>{
    const {context}=setup();
    const job={ratio:'story',mode:'cover',anchor:5,background:'transparent'};
    assert.equal(context.batchResizePromptFor({},job,{supplementalPrompt:'Keep all logos.'}),
        '原图元素不变，把图片改成9:16比例图片。\n补充提示词：Keep all logos.');
    assert.equal(context.batchResizePromptFor({},{...job,ratio:'wide'},{supplementalPrompt:' '}),
        '原图元素不变，把图片改成16:9比例图片。');
});
test('all fixed ratios and resolutions use the shared API size table',()=>{
    const {context}=setup();
    for(const ratio of ['wide','story','square','portrait','landscape','portrait43','landscape43','ultrawide','ultratall']){
        for(const resolution of ['1k','2k','4k']){
            const {width,height}=context.batchResizeDimensions({ratio},resolution);
            assert.equal(`${width}x${height}`,context.apiImageSize(ratio,resolution));
        }
    }
    assert.throws(()=>context.batchResizeDimensions({ratio:'custom'}));
    assert.throws(()=>context.batchResizeDimensions({ratio:'wide'},'auto'));
});
test('legacy local nodes migrate to configured API settings without losing originals',()=>{
    const {context,node}=setup();delete node.resizeApiVersion;delete node.apiProvider;delete node.model;
    node.resizeSizes=[{id:'wide',label:'16:9',width:1920,height:1080},{id:'story',width:1080,height:1920},{id:'custom',width:1200,height:800}];
    node.resizeBackground='transparent';const originals=node.resizeImages;context.normalizeBatchResizeNode(node);
    assert.equal(node.apiProvider,'qa');assert.equal(node.model,'image-model');assert.equal(node.resizeBackground,undefined);
    assert.equal(JSON.stringify(node.resizeSizes),JSON.stringify([{id:'wide',ratio:'wide'},{id:'story',ratio:'story'},{id:'custom',ratio:'landscape'}]));
    assert.equal(node.resizeImages,originals);
});
test('saved API node migration retains result IDs and pending task snapshots',()=>{
    const {context,node}=setup();node.resizeApiVersion=1;
    node.resizeSizes=[{id:'wide',width:1920,height:1080},{id:'story',width:1080,height:1920}];
    node.resizeMode='cover';node.resizeAnchor=2;node.resizeColor='#000000';
    const output=context.ensureBatchResizeOutput(node,node.resizeImages[0]);
    output.resizeJobs=[{sizeId:'wide',width:1920,height:1080,taskId:'old-task',status:'running'}];
    output.images=[{resizeSizeId:'story',url:'/saved.png'}];output._pending=[{resizeSizeId:'wide',canvasTaskId:'old-task',prompt:'old prompt'}];
    const snapshot=JSON.stringify(output);context.normalizeBatchResizeNode(node);
    assert.equal(JSON.stringify(output),snapshot);assert.equal(node.resizeApiVersion,2);
    assert.equal(node.resizeAnchor,undefined);assert.equal(node.resizeMode,undefined);assert.equal(node.resizeColor,undefined);
    assert.ok(node.resizeImages.every(image=>image.anchor===undefined));
    assert.equal(node.resizeSizes[0].id,'wide');assert.equal(node.quality,'high');
});
test('legacy duplicate proportions migrate to one selection without deleting historical results',()=>{
    const {context,node}=setup();node.resizeApiVersion=1;
    node.resizeSizes=[{id:'wide',label:'16:9',width:1280,height:720},{id:'wide-large',width:1920,height:1080},
        {id:'edited',label:'16:9',width:800,height:1200}];
    const output=context.ensureBatchResizeOutput(node,node.resizeImages[0]);
    output.resizeJobs=[{sizeId:'wide-large',status:'done'}];output.images=[{resizeSizeId:'wide-large',url:'/saved.png'}];
    context.normalizeBatchResizeNode(node);
    assert.equal(JSON.stringify(node.resizeSizes),JSON.stringify([{id:'wide',ratio:'wide'},{id:'edited',ratio:'portrait'}]));
    assert.equal(output.images[0].url,'/saved.png');assert.equal(output.resizeJobs[0].sizeId,'wide-large');
});
test('five groups send ten API requests, cap active tasks at five, and snapshot settings',async()=>{
    const {context,node,requests}=setup();const releases=[];let active=0,maximum=0;
    context.pollCanvasImageTask=async taskId=>{
        active++;maximum=Math.max(active,maximum);await new Promise(resolve=>releases.push(resolve));active--;return context.finish(taskId);
    };
    const batch=context.runBatchResize(node.id);await tick();
    assert.equal(requests.length,5);await context.runBatchResize(node.id);assert.equal(requests.length,5);
    node.resizeSizes[1].ratio='square';node.resizeResolution='4k';node.model='changed-model';node.supplementalPrompt='changed';
    releases.shift()();await tick();assert.equal(requests.length,6);
    while(requests.length<10||active){releases.splice(0).forEach(resolve=>resolve());await tick();}
    await batch;assert.equal(maximum,5);assert.equal(context.batchResizeOutputs(node.id).length,5);assert.equal(context.connections.length,5);
    assert.ok(requests.every(r=>r.provider_id==='qa'&&r.model==='image-model'&&r.quality==='high'&&r.n===1));
    assert.ok(requests.every(r=>r.reference_images.length===1&&r.prompt.endsWith('Keep all logos.')));
    assert.equal(requests.filter(r=>r.size==='720x1280').length,5);
    assert.equal(requests.filter(r=>r.size==='1280x720').length,5);
    assert.ok(requests.every(r=>!('transparent_background' in r)));
    assert.ok(context.batchResizeOutputs(node.id).every(o=>o.images.length===2&&o._pending.length===0));
});
test('submission failure stays isolated, retry only submits failed slots, and rerun replaces one result',async()=>{
    const {context,node}=setup();let calls=0;
    context.createCanvasImageTask=async()=>{if(++calls===1) throw new Error('provider unavailable');return {task_id:`task-${calls}`};};
    await context.runBatchResize(node.id);assert.equal(calls,10);assert.equal(context.batchResizeOutputs(node.id).flatMap(o=>o.images).length,9);
    const first=context.batchResizeOutputs(node.id)[0];assert.equal(first.resizeJobs[0].status,'failed');assert.equal(first.resizeJobs[0].error,'provider unavailable');
    await context.runBatchResize(node.id,{failedOnly:true});assert.equal(calls,11);
    const story=first.images.find(i=>i.resizeSizeId==='story');
    await context.runBatchResize(node.id,{imageId:node.resizeImages[0].id,sizeId:'wide'});assert.equal(calls,12);
    assert.equal(first.images.length,2);assert.equal(first.images.find(i=>i.resizeSizeId==='story'),story);
});
test('stopping prevents queued API submissions and retains already submitted results',async()=>{
    const {context,node,requests}=setup();const releases=[];
    context.pollCanvasImageTask=async taskId=>{await new Promise(resolve=>releases.push(resolve));return context.finish(taskId);};
    const run=context.runBatchResize(node.id);await tick();assert.equal(requests.length,5);
    vm.runInContext('batchResizeRuns.get(nodes[0]).cancelled=true',context);
    releases.splice(0).forEach(resolve=>resolve());await run;
    assert.equal(requests.length,5);assert.equal(context.batchResizeOutputs(node.id).flatMap(o=>o.images).length,5);
    assert.equal(context.batchResizeOutputs(node.id).flatMap(o=>o.resizeJobs).filter(j=>j.status==='cancelled').length,5);
    assert.equal(context.batchResizeBusy(node),false);
});
test('canvas switches do not attach late results or submit remaining queued tasks',async()=>{
    const {context,node,requests}=setup();const releases=[];
    context.pollCanvasImageTask=async taskId=>{await new Promise(resolve=>releases.push(resolve));return context.finish(taskId);};
    const run=context.runBatchResize(node.id);await tick();const oldOutputs=context.batchResizeOutputs(node.id);
    context.canvas={id:'another-canvas'};context.nodes=[];releases.splice(0).forEach(resolve=>resolve());await run;
    assert.equal(requests.length,5);assert.equal(oldOutputs.flatMap(o=>o.images).length,0);
});
test('persisted pending tasks resume into the correct slot and retain additional images',async()=>{
    const {context,node}=setup();const output=context.ensureBatchResizeOutput(node,node.resizeImages[0]);
    output.resizeJobs=[{sizeId:'wide',width:1920,height:1080,status:'running',taskId:'pending-task'}];
    output._pending=[{id:'p',canvasTaskType:'online-image',canvasTaskId:'pending-task',resizeSizeId:'wide',resizeName:'original.png',run:{node,refs:[]}}];
    assert.equal(context.batchResizeBusy(node),true);
    vm.runInContext(section('function completeCanvasImageTask(','function failCanvasImageTask('),context);
    context.pollCanvasImageTask=async taskId=>context.completeCanvasImageTask(taskId,{images:['/first.png','/second.png']});
    vm.runInContext(section('function resumeCanvasImageTasks(','function renderOutputMedia('),context);
    context.resumeCanvasImageTasks();await tick();
    assert.equal(output.images.length,2);assert.ok(output.images.every(i=>i.resizeSizeId==='wide'));
    assert.equal(output.resizeJobs[0].status,'done');assert.equal(output._pending.length,0);assert.equal(context.batchResizeBusy(node),false);
});
test('copy remaps ownership and clears pending task ids while detached copies retain images',()=>{
    const {context,node}=setup();const output=context.ensureBatchResizeOutput(node,node.resizeImages[0]);
    output.images=[{url:'/result.png',resizeSizeId:'wide'}];output._pending=[{canvasTaskId:'task'}];
    output.resizeJobs=[{sizeId:'wide',taskId:'task',status:'running'}];const copy=JSON.parse(JSON.stringify(output));
    context.remapBatchResizeState(copy,new Map([[node.id,'new-source']]));assert.equal(copy.resizeSourceId,'new-source');assert.equal(copy._pending.length,0);
    assert.equal(copy.resizeJobs[0].status,'interrupted');assert.equal(copy.resizeJobs[0].taskId,undefined);
    context.remapBatchResizeState(copy,new Map());assert.equal(copy.resizeSourceId,undefined);assert.equal(copy.images[0].url,'/result.png');
});
test('invalid ratios or missing API settings fail before submitting requests',async()=>{
    const {context,node,requests}=setup();node.resizeSizes[1].ratio='custom';
    await assert.rejects(context.runBatchResize(node.id));assert.equal(context.nodes.length,1);
    node.resizeSizes[1].ratio='story';node.model='';await assert.rejects(context.runBatchResize(node.id));
    assert.equal(requests.length,0);assert.equal(context.batchResizeBusy(node),false);
});
test('height growth prevents overlap while unchanged height preserves manual positions',()=>{
    let height=550;const {context,node}=setup({nodesEl:{querySelector:()=>({offsetHeight:height,style:{}})}});
    const output=context.ensureBatchResizeOutput(node,node.resizeImages[0]);context.ensureBatchResizeSpacing(node);
    height=1000;context.ensureBatchResizeSpacing(node);assert.equal(output.y,node.y+1000+80);
    output.y+=60;context.ensureBatchResizeSpacing(node);assert.equal(output.y,node.y+1000+140);
    height=500;context.ensureBatchResizeSpacing(node);assert.equal(output.y,node.y+1000+140);
});
test('source dragging includes outputs once and source deletion removes owned outputs',()=>{
    const {context,node}=setup({viewport:{scale:1},workflowTransferModal:null,document:{body:{classList:{add:()=>{}}}},
        window:{},clearKvGallerySlotConnectionState:()=>{},isContainerGroupNode:()=>false,isLabelNode:()=>false,
        startKnifeDrag:()=>false,endDrag:()=>{},scheduleLinksRender:()=>{},renderSelectionHub:()=>{},scheduleMinimapRender:()=>{},
        destroyLTXEditor:()=>{},translationOutputNodes:()=>[],connections:[],dragNode:null});
    const output=context.ensureBatchResizeOutput(node,node.resizeImages[0]);context.selected=new Set([node.id,output.id]);
    vm.runInContext(section('function startNodeDrag(','function startNodeResize('),context);
    context.startNodeDrag({button:0,clientX:0,clientY:0,preventDefault:()=>{},stopPropagation:()=>{}},node);
    context.onNodeDrag({clientX:30,clientY:40});assert.equal(node.x,130);assert.equal(output.x,130);assert.equal(context.dragNode.children.length,1);
    vm.runInContext(section('function deleteNode(id,','function clearNodeContentBeforeDelete('),context);
    context.deleteNode(node.id);assert.equal(context.nodes.length,0);assert.equal(context.connections.length,0);
});
