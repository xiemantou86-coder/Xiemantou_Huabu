'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const canvasSource = fs.readFileSync(path.join(__dirname, '..', 'static', 'js', 'canvas.js'), 'utf8');

function sourceBetween(startMarker, endMarker){
    const start = canvasSource.indexOf(startMarker);
    const end = canvasSource.indexOf(endMarker, start + startMarker.length);
    assert.notEqual(start, -1, `missing ${startMarker}`);
    assert.notEqual(end, -1, `missing ${endMarker}`);
    return canvasSource.slice(start, end);
}

function connectionKindApi(){
    const block = sourceBetween('function isKvPromptNode', 'function isKvPromptConnection');
    return new Function('deps', `
        const {nodes, CANVAS_GENERATOR_TYPES, isLabelNode, isGameKvPromptNode, isGameKvPopupPromptNode, isIrregularPopupKvPromptNode} = deps;
        const KV_CONNECTION_KIND_PROMPT = 'promptFlow';
        const KV_CONNECTION_KIND_IMAGE = 'kvImageBinding';
        const KV_CONNECTION_KIND_INHERIT = 'kvInheritance';
        const KV_CONNECTION_KIND_LEGACY_PROMPT = 'legacyKvPromptFlow';
        ${block}
        return {kvConnectionKind};
    `)({
        nodes:[],
        CANVAS_GENERATOR_TYPES:['generator', 'masterGenerator'],
        isLabelNode:node => node?.type === 'label',
        isGameKvPromptNode:node => node?.type === 'gameKvPrompt',
        isGameKvPopupPromptNode:node => node?.type === 'gameKvPopupPrompt',
        isIrregularPopupKvPromptNode:node => node?.type === 'irregularPopupKvPrompt'
    });
}

function connectionValidationApi(){
    const kindBlock = sourceBetween('function isKvPromptNode', 'function isKvPromptConnection');
    const validationBlock = sourceBetween('function connectionKindFromPorts', 'function sanitizeConnections');
    const nodes = [];
    const api = new Function('deps', `
        const {nodes, CANVAS_GENERATOR_TYPES, CANVAS_MEDIA_OUTPUT_TYPES, isLabelNode, isGameKvPromptNode, isGameKvPopupPromptNode, isIrregularPopupKvPromptNode, wouldCreateGeneratorCycle} = deps;
        const KV_CONNECTION_KIND_PROMPT = 'promptFlow';
        const KV_CONNECTION_KIND_IMAGE = 'kvImageBinding';
        const KV_CONNECTION_KIND_INHERIT = 'kvInheritance';
        const KV_CONNECTION_KIND_LEGACY_PROMPT = 'legacyKvPromptFlow';
        ${kindBlock}
        ${validationBlock}
        return {normalizedCanvasConnection, canConnect};
    `)({
        nodes,
        CANVAS_GENERATOR_TYPES:['generator', 'masterGenerator'],
        CANVAS_MEDIA_OUTPUT_TYPES:['generator', 'masterGenerator'],
        isLabelNode:node => node?.type === 'label',
        isGameKvPromptNode:node => node?.type === 'gameKvPrompt',
        isGameKvPopupPromptNode:node => node?.type === 'gameKvPopupPrompt',
        isIrregularPopupKvPromptNode:node => node?.type === 'irregularPopupKvPrompt',
        wouldCreateGeneratorCycle:() => false
    });
    return {...api, nodes};
}

function referenceKeyApi(){
    const block = sourceBetween('function kvReferenceIdentity', 'function kvBoundImageEntries');
    return new Function('isKvPromptNode', `
        ${block}
        return {kvReferenceIdentity, kvLegacyReferenceAliases, kvTakeKeyedSetting, remapKvReferenceKey, remapKvReferenceState};
    `)(node => ['gameKvPrompt', 'gameKvPopupPrompt', 'irregularPopupKvPrompt'].includes(node?.type));
}

function referenceGraphApi(upstream, downstream){
    const renumberBlock = sourceBetween('function renumberKvReferencePrompt', 'function kvLocalBoundReferences');
    const effectiveBlock = sourceBetween('function kvEffectiveReferences', 'function kvLanguageOptions');
    const languageBlock = sourceBetween('function kvLanguageOptions', 'function updateKvReferenceSetting');
    return new Function('deps', `
        const {kvInheritanceSource, configuredKvReferences, kvTakeKeyedSetting, kvLocalBoundReferences, kvBoundMasterGenerator, window, GAME_KV_POPUP_LANGUAGE_DEFAULTS} = deps;
        ${renumberBlock}
        ${effectiveBlock}
        ${languageBlock}
        return {renumberKvReferencePrompt, kvEffectiveReferences, kvEffectiveLanguage};
    `)({
        kvInheritanceSource:node => node?.id === downstream?.id ? upstream : null,
        configuredKvReferences:node => Array.isArray(node?.references) ? node.references : [],
        kvTakeKeyedSetting:(map, key) => map && Object.prototype.hasOwnProperty.call(map, key) ? map[key] : null,
        kvLocalBoundReferences:node => Array.isArray(node?.boundReferences) ? node.boundReferences : [],
        kvBoundMasterGenerator:node => node?.boundMaster || null,
        window:{GameKvPrompt:{LANGUAGE_OPTIONS:[]}},
        GAME_KV_POPUP_LANGUAGE_DEFAULTS:[{value:'en', label:'英文', prompt:'英文', buttonText:'Download'}]
    });
}

function copyInheritanceApi(upstream, downstream){
    const block = sourceBetween('function kvPromptCopyLocked', 'function updateKvReferenceSetting');
    return new Function('kvInheritanceSource', `
        ${block}
        return {kvPromptCopyLocked, kvEffectiveCopy};
    `)(node => node?.id === downstream?.id ? (upstream || null) : null);
}

function promptCompilerApi(){
    const popupBlock = sourceBetween('function kvReferenceMatchesRole', 'function normalizeGameKvPopupPromptNode');
    const irregularBlock = sourceBetween('function compileIrregularPopupKvConfig', 'function normalizeIrregularPopupKvPromptNode');
    const resolveReference = (node, field, references) => {
        const value = String(node?.[field] ?? '').trim();
        if(!value || value === 'none') return null;
        if(/^\d+$/.test(value)) return references[Number(value) - 1] || null;
        return references.find(reference => [reference.sourceKey, reference.id, reference.value].filter(Boolean).map(String).includes(value)) || null;
    };
    return new Function('deps', `
        const {kvEffectiveLanguage, kvEffectiveCopy, popupReferences, popupPlacementText, kvResolveReferenceSelection, kvReferenceSelectionKey, irregularPopupReferences, irregularPopupPreset, IRREGULAR_POPUP_COMPOSITIONS, IRREGULAR_POPUP_STYLES} = deps;
        ${popupBlock}
        ${irregularBlock}
        return {compileGameKvPopupConfig, compileIrregularPopupKvConfig};
    `)({
        kvEffectiveLanguage:() => ({value:'zh-hant', label:'繁体中文', prompt:'繁体中文', buttonText:'立即下載'}),
        kvEffectiveCopy:node => ({mainTitle:String(node?.mainTitle || ''), subtitle:String(node?.subtitle || ''), inherited:false}),
        popupReferences:node => node.references || [],
        popupPlacementText:node => node.copyPlacement === 'left'
            ? {summary:'左广告右主图', rule:'左文右图。', align:'左侧'}
            : {summary:'左主图右广告', rule:'左图右文。', align:'右侧'},
        kvResolveReferenceSelection:resolveReference,
        kvReferenceSelectionKey:reference => String(reference?.sourceKey || reference?.id || reference?.value || ''),
        irregularPopupReferences:node => node.references || [],
        irregularPopupPreset:(list, value) => list.find(item => item.value === value) || list[0],
        IRREGULAR_POPUP_COMPOSITIONS:[{value:'comic', prompt:'漫画破框构图。'}],
        IRREGULAR_POPUP_STYLES:[{value:'anime', prompt:'日系动漫游戏风格。'}]
    });
}

function promptSegmentApi(){
    const popupBlock = sourceBetween('function gameKvPopupPromptSegments', 'function refreshGameKvPopupPromptDom');
    const irregularBlock = sourceBetween('function irregularPopupKvPromptSegments', 'function refreshIrregularPopupKvPromptDom');
    return new Function('deps', `
        const {gameKvPopupPromptUpstream, compileGameKvPopupPrompt, irregularPopupKvPromptUpstream, compileIrregularPopupKvPrompt} = deps;
        ${popupBlock}
        ${irregularBlock}
        return {gameKvPopupPromptSegments, irregularPopupKvPromptSegments};
    `)({
        gameKvPopupPromptUpstream:() => '游戏 KV 第一段',
        compileGameKvPopupPrompt:() => '大弹窗 KV 第二段',
        irregularPopupKvPromptUpstream:() => '游戏 KV 第一段',
        compileIrregularPopupKvPrompt:() => '异形弹窗 KV 第二段'
    });
}

function kvBindingInteractionApi(){
    const serializableBlock = sourceBetween('function serializableCanvasNode', 'async function saveCanvas');
    const connectionKindBlock = sourceBetween('function isKvPromptNode', 'function kvInheritanceConnectionFor');
    const boundMasterBlock = sourceBetween('function kvBoundMasterConnection', 'function configuredKvReferences');
    const referenceBlock = sourceBetween('function kvReferenceIdentity', 'function renumberKvReferencePrompt');
    const dataConnectionsBlock = sourceBetween('function canvasDataConnections', 'function labelBindingFor');
    const promptChainBlock = sourceBetween('function syncPromptChainOutputs', 'const IRREGULAR_POPUP_KV_PROMPT_VERSION');
    const syncAllBlock = sourceBetween('function syncAllGameKvPromptOutputs', 'function gameKvSelectOptions');
    const generatorBlock = sourceBetween('function generatorSources', 'function syncGeneratorInputs');
    const syncInputsBlock = sourceBetween('function syncGeneratorInputs', 'let generatorInputSyncTimer');
    const deleteBlock = sourceBetween('function deleteConnection', 'function outputDownloadName');
    const undoBlock = sourceBetween('function pushUndo', 'function cloneNode');
    const sanitizeBlock = sourceBetween('function sanitizeConnections', 'function endDrag');
    const initialNodes = [
        {id:'image-a', type:'image', name:'Image A', url:'/output/a.png'},
        {id:'image-b', type:'image', name:'Image B', url:'/output/b.png'},
        {id:'master-1', type:'masterGenerator', inputs:['image-a', 'image-b']},
        {id:'kv-1', type:'gameKvPrompt'}
    ];
    const initialConnections = [
        {id:'image-a-link', kind:'dataFlow', from:'image-a', to:'master-1'},
        {id:'image-b-link', kind:'dataFlow', from:'image-b', to:'master-1'},
        {id:'kv-binding', kind:'kvImageBinding', from:'kv-1', to:'master-1', fromPort:'imageOut', toPort:'in'}
    ];

    return new Function('initialNodes', 'initialConnections', `
        let nodes = JSON.parse(JSON.stringify(initialNodes));
        let connections = JSON.parse(JSON.stringify(initialConnections));
        let hoveredConnectionId = 'kv-binding';
        let saveCount = 0;
        const canvas = {id:'canvas-1'};
        const selected = new Set();
        const undoStack = [];
        const promptSyncCalls = [];
        const kvRenderSnapshots = [];
        const UNDO_MAX = 30;
        const CANVAS_GENERATOR_TYPES = ['masterGenerator'];
        const CANVAS_MEDIA_OUTPUT_TYPES = [];
        const KV_CONNECTION_KIND_PROMPT = 'promptFlow';
        const KV_CONNECTION_KIND_IMAGE = 'kvImageBinding';
        const KV_CONNECTION_KIND_INHERIT = 'kvInheritance';
        const KV_CONNECTION_KIND_LEGACY_PROMPT = 'legacyKvPromptFlow';

        const isLabelNode = () => false;
        const isGameKvPromptNode = node => node?.type === 'gameKvPrompt';
        const isGameKvPopupPromptNode = node => node?.type === 'gameKvPopupPrompt';
        const isIrregularPopupKvPromptNode = node => node?.type === 'irregularPopupKvPrompt';
        const isLabelBindingConnection = connection => connection?.kind === 'labelBinding';
        const normalizedCanvasConnection = connection => ({...connection});
        const canConnect = () => true;
        const sanitizeMasterGeneratorNode = () => {};
        const mediaKindForNode = () => 'image';
        const imageRefsOnly = refs => (refs || []).filter(ref => ref?.url && (!ref.kind || ref.kind === 'image'));
        const ltxSyncConnectedImagesToTimeline = () => {};
        const scheduleSave = () => { saveCount += 1; };
        const syncGameKvPromptOutputs = (sourceId, options={}) => {
            promptSyncCalls.push({sourceId, options:{...options}});
            return false;
        };
        const syncGameKvPopupPromptOutputs = () => false;
        const syncIrregularPopupKvPromptOutputs = () => false;

        ${serializableBlock}
        ${connectionKindBlock}
        ${dataConnectionsBlock}
        ${boundMasterBlock}
        ${referenceBlock}
        ${promptChainBlock}
        ${syncAllBlock}
        ${generatorBlock}
        ${syncInputsBlock}

        function visibleKvReferences(){
            const kv = nodes.find(node => node.id === 'kv-1');
            return kv ? kvBoundImageEntries(kv).map(entry => entry.preview) : [];
        }
        function render(){
            kvRenderSnapshots.push(visibleKvReferences());
        };

        ${deleteBlock}
        ${sanitizeBlock}
        ${undoBlock}

        return {
            reorderInput,
            deleteConnection,
            performUndo,
            visibleKvReferences,
            node:id => nodes.find(node => node.id === id),
            get connections(){ return connections; },
            get promptSyncCalls(){ return promptSyncCalls; },
            get kvRenderSnapshots(){ return kvRenderSnapshots; },
            get undoDepth(){ return undoStack.length; },
            get saveCount(){ return saveCount; }
        };
    `)(initialNodes, initialConnections);
}

test('legacy popup-to-master links keep their prompt-flow meaning', () => {
    const {kvConnectionKind} = connectionKindApi();
    const popup = {id:'popup-1', type:'gameKvPopupPrompt'};
    const irregular = {id:'irregular-1', type:'irregularPopupKvPrompt'};
    const base = {id:'kv-1', type:'gameKvPrompt'};
    const master = {id:'master-1', type:'masterGenerator'};

    assert.equal(kvConnectionKind({}, popup, master), 'legacyKvPromptFlow');
    assert.equal(kvConnectionKind({kind:'dataFlow'}, irregular, master), 'legacyKvPromptFlow');
    assert.equal(kvConnectionKind({kind:'kvImageBinding'}, popup, master), 'kvImageBinding');
    assert.equal(kvConnectionKind({kind:'dataFlow'}, base, master), 'kvImageBinding');
});

test('legacy links receive canonical ports while new KV kinds require dedicated ports', () => {
    const {nodes, normalizedCanvasConnection, canConnect} = connectionValidationApi();
    const base = {id:'kv-1', type:'gameKvPrompt'};
    const popup = {id:'popup-1', type:'gameKvPopupPrompt'};
    const master = {id:'master-1', type:'masterGenerator'};
    const prompt = {id:'prompt-1', type:'prompt'};
    nodes.push(base, popup, master, prompt);

    const legacy = normalizedCanvasConnection({id:'old-1', kind:'dataFlow', from:popup.id, to:master.id});
    assert.deepEqual([legacy.kind, legacy.fromPort, legacy.toPort], ['legacyKvPromptFlow', 'out', 'in']);
    assert.equal(canConnect(legacy.from, legacy.to, legacy.fromPort, legacy.toPort, legacy.kind), true);

    assert.equal(canConnect(popup.id, master.id, 'out', 'in', 'kvImageBinding'), false);
    assert.equal(canConnect(popup.id, master.id, 'imageOut', 'in', 'kvImageBinding'), true);
    assert.equal(canConnect(base.id, prompt.id, 'out', 'in', 'promptFlow'), false);
    assert.equal(canConnect(base.id, prompt.id, 'promptOut', 'in', 'promptFlow'), true);
    assert.equal(canConnect(base.id, popup.id, 'out', 'in', 'kvInheritance'), false);
    assert.equal(canConnect(base.id, popup.id, 'kvOut', 'kvIn', 'kvInheritance'), true);
});

test('reference keys survive URL replacement and migrate URL-based saved settings', () => {
    const {kvReferenceIdentity, kvLegacyReferenceAliases, kvTakeKeyedSetting} = referenceKeyApi();
    const before = kvReferenceIdentity({id:'image-1', type:'image', preview:'/output/a.png'}, {url:'/output/a.png'}, 0);
    const afterSource = {id:'image-1', type:'image', preview:'/output/b.png'};
    const afterRef = {url:'/output/b.png'};
    const after = kvReferenceIdentity(afterSource, afterRef, 0);
    assert.equal(after.sourceKey, before.sourceKey);
    assert.doesNotMatch(after.sourceKey, /output\/|\.png/);

    const saved = {'image-1::0::/output/a.png':{label:'character'}};
    const aliases = kvLegacyReferenceAliases(afterSource, afterRef, 0);
    assert.deepEqual(kvTakeKeyedSetting(saved, after.sourceKey, aliases.keys, aliases.prefixes), {label:'character'});
    assert.deepEqual(saved, {[after.sourceKey]:{label:'character'}});

    const generatedBefore = kvReferenceIdentity({id:'gen-1:generated:2:/output/a.png'}, {url:'/output/a.png'}, 0);
    const generatedAfter = kvReferenceIdentity({id:'gen-1:generated:2:/output/b.png'}, {url:'/output/b.png'}, 0);
    assert.equal(generatedAfter.sourceKey, generatedBefore.sourceKey);
});

test('KV keyed state remaps node ids during copy and import', () => {
    const {remapKvReferenceState} = referenceKeyApi();
    const node = {
        type:'gameKvPopupPrompt',
        referenceBindings:{
            'kvref:v2::image-1::node':{label:'hero'},
            'group-1:image-1::0::/output/a.png':{label:'legacy'}
        },
        inheritedReferenceOverrides:{'kvref:v2::image-1::node':{enabled:false}},
        downloadButtonReference:'kvref:v2::image-1::node'
    };
    remapKvReferenceState(node, new Map([['image-1', 'image-2'], ['group-1', 'group-2']]));

    assert.deepEqual(Object.keys(node.referenceBindings).sort(), [
        'group-2:image-2::0::/output/a.png',
        'kvref:v2::image-2::node'
    ]);
    assert.ok(node.inheritedReferenceOverrides['kvref:v2::image-2::node']);
    assert.equal(node.downloadButtonReference, 'kvref:v2::image-2::node');
});

test('an empty bound master suppresses local placeholder references but keeps inherited ones', () => {
    const block = sourceBetween('function kvEffectiveReferences', 'function kvLanguageOptions');
    const upstream = {id:'kv-upstream', type:'gameKvPrompt'};
    const downstream = {id:'kv-downstream', type:'gameKvPopupPrompt'};
    const configured = [{id:'reference-1', label:'reference', prompt:'prompt', enabled:true}];
    const kvEffectiveReferences = new Function('deps', `
        const {kvInheritanceSource, configuredKvReferences, kvTakeKeyedSetting, kvLocalBoundReferences, kvBoundMasterGenerator, renumberKvReferencePrompt} = deps;
        ${block}
        return kvEffectiveReferences;
    `)({
        kvInheritanceSource:node => node.id === downstream.id ? upstream : null,
        configuredKvReferences:() => configured,
        kvTakeKeyedSetting:() => null,
        kvLocalBoundReferences:() => [],
        kvBoundMasterGenerator:node => node.id === downstream.id ? {id:'master-empty'} : null,
        renumberKvReferencePrompt:prompt => prompt
    });

    const references = kvEffectiveReferences(downstream, configured);
    assert.equal(references.length, 1);
    assert.equal(references[0].inherited, true);
    assert.equal(references[0].upstreamNodeId, upstream.id);
});

test('downstream references follow inherited image count and keep overrides local', () => {
    const upstream = {
        id:'kv-upstream',
        references:[
            {id:'hero', imageNumber:1, label:'主角色', prompt:'图片1作为主角色参考', enabled:true},
            {id:'font', imageNumber:2, label:'字体', prompt:'图片2作为字体参考', enabled:true},
            {id:'scene', imageNumber:3, label:'场景', prompt:'图片3作为场景参考', enabled:true}
        ],
        adLanguage:'zh-hant',
        adLanguageOptions:[
            {value:'zh-hant', label:'繁体中文', prompt:'繁体中文', buttonText:'立即下載'},
            {value:'ko', label:'韩文', prompt:'韩文', buttonText:'지금 다운로드'}
        ]
    };
    const downstream = {
        id:'kv-downstream',
        references:[{id:'button', imageNumber:1, label:'下载按钮', prompt:'图片1作为按钮参考，不复制图片2中的文字', enabled:true}],
        inheritedReferenceOverrides:{'kv-upstream::manual::font':{label:'下游字体覆盖', prompt:'图片2作为下游字体参考'}}
    };
    const {kvEffectiveReferences, kvEffectiveLanguage} = referenceGraphApi(upstream, downstream);
    const references = kvEffectiveReferences(downstream);

    assert.deepEqual(references.map(reference => reference.imageNumber), [1, 2, 3, 4]);
    assert.match(references[3].prompt, /图片4作为按钮参考/);
    assert.match(references[3].prompt, /图片2中的文字/);
    assert.equal(references[1].label, '下游字体覆盖');
    assert.equal(upstream.references[1].label, '字体');

    assert.equal(kvEffectiveLanguage(downstream).buttonText, '立即下載');
    upstream.adLanguage = 'ko';
    assert.equal(kvEffectiveLanguage(downstream).buttonText, '지금 다운로드');
});

test('downstream ad copy follows the upstream game KV until copy override is enabled', () => {
    const upstream = {id:'kv-upstream', mainTitle:'強者之戰現在開始', subtitle:'集結魔法騎士，征服四葉草王國！'};
    const downstream = {id:'kv-downstream', mainTitle:'下游本地主标题', subtitle:'下游本地副标题'};
    const {kvEffectiveCopy, kvPromptCopyLocked} = copyInheritanceApi(upstream, downstream);

    assert.equal(kvPromptCopyLocked(downstream), true);
    assert.deepEqual(kvEffectiveCopy(downstream), {mainTitle:'強者之戰現在開始', subtitle:'集結魔法騎士，征服四葉草王國！', inherited:true});

    upstream.mainTitle = '新主标题';
    assert.equal(kvEffectiveCopy(downstream).mainTitle, '新主标题');

    downstream.copyOverride = true;
    assert.equal(kvPromptCopyLocked(downstream), false);
    assert.deepEqual(kvEffectiveCopy(downstream), {mainTitle:'下游本地主标题', subtitle:'下游本地副标题', inherited:false});
    assert.equal(downstream.mainTitle, '下游本地主标题');
});

test('ad copy stays local when no upstream game KV is connected', () => {
    const downstream = {id:'kv-downstream', mainTitle:'本地主标题', subtitle:'本地副标题'};
    const {kvEffectiveCopy, kvPromptCopyLocked} = copyInheritanceApi(null, downstream);
    assert.equal(kvPromptCopyLocked(downstream), false);
    assert.equal(kvEffectiveCopy(downstream).inherited, false);
    assert.equal(kvEffectiveCopy(downstream).mainTitle, '本地主标题');
});

test('reference renumbering changes its own image number without rewriting other references', () => {
    const {renumberKvReferencePrompt} = referenceGraphApi(null, null);
    const prompt = renumberKvReferencePrompt('图片4作为构图参考，图片3作为画面限制', 5, '构图', 4);
    assert.equal(prompt, '图片5作为构图参考，图片3作为画面限制');
});

test('dedicated popup references output once and empty ad copy has no dangling section', () => {
    const {compileGameKvPopupConfig} = promptCompilerApi();
    const references = [
        {id:'hero', imageNumber:1, label:'主角色', prompt:'图片1作为主角色参考', enabled:true},
        {id:'font', imageNumber:2, label:'字体设计', prompt:'图片2作为字体设计与排版参考', enabled:true},
        {id:'button', imageNumber:3, label:'下载按钮', prompt:'图片3作为下载按钮设计参考', enabled:true}
    ];
    const prompt = compileGameKvPopupConfig({
        references,
        copyEnabled:true,
        copyPlacement:'right',
        mainTitle:'主标题',
        subtitleEnabled:false,
        downloadButtonEnabled:true,
        downloadButtonCustom:true,
        downloadButtonReference:'button'
    });
    assert.equal((prompt.match(/图片2作为字体设计与排版参考/g) || []).length, 1);
    assert.doesNotMatch(prompt, /图片3作为下载按钮设计参考/);
    assert.match(prompt, /图片3的按钮包裹文字：立即下載/);
    assert.match(prompt, /参考图说明：\n- 图片1作为主角色参考/);

    const withoutCopy = compileGameKvPopupConfig({references, copyEnabled:false, copyPlacement:'right'});
    assert.doesNotMatch(withoutCopy, /2、为全图增加广告文案/);
});

test('irregular popup no-reference choices emit no button or logo instructions', () => {
    const {compileIrregularPopupKvConfig} = promptCompilerApi();
    const base = {
        references:[
            {id:'hero', imageNumber:1, label:'主体角色', prompt:'图片1作为主体角色参考', enabled:true},
            {id:'button', imageNumber:2, label:'下载按钮', prompt:'图片2作为下载按钮设计参考', enabled:true},
            {id:'logo', imageNumber:3, label:'游戏Logo', prompt:'图片3作为游戏Logo参考', enabled:true},
            {id:'layout', imageNumber:4, label:'构图', prompt:'图片4作为构图参考', enabled:true}
        ],
        compositionPreset:'comic',
        visualStylePreset:'anime',
        backgroundColor:'#000000',
        copyEnabled:true,
        mainTitle:'标题',
        subtitleEnabled:false,
        logoEnabled:true,
        logoReference:'',
        downloadButtonEnabled:true,
        downloadButtonReference:'',
        breakoutCharacter:false,
        breakoutWeapon:false,
        topBreakout:false,
        zDepth:false,
        restrictedArea:false,
        canvasBoundary:false,
        noCrop:false,
        negativeEnabled:false
    };
    const prompt = compileIrregularPopupKvConfig(base);
    assert.doesNotMatch(prompt, /下载按钮|游戏Logo/);
    assert.match(prompt, /图片1作为主体角色参考/);
    assert.match(prompt, /图片4作为构图参考/);

    const withReferences = compileIrregularPopupKvConfig({...base, logoReference:'logo', downloadButtonReference:'button'});
    assert.equal((withReferences.match(/下载按钮/g) || []).length, 1);
    assert.equal((withReferences.match(/游戏Logo/g) || []).length, 1);

    const transparent = compileIrregularPopupKvConfig({...base, backgroundColor:'透明背景，输出png格式', cutoutEnabled:true});
    assert.match(transparent, /透明背景，输出PNG格式。/);
    assert.match(transparent, /保留真实透明通道/);
    assert.doesNotMatch(transparent, /纯色背景干净统一/);
});

test('popup prompt segments preserve upstream-first downstream-second order', () => {
    const {gameKvPopupPromptSegments, irregularPopupKvPromptSegments} = promptSegmentApi();
    assert.equal(gameKvPopupPromptSegments({}).combined, '游戏 KV 第一段\n\n大弹窗 KV 第二段');
    assert.equal(irregularPopupKvPromptSegments({}).combined, '游戏 KV 第一段\n\n异形弹窗 KV 第二段');
    assert.deepEqual(gameKvPopupPromptSegments({blockUpstreamPrompt:true}), {
        upstream:'',
        own:'大弹窗 KV 第二段',
        combined:'大弹窗 KV 第二段'
    });
    assert.deepEqual(irregularPopupKvPromptSegments({blockUpstreamPrompt:true}), {
        upstream:'',
        own:'异形弹窗 KV 第二段',
        combined:'异形弹窗 KV 第二段'
    });
});

test('reordering local thumbnails updates the bound master and refreshes KV output', () => {
    const graph = kvBindingInteractionApi();
    const master = graph.node('master-1');

    assert.deepEqual(graph.visibleKvReferences(), ['/output/a.png', '/output/b.png']);
    graph.reorderInput(master, 'image-b', 'image-a');

    assert.deepEqual(graph.node('master-1').inputs, ['image-b', 'image-a']);
    assert.deepEqual(graph.kvRenderSnapshots.at(-1), ['/output/b.png', '/output/a.png']);
    assert.deepEqual(graph.promptSyncCalls, [
        {sourceId:'kv-1', options:{updateDom:false}}
    ]);
    assert.equal(graph.saveCount, 1);
});

test('deleting a kvImageBinding immediately removes the KV reference images', () => {
    const graph = kvBindingInteractionApi();

    graph.deleteConnection('kv-binding');

    assert.equal(graph.connections.some(connection => connection.id === 'kv-binding'), false);
    assert.deepEqual(graph.visibleKvReferences(), []);
    assert.deepEqual(graph.kvRenderSnapshots.at(-1), []);
    assert.deepEqual(graph.promptSyncCalls, []);
    assert.equal(graph.undoDepth, 1);
});

test('undo immediately restores the kvImageBinding and its reference images', () => {
    const graph = kvBindingInteractionApi();
    graph.deleteConnection('kv-binding');
    assert.deepEqual(graph.kvRenderSnapshots.at(-1), []);
    const syncCountBeforeUndo = graph.promptSyncCalls.length;

    graph.performUndo();

    assert.equal(graph.connections.some(connection => connection.id === 'kv-binding'), true);
    assert.deepEqual(graph.node('master-1').inputs, ['image-a', 'image-b']);
    assert.deepEqual(graph.visibleKvReferences(), ['/output/a.png', '/output/b.png']);
    assert.deepEqual(graph.kvRenderSnapshots.at(-1), ['/output/a.png', '/output/b.png']);
    assert.equal(graph.promptSyncCalls.length - syncCountBeforeUndo, 1);
    assert.equal(graph.undoDepth, 0);
});
