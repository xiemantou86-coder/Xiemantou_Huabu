'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'static/js/canvas.js'), 'utf8');
function between(start, end){
    return source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
}
function setup(overrides={}){
    let id = 0;
    const context = vm.createContext({
        nodes:[], connections:[], selected:new Set(), uid:() => `id-${++id}`,
        nodesEl:{querySelector:() => ({offsetHeight:800,style:{}})}, CSS:{escape:value => value},
        window:{confirm:() => true}, refreshGeometry:() => {}, refreshNodes:() => {},
        scheduleSave:() => {}, saveCanvas:async () => {}, nowMs:() => 100,
        resolveImageProviderId:value => value, resolveImageModel:value => value,
        normalizedImageQuality:value => value, generatorSizeForRun:async () => '1792x1008',
        runSnapshot:(node, prompt, refs) => ({node, prompt, refs}),
        makePendingForRun:(id, run, node, options, task) => ({id, run, ...task}),
        showErrorModal:() => {}, addGenerationLog:() => {}, alert:() => {},
        TRANSLATION_CONNECTION_KIND:'translationFlow', ...overrides
    });
    vm.runInContext(between('function parseRatioValue(', 'function gcdInt('), context);
    vm.runInContext(between('const TRANSLATION_LANGUAGE_DEFAULTS', 'function renderTranslationInputBody'), context);
    return context;
}
function input(context, targets=['th','ko']){
    const node = {id:'input', type:'translationInput', x:300, y:100, w:410, url:'/source.png',
        sourceLanguage:'zh-hant', targetLanguages:targets, apiProvider:'apimart', model:'image-model',
        ratio:'wide', resolution:'1k', quality:'high'};
    context.nodes.push(node);
    context.syncTranslationOutputNodes(node);
    return node;
}

function setupDrag(){
    const context = setup({
        dragNode:null, viewport:{scale:2}, workflowTransferModal:null,
        document:{body:{classList:{add:() => {}}}},
        nodesEl:{querySelector:() => ({offsetHeight:800, style:{}})},
        startKnifeDrag:() => false, isContainerGroupNode:node => node.type === 'containerGroup',
        endDrag:() => {},
        isLabelNode:node => node?.type === 'label',
        scheduleLinksRender:() => {}, renderSelectionHub:() => {}, scheduleMinimapRender:() => {},
    });
    vm.runInContext(between('function startNodeDrag(', 'function startNodeResize('), context);
    context.beginDrag = node => context.startNodeDrag({
        button:0, clientX:10, clientY:20, preventDefault:() => {}, stopPropagation:() => {},
    }, node);
    return context;
}

test('dragging an upload moves all owned outputs with their existing offsets', () => {
    const context = setupDrag();
    const node = input(context);
    node.translationSizes.push({id:'story',ratio:'story',resolution:'1k'});
    context.syncTranslationOutputNodes(node);
    const outputs = context.translationOutputNodes(node.id);
    outputs[0].x += 47;
    outputs[1].blocked = true;
    const other = {id:'unrelated',type:'translationOutput',translationSourceId:'other',x:900,y:200};
    context.nodes.push(other);
    const positions = context.nodes.map(n => ({node:n,x:n.x,y:n.y}));
    context.beginDrag(node);
    context.onNodeDrag({clientX:110,clientY:-40});
    context.onNodeDrag({clientX:170,clientY:100});
    for(const before of positions){
        const moves = before.node !== other;
        assert.equal(before.node.x, before.x + (moves ? 80 : 0));
        assert.equal(before.node.y, before.y + (moves ? 40 : 0));
    }
});

test('multi-selection collects each bound output once even when the output is the drag root', () => {
    for(const dragOutput of [false,true]){
        const context = setupDrag();
        const node = input(context);
        const outputs = context.translationOutputNodes(node.id);
        context.selected = new Set(context.nodes.map(n => n.id));
        const before = context.nodes.map(n => ({node:n,x:n.x,y:n.y}));
        context.beginDrag(dragOutput ? outputs[0] : node);
        const children = Array.from(context.dragNode.children, item => item.node.id);
        assert.equal(children.length, 2);
        assert.equal(new Set(children).size, 2);
        context.onNodeDrag({clientX:110,clientY:120});
        for(const position of before){
            assert.equal(position.node.x,position.x+50);
            assert.equal(position.node.y,position.y+50);
        }
    }
});

test('dragging a container also collects outputs owned by its upload member', () => {
    const context = setupDrag();
    const node = input(context);
    const outputs = context.translationOutputNodes(node.id);
    const group = {id:'container',type:'containerGroup',x:0,y:0,members:[node.id,outputs[0].id]};
    context.nodes.push(group);
    context.beginDrag(group);
    assert.deepEqual(Array.from(context.dragNode.children, item => item.node.id).sort(),
        [node.id,...outputs.map(n => n.id)].sort());
});

test('dragging an output alone leaves its upload and sibling outputs in place', () => {
    const context = setupDrag();
    const node = input(context);
    const outputs = context.translationOutputNodes(node.id);
    const before = context.nodes.map(n => ({node:n,x:n.x,y:n.y}));
    context.beginDrag(outputs[0]);
    assert.equal(context.dragNode.children.length,0);
    context.onNodeDrag({clientX:110,clientY:120});
    for(const position of before){
        const delta = position.node === outputs[0] ? 50 : 0;
        assert.equal(position.node.x,position.x+delta);
        assert.equal(position.node.y,position.y+delta);
    }
});

test('language prompt includes native names and only nonempty source copy', () => {
    const context = setup();
    const node = input(context);
    assert.equal(context.translationPromptFor(node, 'ko'), '把图片中的繁体中文文案，翻译成韩文 한글，不得改变除文案以外的画面，保留原logo不变');
    node.sourceCopyDescription = '  Download now  ';
    assert.ok(context.translationPromptFor(node, 'en').endsWith('\n原图文案描述：Download now'));
    assert.ok(context.translationPromptFor(node, 'zh-hans').includes('翻译成简体中文，'));
});

test('supplemental prompt is appended to every language-size request and omitted when blank', async () => {
    const requests=[];
    const context=setup({createCanvasImageTask:async payload=>{requests.push(payload);return {task_id:`supplement-${requests.length}`};},pollCanvasImageTask:async()=> 'succeeded'});
    const node=input(context);
    node.sourceCopyDescription='Download now';
    node.supplementalPrompt='  Keep the original Logo text.\nPreserve the character design.  ';
    node.translationSizes.push({id:'story',ratio:'story',resolution:'1k'});
    context.syncTranslationOutputNodes(node);
    await context.runAllTranslationOutputs(node.id);
    assert.equal(requests.length,4);
    for(const request of requests){
        assert.ok(request.prompt.endsWith('原图文案描述：Download now\n补充提示词：Keep the original Logo text.\nPreserve the character design.'));
    }
    assert.equal(context.translationOutputNodes(node.id)[0]._pending[0].run.node.supplementalPrompt,node.supplementalPrompt);
    node.supplementalPrompt='   ';
    assert.ok(!context.translationOutputPrompt(context.translationOutputNodes(node.id)[0]).includes('补充提示词：'));
});

test('language selection follows catalog order with custom languages at the end', () => {
    const context = setup();
    const node = input(context, ['custom-es','th','ko','unknown','ko']);
    node.customLanguages = [{id:'custom-es', label:'西班牙语 Español', prompt:'西班牙语 Español'}];
    assert.deepEqual(Array.from(context.translationSelectedIds(node)), ['ko','th','custom-es']);
    assert.ok(context.translationPromptFor(node, 'custom-es').includes('翻译成西班牙语 Español'));
});

test('outputs remain below the source, centered, ordered, and retain existing results', () => {
    const context = setup();
    const node = input(context);
    const outputs = context.translationOutputNodes(node.id);
    outputs[0].images.push('/generated.png');
    node.targetLanguages.push('en');
    context.syncTranslationOutputNodes(node);
    const next = context.translationOutputNodes(node.id);
    assert.equal(next[0].id, outputs[0].id);
    assert.equal(next[0].images[0], '/generated.png');
    assert.equal(next[0].y, 980);
    assert.equal((next[0].x + next[2].x + 360) / 2, node.x + node.w / 2);
    assert.equal(context.connections.length, 3);
});

test('cancelled removal preserves output and confirmed removal deletes its links', () => {
    const context = setup({window:{confirm:() => false}});
    const node = input(context);
    node.targetLanguages = ['ko'];
    assert.equal(context.syncTranslationOutputNodes(node, {confirmRemoval:true}), false);
    assert.equal(context.nodes.length, 3);
    context.window.confirm = () => true;
    assert.equal(context.syncTranslationOutputNodes(node, {confirmRemoval:true}), true);
    assert.equal(context.nodes.length, 2);
    assert.equal(context.connections.length, 1);
});

test('copy and import remap source binding and detached outputs cannot generate', () => {
    const context = setup();
    const node = input(context);
    const output = context.translationOutputNodes(node.id)[0];
    output._pending = [{id:'pending', canvasTaskId:'task'}];
    context.remapTranslationState(output, new Map([['input','new-input']]));
    assert.equal(output.translationSourceId, 'new-input');
    assert.equal(output._pending.length, 0);
    context.remapTranslationState(output, new Map());
    assert.equal(output.translationSourceId, '');
    assert.equal(context.translationSourceNode(output), null);
});

test('batch submits enabled languages concurrently with individual prompts and shared settings', async () => {
    const requests = [];
    const context = setup({createCanvasImageTask:async payload => {
        requests.push(payload); return {task_id:`task-${requests.length}`};
    }, pollCanvasImageTask:async () => 'succeeded'});
    const node = input(context, ['ko','th','vi']);
    const outputs = context.translationOutputNodes(node.id);
    outputs[1].blocked = true;
    await context.runAllTranslationOutputs(node.id);
    assert.equal(requests.length, 2);
    assert.ok(requests[0].prompt.includes('韩文 한글'));
    assert.ok(requests[1].prompt.includes('越南语 Tiếng Việt'));
    for(const request of requests){
        assert.equal(request.provider_id, 'apimart');
        assert.equal(request.model, 'image-model');
        assert.equal(request.size, '1792x1008');
        assert.equal(request.quality, 'high');
        assert.equal(request.n, 1);
        assert.equal(request.reference_images[0].url, '/source.png');
    }
    assert.equal(outputs[0]._pending[0].canvasTaskType, 'online-image');
    assert.equal(outputs[0]._pending[0].run.node.apiProvider, 'apimart');
    assert.equal(outputs[0]._pending[0].run.node.id, outputs[0].id);
});

test('multiple translation images create independent image-language-size outputs and requests', async () => {
    const requests = [];
    const context = setup({createCanvasImageTask:async payload => {
        requests.push(payload); return {task_id:`multi-${requests.length}`};
    }, pollCanvasImageTask:async () => 'succeeded'});
    const node = input(context, ['ko','th']);
    node.translationImages = [
        {id:'image-a', url:'/a.png', name:'a.png'},
        {id:'image-b', url:'/b.png', name:'b.png'},
    ];
    node.url = '/a.png'; node.name = 'a.png';
    node.translationSizes.push({id:'story',ratio:'story',resolution:'1k'});
    context.syncTranslationOutputNodes(node);
    const outputs = context.translationOutputNodes(node.id);
    assert.equal(outputs.length, 8);
    assert.equal(new Set(outputs.map(output => output.translationImageId)).size, 2);
    await context.runAllTranslationOutputs(node.id);
    assert.equal(requests.length, 8);
    assert.deepEqual(new Set(requests.map(request => request.reference_images[0].url)), new Set(['/a.png','/b.png']));
    assert.equal(requests.filter(request => request.reference_images[0].url === '/a.png').length, 4);
    assert.equal(requests.filter(request => request.reference_images[0].url === '/b.png').length, 4);
});

test('translation node switches to resize mode without deleting translation outputs', async () => {
    const requests = [];
    const context = setup({createCanvasImageTask:async payload => {
        requests.push(payload); return {task_id:`resize-mode-${requests.length}`};
    }, pollCanvasImageTask:async () => 'succeeded'});
    const node = input(context, ['ko']);
    const translationOutput = context.translationOutputNodes(node.id)[0];
    node.translationMode = 'resize';
    context.syncTranslationOutputNodes(node);
    const resizeOutputs = context.translationOutputNodes(node.id, 'resize');
    assert.equal(resizeOutputs.length, 1);
    assert.equal(resizeOutputs[0].translationLanguageId, '__resize__');
    assert.ok(context.translationOutputNodes(node.id, 'translate').includes(translationOutput));
    assert.equal(context.translationOutputPrompt(resizeOutputs[0]), '原图元素不变，把图片改成16:9比例图片。');
    await context.runAllTranslationOutputs(node.id);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].prompt, '原图元素不变，把图片改成16:9比例图片。');
});

test('removing one translation image removes only its downstream outputs and links', () => {
    const context = setup();
    const node = input(context, ['ko']);
    node.translationImages = [
        {id:'image-a', url:'/a.png', name:'a.png'},
        {id:'image-b', url:'/b.png', name:'b.png'},
    ];
    context.syncTranslationOutputNodes(node);
    const keep = context.translationOutputNodes(node.id).find(output => output.translationImageId === 'image-b');
    const remove = context.translationOutputNodes(node.id).find(output => output.translationImageId === 'image-a');
    remove.images = ['/generated.png'];
    node.translationImages = node.translationImages.filter(image => image.id !== 'image-a');
    context.syncTranslationOutputNodes(node, {confirmRemoval:true});
    assert.equal(context.translationOutputNodes(node.id).length, 1);
    assert.equal(context.translationOutputNodes(node.id)[0], keep);
    assert.equal(context.connections.length, 1);
});

test('one failed language does not prevent others from submitting and failure is recorded', async () => {
    let requests = 0;
    const context = setup({createCanvasImageTask:async payload => {
        requests++;
        if(payload.prompt.includes('韩文')) throw new Error('provider unavailable');
        return {task_id:'success'};
    }, pollCanvasImageTask:async () => 'succeeded'});
    const node = input(context);
    await context.runAllTranslationOutputs(node.id);
    assert.equal(requests, 2);
    assert.equal(context.translationOutputNodes(node.id)[0].runError, 'provider unavailable');
    assert.equal(context.translationOutputNodes(node.id)[0].running, false);
});

test('disconnected, blocked, or already pending outputs do not submit tasks', async () => {
    let requests = 0;
    const context = setup({createCanvasImageTask:async () => { requests++; return {task_id:'task'}; }});
    const node = input(context);
    const output = context.translationOutputNodes(node.id)[0];
    output.blocked = true;
    await context.runTranslationOutputNode(output.id);
    output.blocked = false;
    output._pending = [{canvasTaskId:'task'}];
    await context.runTranslationOutputNode(output.id);
    output._pending = [];
    context.connections = [];
    await context.runTranslationOutputNode(output.id);
    assert.equal(requests, 0);
});

test('translation pending tasks can be located and resumed after reload', () => {
    const polled = [];
    const context = setup({pollCanvasImageTask:id => polled.push(id)});
    const node = input(context);
    const output = context.translationOutputNodes(node.id)[0];
    output._pending.push({id:'pending', canvasTaskType:'online-image', canvasTaskId:'task'});
    vm.runInContext(between('function findOutputByPendingId', 'async function createCanvasImageTask'), context);
    vm.runInContext(between('function resumeCanvasImageTasks', 'function renderOutputMedia'), context);
    assert.equal(context.findPendingTask('task').out.id, output.id);
    assert.equal(context.findOutputByPendingId('pending').id, output.id);
    context.resumeCanvasImageTasks();
    assert.deepEqual(polled, ['task']);
});

test('adding sizes creates the language-size matrix without losing existing results or bindings', () => {
    const context = setup();
    const node = input(context, ['ko','th','ru','vi','en']);
    const existing = context.translationOutputNodes(node.id);
    existing[0].images = ['/saved.png'];
    existing[0]._pending = [{canvasTaskId:'active'}];
    existing[0].blocked = true;
    node.translationSizes.push({id:'story',ratio:'story',resolution:'2k'});
    context.syncTranslationOutputNodes(node);
    const outputs = context.translationOutputNodes(node.id);
    assert.equal(outputs.length,10);
    assert.equal(context.connections.length,10);
    assert.equal(new Set(outputs.map(out => context.translationOutputKey(out.translationLanguageId,out.translationSizeId))).size,10);
    assert.equal(outputs[0],existing[0]);
    assert.deepEqual(outputs[0].images,['/saved.png']);
    assert.equal(outputs[0]._pending[0].canvasTaskId,'active');
    assert.equal(outputs[0].blocked,true);
    for(let index=0;index<5;index++){
        assert.equal(outputs[index].x,outputs[index+5].x);
        assert.ok(outputs[index+5].y >= outputs[index].y+880);
    }
});

test('legacy size migration preserves output ids, pictures, pending tasks, and manually placed positions', () => {
    const context = setup();
    const node = {id:'legacy',type:'translationInput',x:0,y:0,ratio:'story',resolution:'custom',customSize:'1080x1920',targetLanguages:['ko']};
    const output = {id:'legacy-output',type:'translationOutput',translationSourceId:node.id,translationLanguageId:'ko',x:777,y:888,images:['/saved.png'],_pending:[{canvasTaskId:'old-task'}]};
    context.nodes.push(node,output);
    context.syncTranslationOutputNodes(node,{layout:false});
    assert.equal(context.translationOutputNodes(node.id)[0],output);
    assert.equal(output.translationSizeId,'story');
    assert.equal(output.x,777);assert.equal(output.y,888);
    assert.equal(output._pending[0].canvasTaskId,'old-task');
    assert.equal(node.translationSizes[0].customSize,'1080x1920');
    assert.equal(context.translationOutputSettings(node,output).customSize,'1080x1920');
});

test('deleting one output excludes only its combination and restoring it preserves its siblings', () => {
    const context = setup();
    const node = input(context);
    node.translationSizes.push({id:'story',ratio:'story',resolution:'1k'});
    context.syncTranslationOutputNodes(node);
    const output = context.translationOutputNodes(node.id)[0];
    const sibling = context.translationOutputNodes(node.id).find(item => item.translationLanguageId===output.translationLanguageId && item.translationSizeId==='story');
    context.excludeTranslationOutput(output);
    context.syncTranslationOutputNodes(node);
    assert.equal(context.translationOutputNodes(node.id).length,3);
    assert.ok(context.nodes.includes(sibling));
    assert.ok(node.targetLanguages.includes(output.translationLanguageId));
    context.syncTranslationOutputNodes(node);
    assert.equal(context.translationOutputNodes(node.id).length,3);
    node.translationExcludedOutputs=[];
    context.syncTranslationOutputNodes(node);
    assert.equal(context.translationOutputNodes(node.id).length,4);
    assert.ok(context.nodes.includes(sibling));
});

test('removing a size preserves the other sizes and cancellation keeps every result', () => {
    const context=setup({window:{confirm:()=>false}});
    const node=input(context);
    node.translationSizes.push({id:'story',ratio:'story',resolution:'1k'});
    context.syncTranslationOutputNodes(node);
    const outputs=context.translationOutputNodes(node.id);
    outputs[0].images=['/keep.png'];
    node.translationSizes=node.translationSizes.filter(size=>size.id==='wide');
    assert.equal(context.syncTranslationOutputNodes(node,{confirmRemoval:true}),false);
    assert.equal(context.translationOutputNodes(node.id).length,4);
    context.window.confirm=()=>true;
    context.syncTranslationOutputNodes(node,{confirmRemoval:true});
    assert.equal(context.translationOutputNodes(node.id).length,2);
    assert.equal(context.translationOutputNodes(node.id)[0],outputs[0]);
    assert.equal(outputs[0].images[0],'/keep.png');
});

test('each size generates its own request and prompt and auto never erases the chosen ratio', async () => {
    const requests=[];
    const context=setup({generatorSizeForRun:async settings => `${settings.ratio}/${settings.resolution}`,
        createCanvasImageTask:async payload=>{requests.push(payload);return {task_id:`task-${requests.length}`};},
        pollCanvasImageTask:async()=> 'succeeded'});
    const node=input(context,['ko']);
    node.translationSizes=[{id:'wide',ratio:'wide',resolution:'auto'},{id:'story',ratio:'story',resolution:'2k'}];
    context.syncTranslationOutputNodes(node);
    await context.runAllTranslationOutputs(node.id);
    assert.deepEqual(requests.map(r=>r.size),['wide/1k','story/2k']);
    assert.ok(requests[0].prompt.includes('16:9'));
    assert.ok(requests[1].prompt.includes('9:16'));
    assert.ok(requests.every(r=>r.prompt.includes('保留原logo') && r.prompt.includes('不得拉伸主体')));
    const outputs=context.translationOutputNodes(node.id);
    assert.equal(outputs[0]._pending[0].run.node.translationSizeId,'wide');
    assert.equal(outputs[1]._pending[0].run.node.translationSizeId,'story');
});

test('batch concurrency is capped at five, duplicate clicks are ignored, and queued settings are snapshotted', async () => {
    const requests=[], releases=[];
    let active=0, maximum=0;
    const context=setup({generatorSizeForRun:async settings=> `${settings.ratio}/${settings.resolution}`,
        createCanvasImageTask:async payload=>{requests.push(payload);return {task_id:`task-${requests.length}`};},
        pollCanvasImageTask:async()=>{
            active++;maximum=Math.max(maximum,active);
            await new Promise(resolve=>releases.push(resolve));active--;return 'succeeded';
        }});
    const node=input(context,['ko','th','ru','vi','en']);
    node.translationSizes.push({id:'story',ratio:'story',resolution:'2k'});
    context.syncTranslationOutputNodes(node);
    const batch=context.runAllTranslationOutputs(node.id);
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(requests.length,5);
    await context.runAllTranslationOutputs(node.id);
    assert.equal(requests.length,5);
    node.translationSizes[1].resolution='4k';
    while(requests.length<10 || active){
        releases.splice(0).forEach(resolve=>resolve());
        await new Promise(resolve=>setImmediate(resolve));
    }
    await batch;
    assert.equal(maximum,5);
    assert.equal(requests.filter(r=>r.size==='story/2k').length,5);
    assert.equal(requests.filter(r=>r.size==='story/4k').length,0);
});

test('growing an upper row pushes lower rows down without moving columns', () => {
    const heights=new Map();
    const context=setup({nodesEl:{querySelector:selector=>({style:{},offsetHeight:heights.get(selector.match(/data-id="([^"]+)"/)[1]) || 300})}});
    const node=input(context);
    node.translationSizes.push({id:'story',ratio:'story',resolution:'1k'});
    context.syncTranslationOutputNodes(node);
    const rows=context.translationOutputNodes(node.id);
    const before=rows.map(out=>({x:out.x,y:out.y}));
    heights.set(rows[0].id,1000);
    context.ensureTranslationRowSpacing(node);
    assert.equal(rows[0].y,before[0].y);
    for(let i=2;i<4;i++){
        assert.equal(rows[i].x,before[i].x);
        assert.ok(rows[i].y>=rows[0].y+1080);
    }
});

test('spacing checks preserve manually placed outputs when content height has not grown', () => {
    const context=setup();
    const node=input(context);
    node.translationSizes.push({id:'story',ratio:'story',resolution:'1k'});
    context.syncTranslationOutputNodes(node);
    const outputs=context.translationOutputNodes(node.id);
    outputs[0].y+=100;
    const before=outputs.map(out=>({x:out.x,y:out.y}));
    context.ensureTranslationRowSpacing(node);
    assert.deepEqual(outputs.map(out=>({x:out.x,y:out.y})),before);
});

test('invalid custom dimensions fail locally without submitting a generation task', async () => {
    let requests=0;
    const context=setup({generatorSizeForRun:async settings=>settings.customSize,
        createCanvasImageTask:async()=>{requests++;return {task_id:'unexpected'};}});
    const node=input(context,['ko']);
    node.translationSizes=[{id:'custom',ratio:'custom',resolution:'custom',customSize:'0x1080'}];
    context.syncTranslationOutputNodes(node);
    await context.runAllTranslationOutputs(node.id);
    assert.equal(requests,0);
    assert.equal(context.translationOutputNodes(node.id)[0].runStatus,'failed');
});

test('generation quantity is normalized and used for both individual reruns and every batch combination', async () => {
    const requests=[];
    const context=setup({createCanvasImageTask:async payload=>{
        requests.push(payload);return {task_id:`count-${requests.length}`};
    },pollCanvasImageTask:async()=> 'succeeded'});
    const node=input(context);
    assert.equal(context.translationGenerationCount({}),1);
    assert.equal(context.translationGenerationCount({count:0}),1);
    assert.equal(context.translationGenerationCount({count:99}),8);
    assert.equal(context.translationGenerationCount({count:2.8}),2);
    assert.equal(context.translationGenerationCount({count:'invalid'}),1);
    node.count=3;
    const output=context.translationOutputNodes(node.id)[0];
    await context.runTranslationOutputNode(output.id);
    assert.equal(requests[0].n,3);
    assert.equal(output._pending[0].run.node.count,3);
    output._pending=[];output.running=false;
    node.translationSizes.push({id:'story',ratio:'story',resolution:'1k'});
    context.syncTranslationOutputNodes(node);
    await context.runAllTranslationOutputs(node.id);
    assert.equal(requests.length,5);
    assert.ok(requests.every(request=>request.n===3));
});

test('new outputs use the rendered upload height while migration preserves existing positions', () => {
    let renderedHeight=800;
    const context=setup({nodesEl:{querySelector:()=>({offsetHeight:renderedHeight,style:{}})}});
    const node={id:'legacy',type:'translationInput',x:100,y:100,w:820,ratio:'wide',resolution:'1k',targetLanguages:['ko','th']};
    const existing={id:'existing',type:'translationOutput',translationSourceId:node.id,translationLanguageId:'ko',x:777,y:1000,images:[],_pending:[]};
    context.nodes.push(node,existing);
    context.syncTranslationOutputNodes(node,{layout:false});
    renderedHeight=1000;
    context.layoutTranslationOutputs(node,{onlyNew:true});
    const added=context.translationOutputNodes(node.id).find(output=>output.id!=='existing');
    assert.equal(added.y,1180);
    assert.equal(existing.x,777);
    assert.equal(existing.y,1000);
});
