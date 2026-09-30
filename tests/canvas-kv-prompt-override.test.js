'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'static', 'js', 'canvas.js'), 'utf8');
function between(start, end){
    const first = source.indexOf(start);
    const last = source.indexOf(end, first + start.length);
    assert.ok(first >= 0 && last > first, `missing ${start} / ${end}`);
    return source.slice(first, last);
}

const stateFunctions = between('function syncKvTextToPrompt', 'function syncGameKvPromptOutputs');
function stateApi(){
    return new Function('refreshSyncedPromptDom', `${stateFunctions}\nreturn {syncKvTextToPrompt, setKvPromptManualOverride, applyKvPromptUpdate};`)(() => {});
}

test('connected prompt keeps manual text, reports a KV change, and applies it only on request', () => {
    const api = stateApi();
    const prompt = {type:'prompt', text:'原有文字'};
    api.syncKvTextToPrompt(prompt, 'KV 第一版', {updateDom:false});
    assert.equal(prompt.text, 'KV 第一版');

    api.setKvPromptManualOverride(prompt, true);
    prompt.text = '我修改的提示词';
    api.syncKvTextToPrompt(prompt, 'KV 第二版', {updateDom:false});
    assert.equal(prompt.text, '我修改的提示词');
    assert.equal(prompt.kvPendingUpdate, true);

    const restored = JSON.parse(JSON.stringify(prompt));
    api.syncKvTextToPrompt(restored, 'KV 第二版', {updateDom:false});
    assert.equal(restored.text, '我修改的提示词');
    assert.equal(restored.kvPendingUpdate, true);

    api.applyKvPromptUpdate(restored);
    assert.equal(restored.text, 'KV 第二版');
    assert.equal(restored.kvPendingUpdate, false);
    assert.equal(restored.kvManualOverride, true);

    restored.text = '再次修改';
    api.syncKvTextToPrompt(restored, 'KV 第三版', {updateDom:false});
    assert.equal(restored.text, '再次修改');
    api.setKvPromptManualOverride(restored, false);
    assert.equal(restored.text, 'KV 第三版');
    api.syncKvTextToPrompt(restored, 'KV 第四版', {updateDom:false});
    assert.equal(restored.text, 'KV 第四版');
});

for(const [kind, start, end, syncName] of [
    ['基础 KV', 'function syncGameKvPromptOutputs', 'function syncAllGameKvPromptOutputs', 'syncGameKvPromptOutputs'],
    ['大弹窗 KV', 'function syncGameKvPopupPromptOutputs', 'function syncPromptChainOutputs', 'syncGameKvPopupPromptOutputs'],
    ['异形弹窗 KV', 'function syncIrregularPopupKvPromptOutputs', 'function addLabelNode', 'syncIrregularPopupKvPromptOutputs']
]){
    test(`${kind} 的连接同步保留提示词手动修改`, () => {
        const sourceNode = {id:'kv', type:kind, text:'', generated:'新 KV 提示词'};
        const prompt = {id:'prompt', type:'prompt', text:'旧 KV 提示词', kvSourceText:'旧 KV 提示词', kvManualBaseText:'旧 KV 提示词', kvManualOverride:true};
        const nodes = [sourceNode, prompt];
        const dependencies = {
            nodes,
            canvasDataConnections:() => [{from:'kv', to:'prompt'}],
            isKvPromptConnection:() => true,
            isKvInheritanceConnection:() => false,
            isGameKvPromptNode:node => kind === '基础 KV' && node === sourceNode,
            isGameKvPopupPromptNode:node => kind === '大弹窗 KV' && node === sourceNode,
            isIrregularPopupKvPromptNode:node => kind === '异形弹窗 KV' && node === sourceNode,
            compileGameKvPrompt:node => node.generated,
            gameKvPopupPromptSegments:node => ({own:node.generated, combined:node.generated}),
            irregularPopupKvPromptSegments:node => ({own:node.generated, combined:node.generated}),
            refreshGameKvPopupPromptDom:() => {},
            refreshIrregularPopupKvPromptDom:() => {},
            syncKvInheritedConfiguration:() => {},
            syncGameKvPopupPromptOutputs:() => {},
            syncIrregularPopupKvPromptOutputs:() => {}
        };
        const block = between(start, end);
        const inheritedSyncs = kind === '基础 KV'
            ? 'const syncGameKvPopupPromptOutputs = deps.syncGameKvPopupPromptOutputs; const syncIrregularPopupKvPromptOutputs = deps.syncIrregularPopupKvPromptOutputs;'
            : '';
        const run = new Function('deps', 'syncKvTextToPrompt', `
            const {nodes, canvasDataConnections, isKvPromptConnection, isKvInheritanceConnection,
                isGameKvPromptNode, isGameKvPopupPromptNode, isIrregularPopupKvPromptNode,
                compileGameKvPrompt, gameKvPopupPromptSegments, irregularPopupKvPromptSegments,
                refreshGameKvPopupPromptDom, refreshIrregularPopupKvPromptDom,
                syncKvInheritedConfiguration} = deps;
            ${inheritedSyncs}
            ${block}
            return ${syncName};
        `)(dependencies, stateApi().syncKvTextToPrompt);
        run('kv', {updateDom:false});
        assert.equal(prompt.text, '旧 KV 提示词');
        assert.equal(prompt.kvSourceText, '新 KV 提示词');
        assert.equal(prompt.kvPendingUpdate, true);
    });
}
