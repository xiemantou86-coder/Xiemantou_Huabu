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

function groupMembershipApi(initialNodes){
    const block = sourceBetween('function reconcileAllGroupMemberships', 'function portSide');
    return new Function('initialNodes', `
        const canvas = {id:'loaded-canvas'};
        const nodes = initialNodes;
        let connections = [];
        const CANVAS_GENERATOR_TYPES = [];
        const isContainerGroupNode = node => node?.type === 'containerGroup';
        const nodeRect = node => {
            const x = Number(node?.x) || 0;
            const y = Number(node?.y) || 0;
            const w = Number(node?.w) || 100;
            const h = Number(node?.h) || 100;
            return {x, y, w, h, cx:x + w / 2, cy:y + h / 2};
        };
        const canConnect = () => false;
        const uid = prefix => prefix + '-test';
        const syncGeneratorInputs = () => {};
        const refreshGeneratorInputViews = () => {};
        const render = () => {};
        const scheduleSave = () => {};
        ${block}
        return {reconcileAllGroupMemberships};
    `)(initialNodes);
}

function memberIds(node, field){
    return [...(node[field] || [])].sort();
}

test('opening or importing recalculates group membership from current geometry', () => {
    const nodes = [
        {id:'mixed-group', type:'group', x:0, y:0, w:400, h:400, items:['outside-image', 'inside-llm', 'missing-node']},
        {id:'prompt-group', type:'promptGroup', x:500, y:0, w:400, h:400, items:['outside-prompt', 'inside-prompt-group-image']},
        {id:'container', type:'containerGroup', x:1000, y:0, w:400, h:400, members:['outside-label', 'nested-container']},
        {id:'inside-image', type:'image', x:20, y:20, w:100, h:100},
        {id:'inside-prompt', type:'prompt', x:180, y:30, w:100, h:100},
        {id:'inside-llm', type:'llm', x:80, y:220, w:100, h:100},
        {id:'outside-image', type:'image', x:1500, y:700, w:100, h:100},
        {id:'inside-prompt-group', type:'prompt', x:530, y:30, w:100, h:100},
        {id:'inside-prompt-group-image', type:'image', x:700, y:30, w:100, h:100},
        {id:'outside-prompt', type:'prompt', x:1500, y:850, w:100, h:100},
        {id:'inside-container-label', type:'label', x:1030, y:30, w:100, h:100},
        {id:'inside-container-video', type:'video', x:1180, y:40, w:100, h:100},
        {id:'inside-container-group', type:'group', x:1040, y:200, w:120, h:120, items:[]},
        {id:'outside-label', type:'label', x:1550, y:1000, w:100, h:100},
        {id:'nested-container', type:'containerGroup', x:1160, y:210, w:120, h:120, members:[]}
    ];
    const api = groupMembershipApi(nodes);

    assert.equal(api.reconcileAllGroupMemberships({render:false, persist:false}), true);

    assert.deepEqual(memberIds(nodes[0], 'items'), ['inside-image', 'inside-prompt']);
    assert.deepEqual(memberIds(nodes[1], 'items'), ['inside-prompt-group']);
    assert.deepEqual(memberIds(nodes[2], 'members'), [
        'inside-container-group',
        'inside-container-label',
        'inside-container-video'
    ]);
});

test('canvas open and workflow import invoke membership reconciliation after loading nodes', () => {
    const openBlock = sourceBetween('async function openCanvas', 'function applyRemoteCanvasData');
    const importBlock = sourceBetween('function insertWorkflowIntoCanvas', 'async function importWorkflowFile');

    assert.match(openBlock, /nodes = canvas\.nodes \|\| \[\];[\s\S]*reconcileAllGroupMemberships\(\);/);
    assert.match(importBlock, /nodes\.push\(\.\.\.newNodes\);[\s\S]*reconcileAllGroupMemberships\(\{persist:false\}\);/);
});
