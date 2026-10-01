'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'static/js/canvas.js'), 'utf8');
function between(start, end){
    const first = source.indexOf(start);
    const last = source.indexOf(end, first + start.length);
    assert.ok(first >= 0 && last > first);
    return source.slice(first, last);
}
function element(){
    const classes = new Set();
    return {listeners:new Map(),classList:{add:name => classes.add(name),remove:name => classes.delete(name),contains:name => classes.has(name)},
        addEventListener(type, listener, capture=false){
            const listeners = this.listeners.get(type) || [];
            listeners.push({listener,capture});this.listeners.set(type,listeners);
        },closest:() => null};
}
function event(target){
    return {target, stopped:false,defaultPrevented:false,dataTransfer:{files:[{name:'image.png',type:'image/png'}],types:['Files']},
        preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;}};
}
function setup(){
    const preview = element(), board = element(), window = element(), dropOverlay = element();
    const uploaded = [];
    const context = vm.createContext({board,window,dropOverlay,
        hasImageDropData:() => true,hasOutputImageDrag:() => false,isCanvasInputDrag:() => false,
        uploadTranslationImage:(id,file) => {uploaded.push({id,file});return new Promise(() => {});},
        showErrorModal:() => {},render:() => {},scheduleSave:() => {},nodes:[]});
    vm.runInContext(between('function allowImageNodeDropEvent', 'async function fillImageNode'), context);
    vm.runInContext(between('function bindTranslationInputBody', 'function bindTranslationOutputBody'), context);
    vm.runInContext(between("board.addEventListener('dragover'", "window.addEventListener('paste'"), context);
    context.bindTranslationInputBody({querySelector:selector => selector === '[data-translation-image]' ? preview : null,querySelectorAll:() => []}, {id:'translation'});
    function dispatch(target, type){
        const current = event(target);
        for(const {listener,capture} of window.listeners.get(type) || []) if(capture) listener(current);
        for(const {listener} of target.listeners.get(type) || []) listener(current);
        if(!current.stopped && target !== board) for(const {listener} of board.listeners.get(type) || []) listener(current);
        if(!current.stopped) for(const {listener,capture} of window.listeners.get(type) || []) if(!capture) listener(current);
        return current;
    }
    return {context,preview,board,window,dropOverlay,uploaded,dispatch};
}

test('dropping a file into translation source clears overlay immediately while upload is pending', () => {
    const api = setup();
    api.dispatch(api.board,'dragover');
    assert.equal(api.dropOverlay.classList.contains('active'),true);
    api.dispatch(api.preview,'dragover');
    const dropped = api.dispatch(api.preview,'drop');
    assert.equal(api.uploaded.length,1);
    assert.equal(dropped.stopped,true);
    assert.equal(api.dropOverlay.classList.contains('active'),false);
    assert.equal(api.preview.classList.contains('drag-over'),false);
});

test('translation dragover hides board overlay and stops propagation like image and gallery previews', () => {
    const api = setup();
    api.dropOverlay.classList.add('active');
    const drag = api.dispatch(api.preview,'dragover');
    assert.equal(drag.stopped,true);
    assert.equal(drag.defaultPrevented,true);
    assert.equal(drag.dataTransfer.dropEffect,'copy');
    assert.equal(api.dropOverlay.classList.contains('active'),false);
    assert.equal(api.preview.classList.contains('drag-over'),true);
});

test('global cleanup observes drop even when a nested node stops propagation', () => {
    const api = setup();
    const nested = element();
    nested.addEventListener('drop', event => event.stopPropagation());
    api.dropOverlay.classList.add('active');
    api.dispatch(nested,'drop');
    assert.equal(api.dropOverlay.classList.contains('active'),false);
});

test('ordinary image cleanup occurs before asynchronous file resolution', async () => {
    let resolveFile;
    const api = setup();
    api.context.resolveImageDropPayload = () => new Promise(resolve => {resolveFile=resolve;});
    api.dropOverlay.classList.add('active');
    const dropped = event(api.preview);
    const pending = api.context.handleImageNodeDropEvent(dropped,'image',api.preview);
    assert.equal(dropped.stopped,true);
    assert.equal(api.dropOverlay.classList.contains('active'),false);
    resolveFile({type:'none'});
    await pending;
});
