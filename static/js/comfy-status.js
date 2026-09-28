/**
 * 本地（ComfyUI）可用性检测：供「本地功能」四个页面共用的友好提示。
 * 用法：
 *   const status = await ComfyStatus.refresh('zimage');   // feature 见后端 LOCAL_FEATURE_WORKFLOWS
 *   ComfyStatus.isLocalReady();                            // 本地是否可用
 */
(function () {
    if (window.ComfyStatus) return;

    const BANNER_ID = 'comfyStatusBanner';
    const FEATURE_MAP = {
        zimage: 'zimage',
        enhance: 'enhance',
        klein: 'klein',
        angle: 'angle'
    };

    let lastStatus = null;

    function T(key, fallback) {
        try {
            if (window.StudioI18n && typeof window.StudioI18n.t === 'function') {
                const value = window.StudioI18n.t(key);
                if (value && value !== key) return value;
            }
        } catch (e) { }
        return fallback;
    }

    function ensureStyle() {
        if (document.getElementById('comfyStatusStyle')) return;
        const style = document.createElement('style');
        style.id = 'comfyStatusStyle';
        style.textContent = [
            '#comfyStatusBanner{position:relative;display:none;padding:12px 46px 12px 18px;font-size:12px;line-height:1.7;color:#fff;background:#b91c1c;font-weight:600;letter-spacing:.01em}',
            '#comfyStatusBanner.show{display:block}',
            '#comfyStatusBanner.warn{background:#b45309}',
            '#comfyStatusBanner strong{display:block;font-weight:800;font-size:13px;margin-bottom:2px}',
            '#comfyStatusBanner .comfy-status-line{opacity:.92;word-break:break-all}',
            '#comfyStatusBanner button{position:absolute;top:8px;right:12px;width:22px;height:22px;border:0;border-radius:999px;background:rgba(255,255,255,.22);color:#fff;font-size:14px;line-height:1;cursor:pointer}',
            '#comfyStatusBanner button:hover{background:rgba(255,255,255,.36)}'
        ].join('');
        (document.head || document.documentElement).appendChild(style);
    }

    function ensureBanner() {
        ensureStyle();
        let box = document.getElementById(BANNER_ID);
        if (!box) {
            box = document.createElement('div');
            box.id = BANNER_ID;
            document.body.insertBefore(box, document.body.firstChild);
        }
        return box;
    }

    function build(status) {
        if (!status || typeof status !== 'object') return null;
        if (!status.connected) {
            return {
                level: 'error',
                title: T('studio.localOfflineTitle', '本地 ComfyUI 未连接'),
                lines: [
                    T('studio.localOfflineBody', '本页「本地」功能需要本机运行 ComfyUI 后端（默认 127.0.0.1:8188）。'),
                    T('studio.localOfflineHint', '请先启动 ComfyUI 后刷新本页；或切换到 ModelScope 云端引擎。')
                ]
            };
        }
        const workflows = status.missing_workflows || [];
        const nodes = status.missing_nodes || [];
        const inputs = status.missing_inputs || [];
        if (!workflows.length && !nodes.length && !inputs.length) return null;

        const lines = [];
        if (workflows.length) {
            lines.push(T('studio.localMissingWorkflows', '缺少工作流文件') + '：' + workflows.join('、'));
        }
        if (nodes.length) {
            lines.push(T('studio.localMissingNodes', '缺少自定义节点包') + '：' + nodes.join('、'));
        }
        if (inputs.length) {
            const values = inputs.map(item => item.value);
            lines.push(T('studio.localMissingModels', '缺少模型文件') + '：'
                + values.slice(0, 8).join('、')
                + (values.length > 8 ? ' 等 ' + values.length + ' 项' : ''));
        }
        return {
            level: 'warn',
            title: T('studio.localDepsTitle', '本地 ComfyUI 已连接，但依赖不完整'),
            lines: lines
        };
    }

    function render(status) {
        const box = ensureBanner();
        box.innerHTML = '';
        const info = build(status);
        if (!info) {
            box.classList.remove('show', 'warn', 'error');
            return;
        }
        box.classList.add('show');
        box.classList.toggle('error', info.level === 'error');
        box.classList.toggle('warn', info.level !== 'error');

        const title = document.createElement('strong');
        title.textContent = info.title;
        box.appendChild(title);

        info.lines.forEach(function (line) {
            const row = document.createElement('div');
            row.className = 'comfy-status-line';
            row.textContent = line;
            box.appendChild(row);
        });

        const close = document.createElement('button');
        close.type = 'button';
        close.textContent = '×';
        close.setAttribute('aria-label', T('studio.localDismiss', '关闭提示'));
        close.onclick = function () { box.classList.remove('show'); };
        box.appendChild(close);
    }

    async function refresh(feature) {
        const key = FEATURE_MAP[feature] || '';
        let status = null;
        try {
            const res = await fetch('/api/comfyui/status?feature=' + encodeURIComponent(key));
            if (res.ok) status = await res.json();
        } catch (e) {
            console.error('ComfyUI status check failed', e);
        }
        lastStatus = status;
        render(status);
        return status;
    }

    window.ComfyStatus = {
        refresh: refresh,
        last: function () { return lastStatus; },
        isLocalReady: function () { return !!(lastStatus && lastStatus.available); },
        isChecked: function () { return !!lastStatus; },
        notifyBlocked: function () {
            const info = build(lastStatus);
            if (!info) {
                alert(T('studio.localUnavailable', '本地 ComfyUI 当前不可用，请先启动 ComfyUI 后端。'));
                return;
            }
            alert(info.title + '\n' + info.lines.join('\n'));
        }
    };

    window.addEventListener('studio-lang-change', function () {
        if (lastStatus) render(lastStatus);
    });
})();
