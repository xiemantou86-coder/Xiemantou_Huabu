// recycle-hub.js — 垃圾桶（统一回收站页面）
// 三个标签页：画布回收站 / 素材回收站 / 素材文件。
// 数据全部来自只读聚合接口 /api/recycle-hub（按 part 分片拉取），
// 恢复 / 彻底删除则复用已有的画布、素材回收站、素材文件接口，不新增写接口。

/* ===================== 小工具函数 ===================== */
function refreshIcons(){ if(window.lucide) lucide.createIcons(); }
function escapeHtml(value){
    return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function escapeAttr(value){ return escapeHtml(value); }

// 把字节数变成「1.2 MB」这种好读的写法
function formatFileSize(bytes){
    const size = Number(bytes || 0);
    if(!size) return '0 B';
    const units = ['B','KB','MB','GB','TB'];
    const idx = Math.min(units.length - 1, Math.floor(Math.log(size) / Math.log(1024)));
    return `${(size / Math.pow(1024, idx)).toFixed(idx ? 1 : 0)} ${units[idx]}`;
}

// 时间戳（毫秒）转成本地时间文本
function formatTime(value){
    const num = Number(value || 0);
    if(!num) return '--';
    try {
        const time = num < 10000000000 ? num * 1000 : num;
        return new Date(time).toLocaleString('zh-CN', {hour12:false, month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'});
    } catch(e){ return '--'; }
}

// 剩余天数文案：3 天以内高亮提醒
function daysLabel(days){
    const n = Number(days || 0);
    if(n <= 0) return '<span class="hub-days warn">今天到期</span>';
    const cls = n <= 3 ? 'hub-days warn' : 'hub-days';
    return `<span class="${cls}">剩余 ${n} 天</span>`;
}

// 统一的后端请求封装：失败时抛出后端返回的 detail 文案
async function apiJson(url, options={}){
    const res = await fetch(url, options);
    const data = await res.json().catch(() => ({}));
    if(!res.ok) throw new Error(data.detail || data.message || '操作失败');
    return data;
}

function setStatus(text){
    const el = document.getElementById('hubStatus');
    if(el) el.textContent = text || '准备就绪';
}

/* ===================== 页面状态 ===================== */
const HUB_TABS = ['canvases', 'asset-trash', 'files'];

const hubState = {
    tab: 'canvases',
    loaded: { canvases:false, 'asset-trash':false, files:false },   // 各标签页是否已加载过
    retention: { canvas:30, asset:30 },                              // 保留天数（后端返回）
    projectNames: {},                                                // 项目 id -> 名称
    // --- 画布回收站 ---
    canvases: [],
    canvasesLoading: false,
    canvasesStats: null,
    expanded: new Set(),                                             // 已展开素材的画布 id
    // --- 素材回收站 ---
    trash: [],
    trashLoading: false,
    trashStats: null,
    trashSelected: new Set(),                                        // 选中的素材回收站条目 id
    skipNextChange: false,                                           // 自己发出的画面变更通知，回传时忽略一次
    // --- 素材文件 ---
    storageSummary: null,                                            // 各类素材数量汇总
    files: {
        kind: 'generated', media: 'all', unused: false,
        items: [], selected: new Set(),                              // selected 里存的是 item.rel
        offset: 0, total: 0, hasMore: false, loading: false, loadingMore: false,
        pageSize: 80,
    },
};

const KIND_LABELS = { upload:'上传素材', generated:'生成素材', local:'本地素材' };

/* ===================== DOM ===================== */
const hubRoot = document.getElementById('hubRoot');
const tabButtons = Array.from(document.querySelectorAll('.asset-tabs button[data-tab]'));

/* ===================== 通用缩略图 ===================== */
// 根据 URL 后缀猜测媒体类型（后端 storage-files 有 media 字段，回收站条目没有，只能按名字猜）
function guessMedia(url, name){
    const text = String(name || url || '').toLowerCase();
    if(/\.(mp4|webm|mov|m4v|avi|mkv)(\?|#|$)/.test(text)) return 'video';
    if(/\.(mp3|wav|m4a|aac|ogg|flac)(\?|#|$)/.test(text)) return 'audio';
    return 'image';
}
// 缩略图统一走服务端缩放代理 /api/media-preview：把动辄 4~5MB 的 2048px 原图
// 换成 ~256px 的小图再传给浏览器。
// 这是本页性能的关键——图多时真正卡的不是 DOM，而是「下载 + 解码整张原图」：
// 50 张 2048×2048 原图解码后光像素就占几百 MB 内存，浏览器会明显掉帧。
// 判断逻辑与后端 output_file_from_url 的白名单保持一致：只代理本地图片/视频
// （/output/、/assets/，以及素材文件接口 /api/storage-files/{kind}/{rel}），
// 其它地址（比如素材回收站的 /api/asset-trash/{id}/raw）原样返回，避免猜错路径导致 404。
function hubPreviewUrl(url, w = 256){
    const raw = String(url || '');
    if(!raw || raw.startsWith('data:') || raw.startsWith('blob:')) return raw;
    let path = raw;
    if(/^https?:\/\//i.test(raw)){
        try { path = new URL(raw).pathname; } catch(e){ return raw; }
    }
    const ok = path.startsWith('/output/') || path.startsWith('/assets/') || path.startsWith('/api/storage-files/');
    if(!ok) return raw;
    if(!/\.(png|jpe?g|webp|gif|bmp|avif|tiff?|mp4|webm|mov|m4v|mkv)(\?|#|$)/i.test(path)) return raw;
    const width = Math.max(64, Math.min(2048, Math.round(Number(w) || 256)));
    return `/api/media-preview?w=${width}&url=${encodeURIComponent(path)}`;
}

// 视频用 /api/media-preview 抽一帧做封面（poster 也走小图），音频/文本只用图标，图片走 256px 代理
function thumbHtml(url, name, mediaKind){
    const kind = mediaKind || guessMedia(url, name);
    const preview = hubPreviewUrl(url, 256);
    if(kind === 'video'){
        return `<div class="storage-file-thumb"><video src="${escapeAttr(url)}" poster="${escapeAttr(preview)}" muted preload="none" playsinline></video></div>`;
    }
    if(kind === 'audio' || kind === 'text'){
        const icon = kind === 'audio' ? 'file-audio' : 'file-text';
        return `<div class="storage-file-thumb"><div class="asset-file-icon"><i data-lucide="${icon}"></i></div></div>`;
    }
    return `<div class="storage-file-thumb"><img src="${escapeAttr(preview)}" alt="" loading="lazy" decoding="async"></div>`;
}

/* ===================== 标签页切换 ===================== */
function switchHubTab(tab){
    if(!HUB_TABS.includes(tab)) tab = 'canvases';
    hubState.tab = tab;
    tabButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
    render();
    loadTab(tab);
}

// 按需加载：只有第一次切到某个标签页（或手动刷新）才真正请求数据
function loadTab(tab, force=false){
    if(tab === 'canvases' && (force || !hubState.loaded.canvases)) return loadCanvases();
    if(tab === 'asset-trash' && (force || !hubState.loaded['asset-trash'])) return loadAssetTrash();
    if(tab === 'files'){
        const needSummary = force || !hubState.storageSummary;
        const needList = force || !hubState.loaded.files;
        if(needSummary) loadStorageSummary();
        if(needList) return loadFiles();
    }
    return Promise.resolve();
}

/* ===================== 总渲染 ===================== */
function render(){
    if(hubState.tab === 'canvases') hubRoot.innerHTML = renderCanvases();
    else if(hubState.tab === 'asset-trash') hubRoot.innerHTML = renderAssetTrash();
    else hubRoot.innerHTML = renderFiles();
    refreshIcons();
}

/* ===================== 1. 画布回收站 ===================== */
async function loadCanvases(){
    hubState.canvasesLoading = true;
    if(!hubState.canvases.length) render();
    try {
        const data = await apiJson('/api/recycle-hub?part=canvases');
        hubState.retention = data.retention_days || hubState.retention;
        hubState.canvases = data.canvases || [];
        hubState.canvasesStats = data.canvases_stats || null;
        hubState.loaded.canvases = true;
        setStatus(`画布回收站：${hubState.canvases.length} 块`);
    } catch(err){
        setStatus(err.message || '加载画布回收站失败');
    } finally {
        hubState.canvasesLoading = false;
        render();
    }
}

function renderCanvases(){
    if(hubState.canvasesLoading && !hubState.canvases.length){
        return `<div class="hub-empty">正在读取画布回收站...</div>`;
    }
    if(!hubState.canvases.length){
        return `<div class="hub-empty">
            <i data-lucide="trash-2"></i>
            <strong>画布回收站是空的</strong>
            <span>删除画布后，它会保留 ${hubState.retention.canvas} 天，期间可以在这里恢复。</span>
        </div>`;
    }
    const totalAssets = hubState.canvases.reduce((sum, c) => sum + Number(c.asset_count || 0), 0);
    const cards = hubState.canvases.map(canvasCardHtml).join('');
    return `
        <div class="hub-toolbar">
            <div class="hub-toolbar-text">共 <b>${hubState.canvases.length}</b> 块画布 · 关联 <b>${totalAssets}</b> 个素材</div>
            <div class="hub-toolbar-note"><i data-lucide="info"></i><span>回收站中的画布保留 ${hubState.retention.canvas} 天，到期后自动清理。</span></div>
        </div>
        <div class="hub-canvas-list">${cards}</div>
    `;
}

// 画布图标：emoji 直接用；否则当成 lucide 图标名
function canvasIconHtml(icon, size = 18){
    if(icon && /[^\x00-\x7F]/.test(icon)) return escapeHtml(icon);
    const name = (!icon || icon === '🧩') ? 'layers' : icon;
    return `<i data-lucide="${escapeAttr(name)}" style="width:${size}px;height:${size}px"></i>`;
}

function canvasCardHtml(c){
    const id = String(c.id || '');
    const assets = Array.isArray(c.assets) ? c.assets : [];
    const expanded = hubState.expanded.has(id);
    const willTrash = Number(c.will_trash_count || 0);
    const isSmart = (c.kind || 'classic') === 'smart';
    const projName = hubState.projectNames[c.project] || (c.project === 'default' ? '默认项目' : c.project) || '默认项目';
    return `
    <article class="hub-canvas-card${expanded ? ' expanded' : ''}" data-canvas="${escapeAttr(id)}">
        <div class="hub-canvas-top">
            <span class="hub-canvas-icon">${canvasIconHtml(c.icon)}</span>
            <div class="hub-canvas-info">
                <div class="hub-canvas-title">
                    <span class="hub-canvas-name">${escapeHtml(c.title || '未命名画布')}</span>
                    <span class="hub-kind-badge ${isSmart ? 'smart' : 'classic'}">${isSmart ? '智能' : '普通'}</span>
                </div>
                <div class="hub-canvas-meta">
                    <span>${escapeHtml(projName)}</span><i class="hub-dot"></i>
                    <span>删除于 ${formatTime(c.deleted_at)}</span><i class="hub-dot"></i>
                    ${daysLabel(c.days_left)}
                </div>
            </div>
            <div class="hub-canvas-actions">
                <button class="asset-btn" type="button" data-act="expand">
                    <i data-lucide="${expanded ? 'chevron-up' : 'chevron-down'}"></i><span>关联素材 ${assets.length}</span>
                </button>
                <button class="asset-btn primary" type="button" data-act="restore-canvas"><i data-lucide="rotate-ccw"></i><span>恢复</span></button>
                <button class="asset-btn danger" type="button" data-act="purge-canvas"><i data-lucide="trash-2"></i><span>彻底删除</span></button>
            </div>
        </div>
        ${willTrash ? `<div class="hub-canvas-note"><i data-lucide="alert-triangle"></i><span>彻底删除将连带把 <b>${willTrash}</b> 个仅该画布使用的素材移入素材回收站。</span></div>` : ''}
        <div class="hub-canvas-assets"${expanded ? '' : ' hidden'}>${assetsGridHtml(assets)}</div>
        <div class="hub-canvas-confirm" hidden>
            <div class="hub-canvas-confirm-title">
                彻底删除画布「${escapeHtml(c.title || '未命名画布')}」？此操作不可恢复${willTrash ? `，并会连带移走 ${willTrash} 个素材` : ''}。
            </div>
            <div class="hub-canvas-confirm-actions">
                <button class="asset-btn danger" type="button" data-act="purge-canvas-yes"><i data-lucide="trash-2"></i><span>确认彻底删除</span></button>
                <button class="asset-btn" type="button" data-act="confirm-cancel">取消</button>
            </div>
        </div>
    </article>`;
}

function assetsGridHtml(assets){
    if(!assets.length) return `<div class="hub-asset-empty">这块画布没有关联素材</div>`;
    return `<div class="hub-asset-grid">${assets.map(a => `
        <figure class="hub-asset">
            ${thumbHtml(a.url, a.name, a.kind)}
            <figcaption title="${escapeAttr(a.name || '')}">${escapeHtml(a.name || '未命名')}</figcaption>
            <em title="${escapeAttr(a.node_title || '')}">${escapeHtml(a.node_title || '')}</em>
        </figure>
    `).join('')}</div>`;
}

async function restoreCanvas(id){
    try {
        await apiJson(`/api/canvases/${encodeURIComponent(id)}/restore`, { method:'POST' });
        setStatus('已恢复画布');
        notifyCanvasesChanged();
        await loadCanvases();
    } catch(err){ setStatus(err.message || '恢复失败'); }
}

async function purgeCanvas(id){
    try {
        await apiJson(`/api/canvases/${encodeURIComponent(id)}/purge`, { method:'DELETE' });
        setStatus('已彻底删除画布');
        notifyCanvasesChanged();
        hubState.loaded['asset-trash'] = false;   // 素材回收站可能多了条目，下次进入重新拉
        await loadCanvases();
    } catch(err){ setStatus(err.message || '删除失败'); }
}

// 通知外层 index.html，让它转告画布页刷新回收站角标
function notifyCanvasesChanged(){
    // 这条通知会被外层转发回来，自己不用再重新拉一次数据
    hubState.skipNextChange = true;
    try { parent.postMessage({ type:'canvases-changed' }, '*'); } catch(e){}
}

/* ===================== 2. 素材回收站 ===================== */
async function loadAssetTrash(){
    hubState.trashLoading = true;
    if(!hubState.trash.length) render();
    try {
        const data = await apiJson('/api/recycle-hub?part=asset-trash');
        hubState.retention = data.retention_days || hubState.retention;
        hubState.trash = data.asset_trash || [];
        hubState.trashStats = data.asset_trash_stats || null;
        // 丢掉已经不存在的选中项
        const alive = new Set(hubState.trash.map(i => i.id));
        hubState.trashSelected = new Set([...hubState.trashSelected].filter(x => alive.has(x)));
        hubState.loaded['asset-trash'] = true;
        setStatus(`素材回收站：${hubState.trash.length} 项`);
    } catch(err){
        setStatus(err.message || '加载素材回收站失败');
    } finally {
        hubState.trashLoading = false;
        render();
    }
}

function renderAssetTrash(){
    if(hubState.trashLoading && !hubState.trash.length){
        return `<div class="hub-empty">正在读取素材回收站...</div>`;
    }
    const items = hubState.trash;
    if(!items.length){
        return `<div class="hub-empty">
            <i data-lucide="recycle"></i>
            <strong>素材回收站是空的</strong>
            <span>彻底删除画布时，只有该画布独享的素材会先移到这里，保留 ${hubState.retention.asset} 天。</span>
        </div>`;
    }
    const selectedCount = hubState.trashSelected.size;
    const totalSize = Number(hubState.trashStats?.size || 0);
    const cards = items.map(item => {
        const checked = hubState.trashSelected.has(item.id);
        const source = item.canvas_title ? `来自画布「${item.canvas_title}」` : '来源画布已删除';
        return `
        <label class="storage-file-card${checked ? ' selected' : ''}">
            <input type="checkbox" data-trash-select="${escapeAttr(item.id)}"${checked ? ' checked' : ''}>
            ${thumbHtml(item.url, item.name, guessMedia(item.url, item.name))}
            <span title="${escapeAttr(item.name)}">${escapeHtml(item.name)}</span>
            <em>${formatFileSize(item.size)} · ${formatTime(item.deleted_at)}</em>
            <em>${daysLabel(item.days_left)} · ${escapeHtml(source)}</em>
        </label>`;
    }).join('');
    return `
        <div class="hub-toolbar">
            <div class="hub-toolbar-text">共 <b>${items.length}</b> 项 · <b>${formatFileSize(totalSize)}</b></div>
            <div class="hub-toolbar-actions">
                <button class="asset-btn" type="button" data-act="trash-selectall"><i data-lucide="check-square"></i><span>全选</span></button>
                <button class="asset-btn primary" type="button" data-act="trash-restore"${selectedCount ? '' : ' disabled'}><i data-lucide="undo-2"></i><span>恢复 ${selectedCount || ''}</span></button>
                <button class="asset-btn danger" type="button" data-act="trash-purge"${selectedCount ? '' : ' disabled'}><i data-lucide="trash-2"></i><span>彻底删除 ${selectedCount || ''}</span></button>
            </div>
        </div>
        <div class="storage-file-grid hub-file-grid">${cards}</div>
    `;
}

async function restoreAssetTrash(){
    const ids = [...hubState.trashSelected];
    if(!ids.length) return;
    try {
        const data = await apiJson('/api/asset-trash/restore', {
            method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ ids })
        });
        hubState.trashSelected.clear();
        setStatus(`已恢复 ${data.restored || 0} 个素材`);
        await loadAssetTrash();
    } catch(err){ setStatus(err.message || '恢复失败'); }
}

async function purgeAssetTrash(){
    const ids = [...hubState.trashSelected];
    if(!ids.length) return;
    if(!confirm(`确认彻底删除选中的 ${ids.length} 个素材？此操作不可恢复。`)) return;
    try {
        const data = await apiJson('/api/asset-trash/purge', {
            method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ ids })
        });
        hubState.trashSelected.clear();
        setStatus(`已彻底删除 ${data.removed || 0} 个素材，释放 ${formatFileSize(data.freed || 0)}`);
        hubState.storageSummary = null;   // 磁盘统计变了，下次进入素材文件页重新拉
        hubState.loaded.files = false;
        await loadAssetTrash();
    } catch(err){ setStatus(err.message || '删除失败'); }
}

/* ===================== 3. 素材文件 ===================== */
async function loadStorageSummary(){
    try {
        const data = await apiJson('/api/recycle-hub?part=storage');
        hubState.storageSummary = data.storage || null;
        render();
    } catch(err){ /* 汇总失败不影响文件列表，忽略 */ }
}

async function loadFiles(append = false){
    const f = hubState.files;
    if(f.loading || f.loadingMore) return;
    if(append && !f.hasMore) return;
    if(append){
        // 追加下一页：只更新页脚文案，已有卡片一张都不动
        f.loadingMore = true;
        refreshFileFooter();
    } else {
        // 首次加载 / 切换分类：整体重绘一次（此时列表本来就该清空）
        f.loading = true;
        f.items = [];
        f.offset = 0;
        render();
    }
    try {
        const offset = append ? f.offset : 0;
        const url = `/api/storage-files?kind=${encodeURIComponent(f.kind)}&offset=${offset}`
            + `&limit=${f.pageSize}&unused=${f.unused ? 1 : 0}&media=${encodeURIComponent(f.media)}`;
        const data = await apiJson(url);
        const items = data.items || [];
        f.items = append ? [...f.items, ...items] : items;
        f.offset = offset + items.length;
        f.total = Number(data.total || f.items.length);
        f.hasMore = Boolean(data.has_more);
        const alive = new Set(f.items.map(i => i.rel));
        f.selected = new Set([...f.selected].filter(x => alive.has(x)));
        if(!append) hubState.loaded.files = true;
        setStatus(`${KIND_LABELS[f.kind] || f.kind}：${f.total} 个文件`);
        f.loading = false;
        f.loadingMore = false;
        // 关键优化：追加时走 appendFileCards，只往网格尾部插入新卡片。
        // 旧写法是整页 innerHTML 重绘，越往下滚就要重建越多已有卡片，于是「越滚越卡」。
        if(append) appendFileCards(items);
        else render();
    } catch(err){
        f.loading = false;
        f.loadingMore = false;
        setStatus(err.message || '加载素材文件失败');
        // 失败时把页脚从「继续加载中...」还原，方便用户再滚一次重试
        if(append) refreshFileFooter();
        else render();
    }
}

function renderFiles(){
    const f = hubState.files;
    const kinds = hubState.storageSummary?.kinds || [
        {kind:'generated', label:KIND_LABELS.generated, count:0},
        {kind:'upload', label:KIND_LABELS.upload, count:0},
        {kind:'local', label:KIND_LABELS.local, count:0},
    ];
    const kindTabs = kinds.map(k => `
        <button class="${f.kind === k.kind ? 'active' : ''}" type="button" data-act="kind" data-kind="${escapeAttr(k.kind)}">
            <span>${escapeHtml(k.label)} ${Number(k.count || 0)}</span>
        </button>
    `).join('');
    const mediaTabs = [['all','全部'],['image','图片'],['video','视频'],['audio','音频']].map(([key, label]) => `
        <button class="${f.media === key ? 'active' : ''}" type="button" data-act="media" data-media="${key}"><span>${label}</span></button>
    `).join('');
    const selectedCount = f.selected.size;
    let body;
    if(f.loading && !f.items.length){
        body = `<div class="storage-empty">正在读取目录...</div>`;
    } else if(!f.items.length){
        const label = {image:'图片', video:'视频', audio:'音频'}[f.media] || '';
        const suffix = f.unused ? `没有未使用的${label}素材` : `暂时没有${label}素材`;
        body = `<div class="storage-empty">这个目录里${suffix}</div>`;
    } else {
        body = f.items.map(fileCardHtml).join('') + fileFooterHtml();
    }
    return `
        <div class="hub-toolbar">
            <div class="storage-tabs">${kindTabs}</div>
            <div class="hub-toolbar-actions">
                <div class="storage-tabs">${mediaTabs}</div>
                <button class="asset-btn${f.unused ? ' primary' : ''}" type="button" data-act="unused"><i data-lucide="filter"></i><span>只看未使用</span></button>
                <button class="asset-btn" type="button" data-act="file-selectall"${f.items.length ? '' : ' disabled'}><i data-lucide="check-square"></i><span>全选</span></button>
                <button class="asset-btn danger" type="button" data-act="file-delete"${selectedCount ? '' : ' disabled'}><i data-lucide="trash-2"></i><span>删除 ${selectedCount || ''}</span></button>
            </div>
        </div>
        <div class="storage-file-grid hub-file-grid">${body}</div>
    `;
}

// 单张素材文件卡片的 HTML（整体重绘与滚动追加共用，保证两条路径渲染结果一致）
function fileCardHtml(item){
    const checked = hubState.files.selected.has(item.rel);
    return `
    <label class="storage-file-card${checked ? ' selected' : ''}">
        <input type="checkbox" data-file-select="${escapeAttr(item.rel)}" data-kind="${escapeAttr(item.kind)}"${checked ? ' checked' : ''}>
        ${thumbHtml(item.url, item.name, item.media)}
        ${item.unused ? '<b class="storage-file-badge">未使用</b>' : ''}
        <span title="${escapeAttr(item.name)}">${escapeHtml(item.name)}</span>
        <em>${formatFileSize(item.size)}${item.width ? ` · ${item.width}×${item.height}` : ''}</em>
    </label>`;
}

// 网格末尾的「加载更多」页脚文案
function fileFooterHtml(){
    const f = hubState.files;
    if(f.hasMore || f.loadingMore){
        return `<div class="storage-load-more">${f.loadingMore ? '继续加载中...' : `已加载 ${f.items.length} / ${f.total}，向下滚动继续`}</div>`;
    }
    return `<div class="storage-load-more done">已加载全部 ${f.items.length} 个</div>`;
}

// 把新一页的卡片追加到网格尾部：先摘掉页脚，插完卡片再补上新页脚，已有 DOM 完全不动
function appendFileCards(items){
    const grid = hubRoot.querySelector('.hub-file-grid');
    if(!grid || !items.length) return;
    grid.querySelector('.storage-load-more')?.remove();
    grid.insertAdjacentHTML('beforeend', items.map(fileCardHtml).join(''));
    grid.insertAdjacentHTML('beforeend', fileFooterHtml());
    refreshIcons();
}

// 只替换页脚（加载中 / 加载失败时用），不碰任何卡片
function refreshFileFooter(){
    const grid = hubRoot.querySelector('.hub-file-grid');
    if(!grid || !grid.children.length) return;
    grid.querySelector('.storage-load-more')?.remove();
    grid.insertAdjacentHTML('beforeend', fileFooterHtml());
}

async function deleteSelectedFiles(){
    const f = hubState.files;
    const rels = [...f.selected];
    if(!rels.length) return;
    if(!confirm(`确认删除选中的 ${rels.length} 个素材？此操作会直接删除磁盘文件，不可恢复。`)) return;
    try {
        const data = await apiJson('/api/storage-files/delete', {
            method:'POST', headers:{'Content-Type':'application/json'},
            body:JSON.stringify({ kind:f.kind, items:rels })
        });
        f.selected.clear();
        setStatus(`已删除 ${data.removed || 0} 个文件`);
        hubState.storageSummary = null;
        await loadStorageSummary();
        await loadFiles();
    } catch(err){ setStatus(err.message || '删除失败'); }
}

/* ===================== 事件绑定（统一委托） ===================== */
// 找到点击的按钮所在的那张画布卡片
function cardOf(el){ return el.closest('.hub-canvas-card'); }

hubRoot.addEventListener('click', event => {
    const btn = event.target.closest('[data-act]');
    if(!btn) return;
    const act = btn.dataset.act;
    const card = cardOf(btn);
    const canvasId = card?.dataset.canvas || '';
    switch(act){
        case 'expand': {
            if(hubState.expanded.has(canvasId)) hubState.expanded.delete(canvasId);
            else hubState.expanded.add(canvasId);
            const expanded = hubState.expanded.has(canvasId);
            // 局部展开 / 折叠：只切这一块画布的素材区和箭头图标。
            // 以前这里调 render() 整页重绘，画布多、素材多时会明显卡顿，还会丢掉滚动位置。
            const assetsEl = card?.querySelector('.hub-canvas-assets');
            if(assetsEl) assetsEl.hidden = !expanded;
            card?.classList.toggle('expanded', expanded);
            const cv = hubState.canvases.find(c => String(c.id) === canvasId);
            const count = cv ? (cv.assets || []).length : 0;
            btn.innerHTML = `<i data-lucide="${expanded ? 'chevron-up' : 'chevron-down'}"></i><span>关联素材 ${count}</span>`;
            refreshIcons();
            break;
        }
        case 'restore-canvas': restoreCanvas(canvasId); break;
        case 'purge-canvas': card?.querySelector('.hub-canvas-confirm')?.removeAttribute('hidden'); break;
        case 'purge-canvas-yes': purgeCanvas(canvasId); break;
        case 'confirm-cancel': card?.querySelector('.hub-canvas-confirm')?.setAttribute('hidden', ''); break;
        case 'trash-selectall': {
            const all = hubState.trash.map(i => i.id);
            const selectAll = hubState.trashSelected.size !== all.length;
            hubState.trashSelected = selectAll ? new Set(all) : new Set();
            // 直接改已有勾选框，不重绘列表
            hubRoot.querySelectorAll('[data-trash-select]').forEach(input => {
                input.checked = selectAll;
                input.closest('.storage-file-card')?.classList.toggle('selected', selectAll);
            });
            updateTrashToolbar();
            break;
        }
        case 'trash-restore': restoreAssetTrash(); break;
        case 'trash-purge': purgeAssetTrash(); break;
        case 'kind': {
            const kind = btn.dataset.kind;
            if(kind !== hubState.files.kind){ hubState.files.kind = kind; hubState.files.selected.clear(); loadFiles(); }
            break;
        }
        case 'media': {
            const media = btn.dataset.media;
            if(media !== hubState.files.media){ hubState.files.media = media; hubState.files.selected.clear(); loadFiles(); }
            break;
        }
        case 'unused': hubState.files.unused = !hubState.files.unused; hubState.files.selected.clear(); loadFiles(); break;
        case 'file-selectall': {
            const all = hubState.files.items.map(i => i.rel);
            const selectAll = hubState.files.selected.size !== all.length;
            hubState.files.selected = selectAll ? new Set(all) : new Set();
            // 直接改已有勾选框，不重绘列表（素材多时避免了整页重排）
            hubRoot.querySelectorAll('[data-file-select]').forEach(input => {
                input.checked = selectAll;
                input.closest('.storage-file-card')?.classList.toggle('selected', selectAll);
            });
            updateFileToolbar();
            break;
        }
        case 'file-delete': deleteSelectedFiles(); break;
    }
});

// 勾选框统一处理（勾选不整体重绘，避免滚动位置丢失）
hubRoot.addEventListener('change', event => {
    const input = event.target;
    if(input.matches('[data-trash-select]')){
        const id = input.dataset.trashSelect;
        if(input.checked) hubState.trashSelected.add(id); else hubState.trashSelected.delete(id);
        input.closest('.storage-file-card')?.classList.toggle('selected', input.checked);
        updateTrashToolbar();
    } else if(input.matches('[data-file-select]')){
        const rel = input.dataset.fileSelect;
        if(input.checked) hubState.files.selected.add(rel); else hubState.files.selected.delete(rel);
        input.closest('.storage-file-card')?.classList.toggle('selected', input.checked);
        updateFileToolbar();
    }
});

// 只刷新工具栏上的按钮状态与计数，不重绘整个列表
function updateTrashToolbar(){
    const n = hubState.trashSelected.size;
    const restoreBtn = hubRoot.querySelector('[data-act="trash-restore"]');
    const purgeBtn = hubRoot.querySelector('[data-act="trash-purge"]');
    if(restoreBtn){ restoreBtn.disabled = !n; restoreBtn.querySelector('span').textContent = `恢复 ${n || ''}`; }
    if(purgeBtn){ purgeBtn.disabled = !n; purgeBtn.querySelector('span').textContent = `彻底删除 ${n || ''}`; }
}
function updateFileToolbar(){
    const n = hubState.files.selected.size;
    const delBtn = hubRoot.querySelector('[data-act="file-delete"]');
    if(delBtn){ delBtn.disabled = !n; delBtn.querySelector('span').textContent = `删除 ${n || ''}`; }
}

// 素材文件网格滚动到底部时自动加载下一页
hubRoot.addEventListener('scroll', event => {
    const grid = event.target;
    if(!grid.classList?.contains('hub-file-grid')) return;
    const f = hubState.files;
    if(f.loading || f.loadingMore || !f.hasMore) return;
    if(grid.scrollTop + grid.clientHeight >= grid.scrollHeight - 320) loadFiles(true);
}, true);

// 标签页按钮
tabButtons.forEach(btn => btn.addEventListener('click', () => switchHubTab(btn.dataset.tab)));
document.getElementById('hubRefreshBtn')?.addEventListener('click', () => {
    hubState.expanded.clear();
    loadTab(hubState.tab, true);
});

// 外层 index.html 通过 postMessage 指定要打开的标签页；画布增减时让缓存失效
window.addEventListener('message', event => {
    if(event.origin && event.origin !== location.origin) return;
    const data = event.data || {};
    if(data.type === 'studio-hub-tab' && data.tab) switchHubTab(data.tab);
    if(data.type === 'canvases-changed'){
        if(hubState.skipNextChange){ hubState.skipNextChange = false; return; }
        hubState.loaded = { canvases:false, 'asset-trash':false, files:false };
        hubState.storageSummary = null;
        loadTab(hubState.tab, true);
    }
});

/* ===================== 启动 ===================== */
async function boot(){
    // 默认标签页：优先 URL 参数，其次画布回收站
    let initial = 'canvases';
    try {
        const q = new URLSearchParams(location.search).get('tab');
        if(q && HUB_TABS.includes(q)) initial = q;
    } catch(e){}
    // 项目 id -> 名称，给画布卡片显示所属项目
    try {
        const data = await apiJson('/api/projects');
        (data.projects || []).forEach(p => { hubState.projectNames[p.id] = p.name; });
    } catch(e){}
    switchHubTab(initial);
}
boot();
refreshIcons();