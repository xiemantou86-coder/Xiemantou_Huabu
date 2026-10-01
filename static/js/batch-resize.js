'use strict';

const BATCH_RESIZE_PRESETS = [
    {ratio:'wide', label:'16:9'}, {ratio:'story', label:'9:16'},
    {ratio:'square', label:'1:1'}, {ratio:'landscape43', label:'4:3'},
    {ratio:'portrait43', label:'3:4'}, {ratio:'landscape', label:'3:2'},
    {ratio:'portrait', label:'2:3'}, {ratio:'ultrawide', label:'21:9'},
    {ratio:'ultratall', label:'9:21'}
];
const batchResizeRuns = new WeakMap();
const batchResizeHeights = new WeakMap();

function batchResizeDimensions(size, resolution='1k'){
    if(!BATCH_RESIZE_PRESETS.some(preset => preset.ratio === size.ratio) || !['1k','2k','4k'].includes(resolution))
        throw new Error('请选择有效的目标比例和分辨率');
    return parseSizePair(apiImageSize(size.ratio, resolution));
}
function batchResizeRatioFor(size){
    const preset = BATCH_RESIZE_PRESETS.find(preset => preset.ratio === size.ratio);
    if(preset) return preset.ratio;
    const ratio = Number(size.width) / Number(size.height);
    if(!Number.isFinite(ratio) || ratio <= 0) return BATCH_RESIZE_PRESETS.find(preset => preset.label === size.label)?.ratio || 'square';
    return BATCH_RESIZE_PRESETS.reduce((best, candidate) => {
        const score = item => Math.abs(Math.log(ratio / parseRatioValue(item.label)));
        return score(candidate) < score(best) ? candidate : best;
    }).ratio;
}
function normalizeBatchResizeNode(node){
    if(node.resizeApiVersion === 2) return;
    if(!node.resizeApiVersion){
        node.apiProvider = node.apiProvider || imageApiProviders()[0]?.id || '';
        node.model = node.model || allImageModels(node.apiProvider)[0] || '';
        node.quality = node.quality || 'auto';
        node.supplementalPrompt = node.supplementalPrompt || '';
    }
    node.resizeResolution = ['1k','2k','4k'].includes(node.resizeResolution) ? node.resizeResolution : '1k';
    // Keep the first profile ID per ratio; historical output slots remain intact.
    const ratios = new Set();
    node.resizeSizes = (node.resizeSizes || []).map(size => ({id:size.id || uid('size'), ratio:batchResizeRatioFor(size)}))
        .filter(size => { if(ratios.has(size.ratio)) return false; ratios.add(size.ratio); return true; });
    ['resizeMode','resizeAnchor','resizeBackground','resizeColor'].forEach(key => delete node[key]);
    (node.resizeImages || []).forEach(image => delete image.anchor);
    node.resizeApiVersion = 2;
}
function batchResizePromptFor(image, job, settings){
    const lines = [`原图元素不变，把图片改成${API_RATIO_VALUES[job.ratio]}比例图片。`];
    if(String(settings.supplementalPrompt || '').trim()) lines.push(`补充提示词：${String(settings.supplementalPrompt).trim()}`);
    return lines.join('\n');
}
function addBatchResizeNode(point){
    const p = point || defaultPoint(-220, 0);
    const node = {id:uid('resize'), type:'batchResize', x:p.x, y:p.y, w:740, h:0,
        resizeImages:[], resizeSizes:BATCH_RESIZE_PRESETS.slice(0, 2).map(size => ({ratio:size.ratio, id:uid('size')}))};
    normalizeBatchResizeNode(node);
    return addNode(node);
}
function batchResizeOutputs(sourceId){
    return nodes.filter(node => node.type === 'output' && node.resizeSourceId === sourceId);
}
function ensureBatchResizeSpacing(source){
    const element = nodesEl.querySelector(`.node[data-id="${CSS.escape(source.id)}"]`);
    const height = element?.offsetHeight;
    if(!height) return;
    const before = batchResizeHeights.get(source) ?? height;
    batchResizeHeights.set(source, height);
    if(height <= before) return;
    const outputs = batchResizeOutputs(source.id);
    if(!outputs.length) return;
    const delta = Math.max(0, Number(source.y) + height + 80 - Math.min(...outputs.map(output => output.y)));
    if(!delta) return;
    outputs.forEach(output => {
        output.y += delta;
        const outputEl = nodesEl.querySelector(`.node[data-id="${CSS.escape(output.id)}"]`);
        if(outputEl) outputEl.style.top = `${output.y}px`;
    });
    scheduleSave();
}
function remapBatchResizeState(node, idMap){
    if(!node.resizeSourceId) return;
    const newId = idMap.get(node.resizeSourceId);
    if(newId) node.resizeSourceId = newId;
    else { delete node.resizeSourceId; delete node.resizeImageId; delete node.resizeJobs; }
    node._pending = [];
    (node.resizeJobs || []).forEach(job => { if(['queued','running'].includes(job.status)) job.status = 'interrupted'; delete job.taskId; });
}
function batchResizeSource(output){
    return nodes.find(node => node.type === 'batchResize' && node.id === output.resizeSourceId);
}
function batchResizeBusy(source){ return !!source && (batchResizeRuns.has(source) || batchResizeOutputs(source.id).some(output => (output._pending || []).some(pending => !pending.failed))); }
function batchResizeLiveJob(job, busy){
    return !busy && ['queued','running'].includes(job.status) ? 'interrupted' : job.status;
}
function batchResizeStatus(status){
    return {queued:'等待生成', running:'生成中', done:'完成', failed:'失败', cancelled:'已停止', interrupted:'未完成'}[status] || '';
}
function batchResizeProgress(source){
    const jobs = batchResizeOutputs(source.id).flatMap(output => output.resizeJobs || []);
    return jobs.length ? `${jobs.filter(job => job.status === 'done').length} / ${jobs.length} 完成${jobs.some(job => job.status === 'failed') ? ` · ${jobs.filter(job => job.status === 'failed').length} 失败` : ''}` : `${(source.resizeImages || []).length} 张原图 · ${(source.resizeSizes || []).length} 个比例`;
}
function renderBatchResizeBody(node){
    normalizeBatchResizeNode(node);
    const busy = batchResizeBusy(node);
    const disabled = busy ? 'disabled' : '';
    return `<div class="batch-resize-body">
        <div class="batch-resize-originals">
            <div class="batch-resize-section-head"><strong>原图</strong><span>${(node.resizeImages || []).length} / 20</span><button type="button" class="batch-resize-icon" data-resize-pick title="添加原图" ${disabled}><i data-lucide="image-plus"></i></button></div>
            <div class="batch-resize-drop" data-resize-drop>${(node.resizeImages || []).length ? (node.resizeImages || []).map(image => `<div class="batch-resize-original">
                ${canvasPreviewImgHtml(image.url, 256, 'draggable="false"')}
                <div><span title="${escapeAttr(image.name)}">${escapeHtml(image.name)}</span></div>
                <button type="button" class="batch-resize-icon" data-resize-remove-image="${escapeAttr(image.id)}" title="移除原图" ${disabled}><i data-lucide="x"></i></button>
            </div>`).join('') : '<div class="batch-resize-empty"><i data-lucide="images"></i><span>原图</span></div>'}</div>
        </div>
        <div class="batch-resize-settings">
            <div class="batch-resize-section-head"><strong>目标比例</strong><span>${node.resizeSizes.length} 个已选</span></div>
            <div class="batch-resize-ratios" role="group" aria-label="目标比例">${BATCH_RESIZE_PRESETS.map(preset => `<label class="batch-resize-ratio"><input type="checkbox" data-resize-ratio="${preset.ratio}" ${node.resizeSizes.some(size => size.ratio === preset.ratio) ? 'checked' : ''} ${disabled}><span>${preset.label}</span></label>`).join('')}</div>
            <label class="batch-resize-field"><span>分辨率</span><select data-resize-field="resizeResolution" ${disabled}>${['1k','2k','4k'].map(value => `<option value="${value}" ${node.resizeResolution === value ? 'selected' : ''}>${value.toUpperCase()}</option>`).join('')}</select></label>
            <div class="batch-resize-api-grid"><label class="batch-resize-field"><span>API 平台</span><select data-resize-field="apiProvider" ${disabled}>${imageApiProviders().map(provider => `<option value="${escapeAttr(provider.id)}" ${node.apiProvider === provider.id ? 'selected' : ''}>${escapeHtml(provider.label || provider.name || provider.id)}</option>`).join('') || '<option value="">暂无 API 平台</option>'}</select></label><label class="batch-resize-field"><span>画质</span><select data-resize-field="quality" ${disabled}>${[['auto','自动'],['low','低'],['medium','中'],['high','高']].map(([value,label]) => `<option value="${value}" ${node.quality === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label></div>
            <label class="batch-resize-field"><span>模型</span><select data-resize-field="model" ${disabled}>${imageModelOptions(node.model, node.apiProvider)}</select></label>
            <label class="batch-resize-field"><span>补充提示词</span><textarea data-resize-prompt ${disabled}>${escapeHtml(node.supplementalPrompt || '')}</textarea></label>
            <div class="batch-resize-actions"><button class="gen-btn" type="button" data-resize-run ${busy || !(node.resizeImages || []).length || !(node.resizeSizes || []).length ? 'disabled' : ''}><i data-lucide="sparkles"></i>批量生成</button>${busy ? `<button class="batch-resize-icon" type="button" data-resize-stop title="停止后续排队" ${batchResizeRuns.has(node) ? '' : 'disabled'}><i data-lucide="square"></i></button>` : '<button class="batch-resize-icon" type="button" data-resize-retry title="重试失败及未完成任务"><i data-lucide="rotate-cw"></i></button>'}</div>
            <div class="batch-resize-progress">${escapeHtml(batchResizeProgress(node))}</div>
        </div>
    </div>`;
}
async function addBatchResizeImages(node, items){
    if(!nodes.includes(node) || batchResizeBusy(node)) return;
    const valid = items.filter(item => item.url && mediaKindForRef(item) === 'image');
    if(!valid.length) throw new Error('请选择图片');
    const available = 20 - (node.resizeImages || []).length;
    if(valid.length > available) throw new Error('每个节点最多放入 20 张原图');
    pushUndo();
    node.resizeImages = [...(node.resizeImages || []), ...valid.map(item => ({id:uid('resize-image'), url:canvasOriginalMediaUrl(item.url), name:item.name || canvasFileNameFromUrl(item.url) || '原图'}))];
    refreshNodes([node.id]); scheduleSave();
}
async function uploadBatchResizeImages(node, files){
    if(batchResizeBusy(node)) return;
    const images = Array.from(files || []).filter(file => mediaKindForUpload(file) === 'image');
    if(!images.length) throw new Error('请选择图片文件');
    if(images.length + (node.resizeImages || []).length > 20) throw new Error('每个节点最多放入 20 张原图');
    const form = new FormData(); images.forEach(file => form.append('files', file));
    const response = await fetch('/api/ai/upload', {method:'POST', body:form});
    if(!response.ok) throw new Error(await responseErrorMessage(response, '图片上传失败'));
    const data = await response.json();
    return addBatchResizeImages(node, data.files || []);
}
function bindBatchResizeBody(body, node){
    const report = error => showErrorModal(error.message || String(error), '尺寸适配失败');
    const update = () => { refreshNodes([node.id]); scheduleSave(); };
    const pick = () => {
        if(batchResizeBusy(node)) return;
        const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.multiple = true;
        input.onchange = () => uploadBatchResizeImages(node, input.files).catch(report); input.click();
    };
    body.querySelector('[data-resize-pick]').onclick = pick;
    const drop = body.querySelector('[data-resize-drop]');
    drop.ondblclick = pick;
    drop.ondragover = event => allowImageNodeDropEvent(event, drop);
    drop.ondragleave = event => { event.stopPropagation(); drop.classList.remove('drag-over'); };
    drop.ondrop = async event => {
        clearImageNodeDropState(event, drop);
        if(batchResizeBusy(node)) return;
        try {
            if(hasOutputImageDrag(event.dataTransfer)) return await addBatchResizeImages(node, [{url:readDropData(event.dataTransfer, 'application/x-canvas-output-image')}]);
            if(dropDataTypes(event.dataTransfer).includes('application/x-canvas-asset')) return await addBatchResizeImages(node, [JSON.parse(readDropData(event.dataTransfer, 'application/x-canvas-asset') || '{}')]);
            const payload = await resolveImageDropPayload(event.dataTransfer);
            if(payload.type === 'files') await uploadBatchResizeImages(node, payload.files);
            else if(payload.type === 'localPaths') await addBatchResizeImages(node, await importLocalImages(payload.localPaths));
            else if(payload.type === 'url') await addBatchResizeImages(node, [{url:payload.url}]);
        } catch(error){ report(error); }
    };
    body.querySelectorAll('[data-resize-remove-image]').forEach(button => button.onclick = () => {
        if(batchResizeBusy(node)) return;
        const id = button.dataset.resizeRemoveImage;
        const owned = batchResizeOutputs(node.id).filter(output => output.resizeImageId === id);
        if(owned.some(output => output.images?.length) && !window.confirm('移除原图将删除对应输出节点，是否继续？')) return;
        pushUndo();
        const removed = new Set(owned.map(output => output.id));
        node.resizeImages = node.resizeImages.filter(image => image.id !== id);
        nodes = nodes.filter(item => !removed.has(item.id));
        connections = connections.filter(item => !removed.has(item.from) && !removed.has(item.to));
        removed.forEach(id => selected.delete(id));
        render(); scheduleSave();
    });
    body.querySelectorAll('[data-resize-ratio]').forEach(input => input.onchange = () => {
        if(batchResizeBusy(node)) return;
        pushUndo();
        const ratio = input.dataset.resizeRatio;
        if(input.checked){
            if(!node.resizeSizes.some(size => size.ratio === ratio)){
                const previous = batchResizeOutputs(node.id).flatMap(output => output.resizeJobs || [])
                    .find(job => batchResizeRatioFor(job) === ratio && !node.resizeSizes.some(size => size.id === job.sizeId));
                node.resizeSizes.push({id:previous?.sizeId || uid('size'), ratio});
            }
        } else node.resizeSizes = node.resizeSizes.filter(size => size.ratio !== ratio);
        update();
    });
    body.querySelectorAll('[data-resize-field]').forEach(input => input.onchange = () => {
        if(batchResizeBusy(node)) return;
        pushUndo(); node[input.dataset.resizeField] = input.value;
        if(input.dataset.resizeField === 'apiProvider') node.model = allImageModels(node.apiProvider)[0] || '';
        update();
    });
    body.querySelector('[data-resize-prompt]').oninput = event => { if(!batchResizeBusy(node)){ node.supplementalPrompt = event.target.value; scheduleSave(); } };
    body.querySelector('[data-resize-run]').onclick = () => runBatchResize(node.id).catch(report);
    body.querySelector('[data-resize-retry]')?.addEventListener('click', () => runBatchResize(node.id, {failedOnly:true}).catch(report));
    body.querySelector('[data-resize-stop]')?.addEventListener('click', () => {
        const run = batchResizeRuns.get(node); if(run) run.cancelled = true;
    });
}
function ensureBatchResizeOutput(source, image){
    let output = batchResizeOutputs(source.id).find(node => node.resizeImageId === image.id);
    if(!output){
        const index = (source.resizeImages || []).findIndex(item => item.id === image.id);
        const height = nodesEl.querySelector(`.node[data-id="${CSS.escape(source.id)}"]`)?.offsetHeight || 560;
        output = {id:uid('resize-out'), type:'output', x:source.x + index*500, y:source.y + height + 80, w:460,
            resizeSourceId:source.id, resizeImageId:image.id, resizeName:image.name, images:[], resizeJobs:[], _pending:[]};
        nodes.push(output);
    }
    if(!connections.some(connection => connection.from === source.id && connection.to === output.id && connection.kind === 'batchResizeFlow'))
        connections.push({id:uid('c'), kind:'batchResizeFlow', from:source.id, to:output.id, fromPort:'resizeOut', toPort:'in'});
    return output;
}
async function runBatchResize(sourceId, options={}){
    const source = nodes.find(node => node.type === 'batchResize' && node.id === sourceId);
    if(!source || batchResizeBusy(source)) return;
    normalizeBatchResizeNode(source);
    if(!source.resizeImages?.length || !source.resizeSizes?.length) throw new Error('请添加原图和目标比例');
    if(!source.apiProvider || !source.model) throw new Error('请先选择 API 平台和模型');
    source.resizeSizes.forEach(size => batchResizeDimensions(size, source.resizeResolution));
    const settings = JSON.parse(JSON.stringify(source));
    const tasks = [];
    const sizes = source.resizeSizes.filter(size => !options.sizeId || size.id === options.sizeId);
    const images = source.resizeImages.filter(image => !options.imageId || image.id === options.imageId);
    for(const image of images){
        const output = batchResizeOutputs(source.id).find(output => output.resizeImageId === image.id);
        for(const size of sizes){
            const old = output?.resizeJobs?.find(job => job.sizeId === size.id);
            if(options.failedOnly && (!old || (old.status === 'done' && output.images?.some(item => item.resizeSizeId === size.id)))) continue;
            tasks.push({image:{...image}, size:{...size}});
        }
    }
    if(!tasks.length) return;
    pushUndo();
    const state = {cancelled:false}; batchResizeRuns.set(source, state);
    const canvasId = canvas?.id;
    const current = output => nodes.includes(source) && canvas?.id === canvasId && (!output || nodes.includes(output));
    const jobs = tasks.map(task => {
        const output = ensureBatchResizeOutput(source, task.image);
        const job = {sizeId:task.size.id, ratio:task.size.ratio, resolution:settings.resizeResolution,
            ...batchResizeDimensions(task.size, settings.resizeResolution), status:'queued', error:'', api:true};
        job.prompt = batchResizePromptFor(task.image, job, settings);
        output.resizeJobs ||= [];
        output._pending = (output._pending || []).filter(pending => pending.resizeSizeId !== job.sizeId);
        const index = output.resizeJobs.findIndex(item => item.sizeId === job.sizeId);
        if(index < 0) output.resizeJobs.push(job); else output.resizeJobs[index] = job;
        return {...task, output, job};
    });
    render(); scheduleSave();
    let next = 0;
    try {
        await Promise.all(Array.from({length:Math.min(5, jobs.length)}, async () => {
            while(next < jobs.length){
                const {image, output, job} = jobs[next++];
                if(state.cancelled || !current(output)){ job.status = 'cancelled'; continue; }
                job.status = 'running'; refreshNodes([output.id, source.id]);
                try {
                    const ref = {url:image.url, name:image.name, kind:'image'};
                    const payload = {provider_id:resolveImageProviderId(settings.apiProvider), model:resolveImageModel(settings.model),
                        prompt:job.prompt, size:`${job.width}x${job.height}`, reference_images:[ref], n:1};
                    const quality = normalizedImageQuality(settings.quality); if(quality) payload.quality = quality;
                    const task = await createCanvasImageTask(payload);
                    if(!task?.task_id) throw new Error('API 未返回有效任务 ID');
                    if(!current(output)) continue;
                    job.taskId = task.task_id;
                    const run = runSnapshot(settings, job.prompt, [ref]);
                    run.taskLabel = `尺寸适配：${image.name} · ${API_RATIO_VALUES[job.ratio]} · ${job.width}×${job.height}`;
                    output._pending.push(makePendingForRun(uid('p'), run, settings, {refs:[ref], requestSize:payload.size}, {
                        canvasTaskId:task.task_id, canvasTaskType:'online-image', providerId:payload.provider_id, model:payload.model,
                        resizeSizeId:job.sizeId, resizeJob:{...job}, resizeName:image.name
                    }));
                    refreshNodes([output.id, source.id]); scheduleSave();
                    await saveCanvas();
                    await pollCanvasImageTask(task.task_id);
                } catch(error){
                    job.status = 'failed'; job.error = error.message || String(error);
                    addGenerationLog({run:runSnapshot(settings, job.prompt, [{url:image.url,name:image.name,kind:'image'}]), outputs:[], error:job.error});
                }
                if(current(output)){ refreshNodes([output.id, source.id]); scheduleSave(); }
            }
        }));
    } finally {
        batchResizeRuns.delete(source);
        if(current()){ refreshNodes([source.id, ...batchResizeOutputs(source.id).map(output => output.id)]); scheduleSave(); }
    }
}
function completeBatchResizeTask(output, pending, result){
    const job = (output.resizeJobs || []).find(job => job.sizeId === pending.resizeSizeId);
    if(!job || job.taskId !== pending.canvasTaskId) return;
    const urls = (result.images || []).map(outputUrlValue).filter(Boolean);
    if(!urls.length){
        failCanvasImageTask(pending.canvasTaskId, 'API 未返回图片');
        return;
    }
    output._pending = (output._pending || []).filter(item => item.id !== pending.id);
    const base = String(pending.resizeName || 'image').replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|]/g, '_');
    const run = pending.run || {};
    run.request = requestMetaFromResult(result);
    const runMs = nowMs() - Number(pending.startedAt || nowMs());
    output.images = [...(output.images || []).filter(item => item.resizeSizeId !== job.sizeId), ...urls.map((url,index) => ({
        url, name:`${base}_${job.width}x${job.height}${urls.length > 1 ? `_${index+1}` : ''}${extensionFromNameOrUrl('', url)}`,
        kind:'image', resizeSizeId:job.sizeId, viewed:false, run, runMs
    }))];
    job.status = 'done'; job.error = '';
    addGenerationLog({run, outputs:urls, runMs});
    refreshNodes([output.id, output.resizeSourceId]); scheduleSave();
}
function failBatchResizeTask(output, pending, message){
    const job = (output.resizeJobs || []).find(job => job.sizeId === pending.resizeSizeId && job.taskId === pending.canvasTaskId);
    if(job){ job.status = 'failed'; job.error = message; }
}
function renderBatchResizeOutputBody(node){
    const source = batchResizeSource(node), busy = batchResizeBusy(source);
    const jobs = node.resizeJobs || [];
    const slots = jobs.map(job => {
        const images = (node.images || []).filter(item => item.resizeSizeId === job.sizeId);
        const pending = (node._pending || []).filter(pending => pending.resizeSizeId === job.sizeId).map(renderPendingOutput).join('');
        return `<section class="batch-resize-result" style="--resize-output-ratio:${job.width}/${job.height}"><div class="batch-resize-section-head"><strong title="${job.width} × ${job.height}">${API_RATIO_VALUES[job.ratio] || `${job.width} × ${job.height}`}</strong><span>${escapeHtml(batchResizeStatus(batchResizeLiveJob(job, busy)))}</span><button class="batch-resize-icon" type="button" data-resize-download="${escapeAttr(job.sizeId)}" title="下载此比例" ${images.length ? '' : 'disabled'}><i data-lucide="download"></i></button><button class="batch-resize-icon" type="button" data-resize-rerun="${escapeAttr(job.sizeId)}" title="重新生成此比例" ${busy || !source || !source.resizeSizes?.some(size => size.id === job.sizeId) ? 'disabled' : ''}><i data-lucide="refresh-cw"></i></button></div>${images.length || pending ? renderOutputGrid({...node, images}, pending) : '<div class="batch-resize-result-empty"></div>'}${job.error ? `<div class="translation-error">${escapeHtml(job.error)}</div>` : ''}</section>`;
    });
    const extra = (node.images || []).filter(item => !jobs.some(job => job.sizeId === item.resizeSizeId));
    return `<div class="batch-resize-results">${slots.join('')}${extra.length ? renderOutputGrid({...node, images:extra}) : ''}</div>`;
}
function bindBatchResizeOutputBody(body, node){
    body.querySelectorAll('[data-resize-download]').forEach(button => button.onclick = () => {
        const item = (node.images || []).find(item => item.resizeSizeId === button.dataset.resizeDownload);
        if(item) downloadUrl(item.url, item.name);
    });
    body.querySelectorAll('[data-resize-rerun]').forEach(button => button.onclick = () => runBatchResize(node.resizeSourceId,
        {imageId:node.resizeImageId, sizeId:button.dataset.resizeRerun}).catch(error => showErrorModal(error.message, '尺寸适配失败')));
}

if(typeof module !== 'undefined' && module.exports) module.exports = {batchResizeDimensions, batchResizePromptFor};
