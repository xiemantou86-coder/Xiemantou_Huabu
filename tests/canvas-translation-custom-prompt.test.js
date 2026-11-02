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
        setTimeout:()=>0, nodes:[], connections:[], selected:new Set(), uid:() => `id-${++id}`,
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


test('custom prompts are isolated, normalized and omitted in resize/legacy nodes',()=>{
 const c=setup(); const n=input(c);const outs=c.translationOutputNodes(n.id);
 outs[0].translationCustomPrompt='  必须翻译成越南语\r\n按钮 Tải ngay，保留 Logo。  ';
 assert(c.translationOutputPrompt(outs[0]).endsWith('\n下游自定义提示词：必须翻译成越南语\n按钮 Tải ngay，保留 Logo。'));
 assert(!c.translationOutputPrompt(outs[1]).includes('下游自定义提示词'));
 const saved=outs[0].translationCustomPrompt;c.syncTranslationOutputNodes(n);
 assert.equal(outs[0].translationCustomPrompt,saved);
 assert.equal(JSON.parse(JSON.stringify(outs[0])).translationCustomPrompt,saved);
 outs[0].translationMode='resize';assert(!c.translationOutputPrompt(outs[0]).includes('下游自定义提示词'));
 assert.equal(c.translationOutputCustomPrompt({type:'resizeOutput',translationCustomPrompt:'bad'}),'');
 outs[0].translationMode='translate';outs[0].translationCustomPrompt=' \r\n ';assert(!c.translationOutputPrompt(outs[0]).includes('下游自定义提示词'));
});
test('actual single and batch functions submit each output custom prompt independently',async()=>{
 const requests=[];
 const c=setup({createCanvasImageTask:async p=>{requests.push(p);return {task_id:'mock'};},pollCanvasImageTask:async()=>{}});
 const n=input(c);const outs=c.translationOutputNodes(n.id);
 outs[0].translationCustomPrompt='ONLY_A';outs[1].translationCustomPrompt='ONLY_B';
 await c.runTranslationOutputNode(outs[0].id);
 assert.equal(requests.length,1);assert(requests[0].prompt.includes('ONLY_A'));assert(!requests[0].prompt.includes('ONLY_B'));
 requests.length=0;outs.forEach(o=>{o.running=false;o._pending=[];});
 await c.runAllTranslationOutputs(n.id);
 assert.equal(requests.length,2);
 assert.equal(requests.filter(p=>p.prompt.includes('ONLY_A')).length,1);
 assert.equal(requests.filter(p=>p.prompt.includes('ONLY_B')).length,1);
});
test('editor is translate-only, escaped, updates preview without re-render and binds field history',()=>{
 let saves=0,bound='';
 const c=setup({escapeHtml:s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'),
 escapeAttr:s=>s,apiImageSize:()=>'',API_RATIO_VALUES:{wide:'16:9'},renderOutputGrid:()=>'',renderPendingOutput:()=>'',bindOutputWrap:()=>{},
 bindCanvasTextHistory:(el,node,field)=>{bound=field;},scheduleSave:()=>saves++});
 vm.runInContext(between('function truncateTranslationTitle(', 'function bindTranslationInputBody('),c);
 vm.runInContext(between('function bindTranslationOutputBody(', 'function addPromptNode('),c);
 const n=input(c);const out=c.translationOutputNodes(n.id)[0];out.translationCustomPrompt='</textarea><img src=x>';
 const html=c.renderTranslationOutputBody(out);
 assert(html.includes('data-translation-output-prompt rows='));
 assert(html.includes('&lt;/textarea&gt;&lt;img src=x&gt;'));
 out.translationMode='resize';assert(!c.renderTranslationOutputBody(out).includes('data-translation-output-prompt rows='));
 out.translationMode='translate';
 let onInput;const editor={addEventListener:(type,f)=>{onInput=f;}};const preview={textContent:''};
 c.bindTranslationOutputBody({querySelector:s=>s==='[data-translation-output-prompt]'?editor:s==='[data-translation-output-prompt-preview]'?preview:null,querySelectorAll:()=>[]},out);
 onInput({target:{value:'独立要求'}});
 assert.equal(out.translationCustomPrompt,'独立要求');assert(preview.textContent.endsWith('下游自定义提示词：独立要求'));
 assert.equal(saves,1);assert.equal(bound,'translationCustomPrompt');
});
