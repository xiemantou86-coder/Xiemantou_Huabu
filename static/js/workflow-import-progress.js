// Workflow import stages. Percentages describe the current transfer only.
let workflowImportBusy = false;
function workflowImportBytes(n){
    if(n < 1024) return n + ' B';
    if(n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1048576).toFixed(1) + ' MB';
}
function createWorkflowImportProgress(name){
    const box = document.createElement('div');
    box.className = 'workflow-progress-overlay';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', '导入工作流');
    box.innerHTML = `<style>
.workflow-progress-overlay{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.38);padding:24px}
.workflow-progress-card{width:440px;max-width:100%;padding:24px;border-radius:18px;background:var(--card-solid,#fff);color:var(--text,#111827);border:1px solid var(--line,#ddd);box-shadow:0 18px 60px #0004;font:13px/1.6 sans-serif}
.workflow-progress-name{overflow-wrap:anywhere;color:var(--muted,#64748b);margin:8px 0 18px}
.workflow-progress-card progress{width:100%;height:14px;accent-color:#0ea5e9;margin:14px 0}
.workflow-progress-detail{min-height:44px;overflow-wrap:anywhere;color:var(--muted,#64748b)}
.workflow-progress-foot{display:flex;align-items:center;justify-content:space-between;margin-top:16px;gap:12px}
.workflow-progress-close{padding:7px 18px;border-radius:9px;border:1px solid var(--line,#ddd);background:var(--soft,#f1f5f9);color:inherit;cursor:pointer}
.workflow-progress-close[hidden]{display:none}
.workflow-progress-card[data-state=success] progress{accent-color:#22c55e}
.workflow-progress-card[data-state=error] .workflow-progress-stage{color:#ef4444}
</style><section class="workflow-progress-card">
<strong style="font-size:17px">导入工作流</strong>
<div class="workflow-progress-name"></div>
<div class="workflow-progress-stage" role="status" aria-live="polite"></div>
<progress max="100" aria-label="当前阶段进度"></progress>
<div class="workflow-progress-detail"></div>
<div class="workflow-progress-foot"><span class="workflow-progress-time"></span><button type="button" class="workflow-progress-close" hidden>关闭</button></div>
</section>`;
    box.querySelector('.workflow-progress-name').textContent = name;
    document.body.appendChild(box);
    const before = document.activeElement;
    const card = box.querySelector('section');
    const button = box.querySelector('button');
    const progress = box.querySelector('progress');
    const begun = Date.now();
    const tick = () => { box.querySelector('.workflow-progress-time').textContent = '已用时 ' + Math.floor((Date.now()-begun)/1000) + ' 秒'; };
    tick();
    const clock = setInterval(tick,1000);
    box.tabIndex = -1;
    box.focus();
    box.addEventListener('keydown', e => {
        if(e.key === 'Tab'){ e.preventDefault(); if(!button.hidden) button.focus(); }
        if(e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); }
    });
    button.addEventListener('click', () => {box.remove(); before?.focus?.();});
    return {
        stage(title, detail='', percent=null){
            box.querySelector('.workflow-progress-stage').textContent = title;
            box.querySelector('.workflow-progress-detail').textContent = detail;
            if(percent === null) progress.removeAttribute('value');
            else progress.value = Math.max(0,Math.min(100,percent));
        },
        finish(ok, detail){
            clearInterval(clock); tick();
            card.dataset.state = ok ? 'success' : 'error';
            this.stage(ok ? '导入完成' : '导入未完成', detail, ok ? 100 : 0);
            button.hidden = false; button.focus();
        }
    };
}
function workflowImportPaint(){
    return new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve,0)));
}
function workflowImportTransfer(url, body, ui){
    return new Promise((resolve,reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(body ? 'POST' : 'GET',url);
        xhr.responseType = 'blob';
        const report = (title,e) => ui.stage(title,
            workflowImportBytes(e.loaded) + (e.lengthComputable ? ' / ' + workflowImportBytes(e.total) : ' · 总大小未知'),
            e.lengthComputable && e.total ? e.loaded/e.total*100 : null);
        xhr.upload.onprogress = e => report('上传工作流到本机服务',e);
        xhr.upload.onload = () => ui.stage('服务器解析／解包中','上传已完成，正在等待解析结果。大型资源包可能需要较长时间，请勿刷新。');
        xhr.onprogress = e => report(body ? '接收工作流数据' : '读取资产库工作流',e);
        xhr.onerror = () => reject(new Error('网络连接失败，请检查画布服务是否仍在运行'));
        xhr.onabort = () => reject(new Error('工作流传输已中断'));
        xhr.onload = async () => {
            if(xhr.status >= 200 && xhr.status < 300){ resolve(xhr.response); return; }
            let message = '读取工作流失败（HTTP ' + xhr.status + '）';
            try{
                const text = await xhr.response.text();
                const data = JSON.parse(text);
                if(typeof data.detail === 'string') message = data.detail;
            }catch(_){}
            reject(new Error(message));
        };
        xhr.send(body || null);
    });
}
function workflowImportParse(blob){
    return new Promise((resolve,reject) => {
        let worker;
        const url = URL.createObjectURL(new Blob([
            "self.onmessage=async e=>{try{const text=await e.data.text();self.postMessage({ok:true,data:JSON.parse(text)});}catch(err){self.postMessage({ok:false,error:err.message});}}"
        ],{type:'text/javascript'}));
        const release = () => { worker?.terminate(); URL.revokeObjectURL(url); };
        try{
            worker = new Worker(url);
            worker.onmessage = e => { release(); if(e.data.ok) resolve(e.data.data); else reject(new Error('工作流响应解析失败：'+e.data.error)); };
            worker.onerror = () => {release(); reject(new Error('工作流解析线程异常，请重试'));};
            worker.postMessage(blob);
        }catch(err){release(); reject(new Error('无法启动工作流解析线程：'+err.message));}
    });
}
async function runWorkflowImportWithProgress({file, url, name='workflow'}){
    if(!canvas || (!file && !url)) return false;
    if(workflowImportBusy){setStatus('已有工作流正在导入，请等待完成');return false;}
    workflowImportBusy = true;
    const canvasId = canvas.id;
    let ui;
    let committing = false;
    try{
        ui = createWorkflowImportProgress(file?.name || name);
        ui.stage('准备导入',file ? '文件大小：'+workflowImportBytes(file.size) : '正在读取资产库文件');
        await workflowImportPaint();
        if(!file){
            const blob = await workflowImportTransfer(url,null,ui);
            const filename = /\.(json|zip)$/i.test(name) ? name : (url.split('/').pop()?.split('?')[0] || 'workflow.zip');
            file = new File([blob],filename,{type:blob.type || 'application/octet-stream'});
        }
        ui.stage('上传工作流到本机服务','文件大小：'+workflowImportBytes(file.size),0);
        const form = new FormData();
        form.append('file',file);
        const blob = await workflowImportTransfer('/api/canvas-workflows/import',form,ui);
        ui.stage('解析工作流数据','在后台线程解析节点与连线，暂不提供百分比');
        await workflowImportPaint();
        const data = await workflowImportParse(blob);
        const imported = normalizeImportedWorkflow(data);
        if(!imported.nodes.length) throw new Error('工作流中没有可导入的节点');
        if(canvas?.id !== canvasId) throw new Error('当前画布已经切换，已停止插入节点，请回到目标画布重新导入');
        ui.stage('插入节点并绘制画布',imported.nodes.length+' 个节点，'+imported.connections.length+' 条连线；节点较多时页面可能短暂忙碌');
        await workflowImportPaint();
        if(canvas?.id !== canvasId) throw new Error('当前画布已经切换，已停止导入');
        committing = true;
        insertWorkflowIntoCanvas(imported);
        committing = false;
        closeWorkflowTransferModal();
        await workflowImportPaint();
        ui.finish(true,'已追加 '+imported.nodes.length+' 个节点。已触发自动保存；图片与视频预览会继续按需加载。');
        return true;
    }catch(err){
        const message = (err.message || '导入工作流失败') + (committing ? '。插入阶段发生异常，可能已添加部分内容；请先检查画布，勿直接重复导入。' : '');
        if(ui) ui.finish(false,message);
        else showErrorModal(message,'导入工作流');
        return false;
    }finally{
        workflowImportBusy = false;
    }
}
