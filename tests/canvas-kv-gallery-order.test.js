'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'static', 'js', 'canvas.js'), 'utf8');
function between(start, end){
    const first = source.indexOf(start);
    const last = source.indexOf(end, first + start.length);
    assert.ok(first >= 0 && last > first);
    return source.slice(first, last);
}

test('finished gallery image links resolve the blue output instead of the first output', () => {
    const metadataPort = {getBoundingClientRect:() => ({left:10, top:20, width:10, height:10})};
    const imagePort = {getBoundingClientRect:() => ({left:10, top:60, width:10, height:10})};
    const galleryElement = {querySelector:selector => ({
        '.port[data-port="out"]':imagePort,
        '.port[data-port="galleryOut"]':metadataPort,
        '.port.out':metadataPort
    })[selector] || null};
    const nodes = [{id:'gallery'}];
    const resolve = new Function('nodes', 'nodesEl', 'CSS', 'screenToWorld', `
        ${between('function portSide', 'function canResolvePort')}
        return connection => portPoint(connection.from, connectionPort(connection, 'from'));
    `)(nodes, {querySelector:() => galleryElement}, {escape:value => value}, (x, y) => ({x, y}));
    assert.deepEqual(resolve({from:'gallery', fromPort:'out'}), {x:15, y:65});
    assert.deepEqual(resolve({from:'gallery', fromPort:'galleryOut'}), {x:15, y:25});
    assert.deepEqual(resolve({from:'gallery'}), {x:15, y:65});
    delete galleryElement.querySelector;
    galleryElement.querySelector = selector => selector === '.port.out' ? imagePort : null;
    assert.deepEqual(resolve({from:'gallery', fromPort:'out'}), {x:15, y:65});
});

function graph(){
    const nodes = ['a', 'b', 'logo', 'button', 'copy', 'extra1', 'extra2'].map(id => ({id, type:'image', url:`/${id}.png`, name:id}));
    const gallery = {id:'gallery', type:'kvReferenceGallery', slots:[
        {slotId:'main', role:'main', imageNodeId:'a', prompt:'图片1作为角色参考'},
        {slotId:'logo', role:'logo', imageNodeId:'logo', prompt:'图片2作为Logo参考'},
        {slotId:'downloadButton', role:'downloadButton', imageNodeId:'button'},
        {slotId:'copyStyle', role:'copyStyle', imageNodeId:'copy'},
        {slotId:'custom-b', role:'custom', imageNodeId:'b', prompt:'图片5作为场景参考'}
    ]};
    const upstream = {id:'upstream', type:'gameKvPrompt', references:[]};
    const downstream = {id:'downstream', type:'gameKvPopupPrompt', references:[]};
    const master = {id:'master', type:'masterGenerator', inputs:[]};
    const childMaster = {id:'child-master', type:'masterGenerator', inputs:['extra2', 'collection:copy', 'extra1']};
    const api = {id:'api', type:'generator', inputs:['extra2', 'collection:logo', 'extra1']};
    nodes.push(gallery, upstream, downstream, master, childMaster, api,
        {id:'collection', type:'group', items:['a', 'b', 'logo', 'button', 'copy']});
    const connections = [
        {from:'gallery', to:'upstream', kind:'kvReferenceGallery', fromPort:'galleryOut', toPort:'galleryIn'},
        {from:'upstream', to:'master', kind:'kvImageBinding', fromPort:'imageOut', toPort:'in'},
        {from:'upstream', to:'downstream', kind:'kvInheritance', fromPort:'kvOut', toPort:'kvIn'},
        {from:'downstream', to:'child-master', kind:'kvImageBinding', fromPort:'imageOut', toPort:'in'},
        {from:'collection', to:'child-master', kind:'dataFlow'},
        {from:'extra1', to:'child-master', kind:'dataFlow'},
        {from:'extra2', to:'child-master', kind:'dataFlow'},
        {from:'gallery', to:'api', kind:'dataFlow', fromPort:'out', toPort:'in'},
        {from:'collection', to:'api', kind:'dataFlow'},
        {from:'extra1', to:'api', kind:'dataFlow'},
        {from:'extra2', to:'api', kind:'dataFlow'}
    ];
    const apiFunctions = new Function('nodes', 'connections', `
        const CANVAS_GENERATOR_TYPES = ['generator', 'masterGenerator'];
        const CANVAS_MEDIA_OUTPUT_TYPES = [];
        const isGameKvPromptNode = node => node?.type === 'gameKvPrompt';
        const isGameKvPopupPromptNode = node => node?.type === 'gameKvPopupPrompt';
        const isIrregularPopupKvPromptNode = node => node?.type === 'irregularPopupKvPrompt';
        const isLabelNode = () => false;
        const canvasDataConnections = () => connections;
        const mediaKindForNode = () => 'image';
        const imageRefsOnly = refs => (refs || []).filter(ref => ref.url && (!ref.kind || ref.kind === 'image'));
        const window = {GameKvPrompt:{DEFAULTS:{references:[]}}};
        const configuredPopupReferences = node => node.references;
        const configuredIrregularPopupReferences = node => node.references;
        const pushUndo = () => {};
        const render = () => {};
        const scheduleSave = () => {};
        const scheduleKvGraphRefresh = () => {};
        const syncPromptChainOutputs = () => {};
        const refreshGeneratorInputViews = () => {};
        const ltxSyncConnectedImagesToTimeline = () => {};
        const wouldCreateGeneratorCycle = () => false;
        ${between('const KV_CONNECTION_KIND_PROMPT', 'function kvLanguageOptions')}
        ${between('function updateKvReferenceSetting', 'function clearKvReferenceOverride')}
        ${between('function kvReferenceSelectionKey', 'function kvReferenceThumbnailHtml')}
        ${between('function generatedImageRefs', 'function generatorSources')}
        ${between('function generatorSources', 'let generatorInputSyncTimer')}
        ${between('function connectionKindFromPorts', 'function sanitizeConnections')}
        return {kvGalleryReferences, normalizeKvReferenceGallery, reorderKvGallerySlots,
            generatorSources, orderedSources, syncGeneratorInputs, reorderInput,
            kvEffectiveReferences, configuredKvReferences, updateKvReferenceSetting,
            kvResolveReferenceSelection, applyKvReferencesToMasterInputs, canConnect};
    `)(nodes, connections);
    return {...apiFunctions, nodes, connections, gallery, upstream, downstream, master, childMaster, api};
}

test('gallery outputs reach both API and master while collection duplicates are removed', () => {
    const g = graph();
    g.syncGeneratorInputs();
    assert.deepEqual(g.master.inputs, ['a', 'b', 'logo', 'button', 'copy']);
    assert.deepEqual(g.api.inputs, ['a', 'b', 'logo', 'button', 'copy', 'extra2', 'extra1']);
    assert.equal(g.generatorSources(g.api).flatMap(item => item.refs).length, 7);
    assert.equal(g.canConnect('gallery', 'api', 'out', 'in'), true);
    assert.equal(g.canConnect('gallery', 'master', 'out', 'in'), true);
    assert.equal(g.canConnect('gallery', 'upstream', 'galleryOut', 'galleryIn'), true);
    assert.equal(g.canConnect('gallery', 'api', 'galleryOut', 'in'), false);
});

test('gallery reordering synchronizes KV, API and downstream inherited images', () => {
    const g = graph();
    g.syncGeneratorInputs();
    assert.equal(g.reorderKvGallerySlots(g.gallery, 'custom-b', 'main'), true);
    const expected = ['b', 'a', 'logo', 'button', 'copy'];
    assert.deepEqual(g.master.inputs, expected);
    assert.deepEqual(g.api.inputs, [...expected, 'extra2', 'extra1']);
    assert.deepEqual(g.childMaster.inputs, expected.map(id => `collection:${id}`).concat('extra2', 'extra1'));
    const upstream = g.kvEffectiveReferences(g.upstream, g.configuredKvReferences(g.upstream));
    const downstream = g.kvEffectiveReferences(g.downstream, g.configuredKvReferences(g.downstream));
    assert.deepEqual(upstream.map(ref => ref.sourceNodeId), expected);
    assert.deepEqual(downstream.map(ref => ref.sourceNodeId), [...expected, 'extra2', 'extra1']);
    assert.deepEqual(downstream.map(ref => ref.imageNumber), [1, 2, 3, 4, 5, 6, 7]);
    assert.equal(upstream.every(ref => ref.orderLocked), true);
    assert.equal(downstream.slice(0, 5).every(ref => ref.inherited), true);
    assert.equal(downstream.slice(5).some(ref => ref.orderLocked), false);
    assert.match(upstream[0].prompt, /图片1/);
    assert.match(upstream[1].prompt, /图片2/);
});

test('manual ordering is limited to extra images and downstream local images', () => {
    const g = graph();
    g.syncGeneratorInputs();
    const original = g.api.inputs.slice();
    g.reorderInput(g.api, 'b', 'a');
    assert.deepEqual(g.api.inputs, original);
    g.reorderInput(g.api, 'extra1', 'extra2');
    assert.deepEqual(g.api.inputs.slice(-2), ['extra1', 'extra2']);
    g.reorderInput(g.childMaster, 'extra1', 'extra2');
    assert.deepEqual(g.childMaster.inputs.slice(-2), ['extra1', 'extra2']);
    g.reorderInput(g.childMaster, 'extra1', 'collection:a');
    assert.deepEqual(g.childMaster.inputs.slice(0, 5), ['a', 'b', 'logo', 'button', 'copy'].map(id => `collection:${id}`));
    assert.equal(g.applyKvReferencesToMasterInputs(g.upstream), 0);
});

test('empty and disabled gallery slots do not consume API image numbers', () => {
    const g = graph();
    g.gallery.slots.find(slot => slot.slotId === 'logo').enabled = false;
    g.gallery.slots.find(slot => slot.slotId === 'copyStyle').imageNodeId = '';
    const refs = g.kvGalleryReferences(g.gallery);
    assert.deepEqual(refs.map(ref => ref.slotId), ['main', 'custom-b', 'downloadButton']);
    assert.deepEqual(refs.map(ref => ref.imageNumber), [1, 2, 3]);
    const apiImages = g.orderedSources(g.master, g.generatorSources(g.master));
    assert.deepEqual(apiImages.map(item => item.id), ['a', 'b', 'button']);
    g.gallery.slots.find(slot => slot.slotId === 'logo').enabled = true;
    assert.deepEqual(g.kvGalleryReferences(g.gallery).map(ref => ref.imageNumber), [1, 2, 3, 4]);
});

test('fixed roles stay at the gallery tail and reference selections survive reordering', () => {
    const g = graph();
    g.normalizeKvReferenceGallery(g.gallery);
    assert.deepEqual(g.gallery.slots.map(slot => slot.slotId), ['main', 'custom-b', 'logo', 'downloadButton', 'copyStyle']);
    assert.equal(g.reorderKvGallerySlots(g.gallery, 'logo', 'main'), false);
    g.upstream.logoReference = 1;
    const selected = g.kvResolveReferenceSelection(g.upstream, 'logoReference', g.kvEffectiveReferences(g.upstream));
    assert.equal(selected.gallerySlotId, 'logo');
    g.reorderKvGallerySlots(g.gallery, 'custom-b', 'main');
    assert.equal(g.kvResolveReferenceSelection(g.upstream, 'logoReference', g.kvEffectiveReferences(g.upstream)).gallerySlotId, 'logo');
});

test('gallery instructions update KV immediately even after bindings were initialized', () => {
    const g = graph();
    g.kvEffectiveReferences(g.upstream);
    g.gallery.slots.find(slot => slot.slotId === 'main').prompt = '图片1保留角色服装';
    let reference = g.kvEffectiveReferences(g.upstream).find(ref => ref.gallerySlotId === 'main');
    assert.match(reference.prompt, /保留角色服装/);
    g.updateKvReferenceSetting(g.upstream, reference, {prompt:'图片1保留角色发型'});
    reference = g.kvEffectiveReferences(g.upstream).find(ref => ref.gallerySlotId === 'main');
    assert.match(reference.prompt, /保留角色发型/);
    assert.match(g.gallery.slots.find(slot => slot.slotId === 'main').prompt, /保留角色发型/);
});

test('a gallery-connected KV also follows an ordinary API without a master binding', () => {
    const g = graph();
    g.connections.splice(g.connections.findIndex(connection => connection.from === 'upstream' && connection.to === 'master'), 1);
    const refs = g.kvEffectiveReferences(g.upstream);
    assert.deepEqual(refs.map(ref => ref.sourceNodeId), ['a', 'b', 'logo', 'button', 'copy', 'extra2', 'extra1']);
    assert.deepEqual(refs.map(ref => ref.imageNumber), [1, 2, 3, 4, 5, 6, 7]);
    assert.equal(refs.every(ref => ref.orderLocked), true);
});

test('a gallery slot connected to a collection keeps the underlying image identity downstream', () => {
    const g = graph();
    g.gallery.slots.find(slot => slot.slotId === 'main').imageNodeId = 'collection';
    g.syncGeneratorInputs();
    const refs = g.kvEffectiveReferences(g.downstream);
    assert.equal(refs[0].sourceNodeId, 'a');
    assert.equal(refs.filter(ref => ref.sourceNodeId === 'a').length, 1);
    assert.equal(refs.length, 7);
    assert.equal(g.childMaster.inputs[0], 'collection:a');
});

test('gallery prompt renumbering preserves references to other pictures across empty slots', () => {
    const g = graph();
    const main = g.gallery.slots.find(slot => slot.slotId === 'main');
    main.imageNodeId = '';
    const logo = g.gallery.slots.find(slot => slot.slotId === 'logo');
    logo.prompt = '图片2作为Logo，不复制图片5的背景';
    const references = g.kvGalleryReferences(g.gallery);
    assert.match(references.find(ref => ref.gallerySlotId === 'logo').prompt, /图片2作为Logo，不复制图片5的背景/);
    assert.deepEqual(references.map(ref => ref.imageNumber), [1, 2, 3, 4]);
});

test('disconnecting the gallery restores the legacy KV sorting permission', () => {
    const g = graph();
    g.connections.splice(g.connections.findIndex(connection => connection.to === 'upstream' && connection.from === 'gallery'), 1);
    g.connections.push({from:'collection', to:'master', kind:'dataFlow'});
    g.syncGeneratorInputs();
    assert.equal(g.kvEffectiveReferences(g.upstream).some(ref => ref.orderLocked), false);
    g.reorderInput(g.master, 'collection:b', 'collection:a');
    assert.deepEqual(g.master.inputs.slice(0, 2), ['collection:b', 'collection:a']);
});
