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

test('gallery slot previews are wired to the same external image drop path as image nodes', () => {
    const render = between('function renderKvReferenceGalleryNode', 'function renderNode');
    assert.match(render, /data-gallery-drop-preview/);
    assert.match(render, /ondragover\s*=\s*event\s*=>\s*allowImageNodeDropEvent\(event, preview\)/);
    assert.match(render, /ondrop\s*=\s*event\s*=>\s*handleKvGallerySlotDropEvent\(event, node\.id, slotId, preview\)/);
});

test('gallery drop handler keeps one image per slot and accepts output or external payloads', () => {
    const handler = between('async function handleKvGallerySlotDropEvent', 'function isKvGalleryConnection');
    assert.match(handler, /application\/x-canvas-output-image/);
    assert.match(handler, /resolveImageDropPayload\(e\.dataTransfer\)/);
    assert.match(handler, /mediaKindForUpload\(file\) === 'image'/);
    assert.match(handler, /slice\(0, 1\)/);
});

test('gallery drop creates an image source and binds it to the selected slot', () => {
    const apply = between('async function applyImageDropPayloadToGallerySlot', 'function handleKvGallerySlotDropEvent');
    assert.match(apply, /createImageNodeFromGalleryDropPayload/);
    assert.match(apply, /kind:KV_CONNECTION_KIND_GALLERY_SLOT/);
    assert.match(apply, /toPort:`gallerySlot:\$\{slotId\}`/);
    assert.match(apply, /slot\.imageNodeId = imageNode\.id/);
});

test('gallery drop updates an existing image source instead of making duplicate nodes', () => {
    const apply = between('async function applyImageDropPayloadToGallerySlot', 'function handleKvGallerySlotDropEvent');
    assert.match(apply, /existing\?\.source\?\.type === 'image'/);
    assert.match(apply, /applyImageDropPayloadToNode\(existing\.source\.id/);
    assert.match(apply, /return existing\.source/);
});

