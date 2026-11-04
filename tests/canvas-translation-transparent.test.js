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



test('transparent preset is inherited and sent by single/batch requests only when supported',async()=>{
 const requests=[];
 const c=setup({transparentPngUnlocked:n=>n.model==='supported',
 createCanvasImageTask:async p=>{requests.push(p);return {task_id:'mock'};},pollCanvasImageTask:async()=>{}});
 const n=input(c);n.model='supported';n.transparentBackground=true;
 const outputs=c.translationOutputNodes(n.id);
 assert.equal(c.translationOutputSettings(n,outputs[0]).transparentBackground,true);
 await c.runTranslationOutputNode(outputs[0].id);
 assert.equal(requests[0].transparent_background,true);
 requests.length=0;outputs.forEach(o=>{o.running=false;o._pending=[];});
 await c.runAllTranslationOutputs(n.id);
 assert.equal(requests.length,2);assert(requests.every(p=>p.transparent_background===true));
 outputs.forEach(o=>{o.running=false;o._pending=[];});
 requests.length=0;n.transparentBackground=false;
 await c.runTranslationOutputNode(outputs[0].id);assert(!('transparent_background' in requests[0]));
 outputs[0].running=false;n.transparentBackground=true;n.model='unsupported';requests.length=0;
 await c.runTranslationOutputNode(outputs[0].id);assert(!('transparent_background' in requests[0]));
 assert.equal(JSON.parse(JSON.stringify(n)).transparentBackground,true);
});
test('control reuses API gate and result warning is escaped',()=>{
 const c=setup({transparentPngState:()=> 'supported',transparentPngUnlocked:()=>true,
 transparentPngRowTitle:()=> 'Alpha PNG',transparentPngHint:()=> '输出真实透明通道',
 escapeAttr:v=>v,escapeHtml:v=>String(v).replaceAll('<','&lt;').replaceAll('>','&gt;')});
 vm.runInContext(between('function translationTransparentControl(', 'function renderTranslationInputBody('),c);
 const html=c.translationTransparentControl({transparentBackground:true});
 assert(html.includes('data-translation-transparent'));assert(html.includes('checked'));assert(html.includes('game-kv-switch'));
 c.transparentPngUnlocked=()=>false;
 assert(!c.translationTransparentControl({transparentBackground:true}).includes(' checked'));
});
