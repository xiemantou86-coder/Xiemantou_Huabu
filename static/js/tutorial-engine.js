(function () {
    'use strict';
    const steps = window.TUTORIAL_DATA;
    if (!Array.isArray(steps) || !steps.length) return;
    const completedKey = 'infinite_canvas_tutorial_completed_v1';
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const images = new Map();
    let dialog, ui, currentStep = 0, revision = 0, busy = false, loading = false;
    let timers = [], animations = [], entry, returnFocus, autoStartTimer;

    function rememberDone() {
        try { localStorage.setItem(completedKey, 'true'); } catch (_) {}
    }
    function clearActions() {
        timers.forEach(clearTimeout);
        animations.forEach(animation => animation.cancel());
        timers = [];
        animations = [];
    }
    function later(fn, delay) {
        const version = revision;
        timers.push(setTimeout(() => {
            if (version === revision && dialog.open) fn();
        }, delay));
    }
    function loadImage(index) {
        const url = '/static/tutorial/' + encodeURIComponent(steps[index].image);
        if (!images.has(url)) {
            const task = new Promise((resolve, reject) => {
                const image = new Image();
                const timeout = setTimeout(() => reject(new Error('image timeout')), 15000);
                image.onload = () => { clearTimeout(timeout); resolve(image); };
                image.onerror = () => { clearTimeout(timeout); reject(new Error('image failed')); };
                image.src = url;
            });
            images.set(url, task);
            task.catch(() => images.delete(url));
        }
        return images.get(url);
    }
    function build() {
        if (dialog) return;
        dialog = document.createElement('dialog');
        dialog.id = 'tutorialTheater';
        dialog.className = 'tutorial-theater';
        dialog.setAttribute('aria-labelledby', 'tutorialTitle');
        dialog.setAttribute('aria-describedby', 'tutorialDescription');
        dialog.innerHTML = `
            <header class="tutorial-bar">
                <span class="tutorial-brand">无限画布 · 新手之旅</span>
                <span class="tutorial-demo-label">跟着光标，认识创作流程</span>
                <button class="tutorial-skip" type="button" data-tutorial="skip">跳过教程 ×</button>
            </header>
            <div class="tutorial-scene">
                <div class="tutorial-visual">
                    <img class="tutorial-slide" alt="" draggable="false" data-tutorial="image">
                    <svg class="tutorial-wire" viewBox="0 0 1920 1080" aria-hidden="true" data-tutorial="wire" hidden>
                        <path data-tutorial="path"></path>
                    </svg>
                    <div class="tutorial-result" data-tutorial="result" hidden></div>
                    <div class="tutorial-cursor" data-tutorial="cursor" aria-hidden="true" hidden>
                        <span class="tutorial-ring"></span>
                        <svg viewBox="0 0 26 30"><path d="M2 2 L4 25 L10 19 L15 28 L19 26 L14 17 L23 17 Z" fill="white" stroke="#172033" stroke-width="1.6" stroke-linejoin="round"/></svg>
                        <span class="tutorial-gesture" data-tutorial="gesture"></span>
                    </div>
                </div>
                <section class="tutorial-card" aria-live="polite" aria-atomic="true">
                    <p class="tutorial-chapter" data-tutorial="chapter"></p>
                    <h2 class="tutorial-title" id="tutorialTitle" data-tutorial="title"></h2>
                    <p class="tutorial-description" id="tutorialDescription" data-tutorial="description"></p>
                    <p class="tutorial-note" data-tutorial="note"></p>
                    <p class="tutorial-error" role="status" data-tutorial="error"></p>
                    <button class="tutorial-next" type="button" data-tutorial="next"></button>
                </section>
            </div>
            <footer class="tutorial-footer">
                <div class="tutorial-navigation">
                    <button class="tutorial-quiet" type="button" data-tutorial="back">← 上一步</button>
                    <span class="tutorial-count" data-tutorial="count"></span>
                </div>
                <nav class="tutorial-dots" aria-label="教程步骤" data-tutorial="dots"></nav>
                <button class="tutorial-quiet" type="button" data-tutorial="replay" title="重播当前步骤的光标演示">重播动作 ↻</button>
            </footer>
            <div class="tutorial-progress" aria-hidden="true"><span data-tutorial="progress"></span></div>`;
        document.body.appendChild(dialog);
        ui = Object.fromEntries([...dialog.querySelectorAll('[data-tutorial]')].map(el => [el.dataset.tutorial, el]));
        steps.forEach((step, index) => {
            const dot = document.createElement('button');
            dot.type = 'button';
            dot.className = 'tutorial-dot';
            dot.setAttribute('aria-label', (index + 1) + '. ' + step.title);
            dot.addEventListener('click', () => { if (!busy) renderStep(index); });
            ui.dots.appendChild(dot);
        });
        ui.next.addEventListener('click', next);
        ui.back.addEventListener('click', () => { if (!busy) renderStep(currentStep - 1); });
        ui.replay.addEventListener('click', () => { if (!busy) renderStep(currentStep); });
        ui.skip.addEventListener('click', skip);
        dialog.addEventListener('cancel', event => { event.preventDefault(); skip(); });
        dialog.addEventListener('keydown', event => {
            if (event.altKey || event.ctrlKey || event.metaKey || busy) return;
            if (event.key === 'ArrowRight') { event.preventDefault(); next(); }
            if (event.key === 'ArrowLeft') { event.preventDefault(); renderStep(currentStep - 1); }
        });
    }
    function setBusy(value) {
        busy = value;
        [ui.next, ui.back, ui.skip, ui.replay, ...ui.dots.children].forEach(el => { el.disabled = value; });
        ui.back.disabled = value || currentStep === 0;
        dialog.setAttribute('aria-busy', String(value));
    }
    async function renderStep(index) {
        if (index < 0 || index >= steps.length || busy) return;
        clearActions();
        const version = ++revision;
        currentStep = index;
        const step = steps[index];
        dialog.dataset.step = String(index);
        dialog.dataset.card = step.card;
        ui.chapter.textContent = step.chapter;
        ui.title.textContent = step.title;
        ui.description.textContent = step.description;
        ui.note.textContent = step.note || '';
        ui.error.textContent = '';
        ui.count.textContent = (index + 1) + ' / ' + steps.length;
        ui.progress.style.width = ((index + 1) / steps.length * 100) + '%';
        ui.next.textContent = step.button || '下一步 →';
        ui.back.disabled = index === 0;
        ui.cursor.hidden = ui.result.hidden = true;
        ui.wire.setAttribute('hidden', '');
        ui.cursor.style.transitionDuration = '';
        ui.gesture.textContent = '';
        [...ui.dots.children].forEach((dot, i) => {
            dot.classList.toggle('is-done', i < index);
            if (i === index) dot.setAttribute('aria-current', 'step');
            else dot.removeAttribute('aria-current');
        });
        loading = true;
        ui.next.disabled = true;
        ui.image.style.opacity = '.25';
        try {
            const image = await loadImage(index);
            if (version !== revision || !dialog.open) return;
            ui.image.src = image.src;
            ui.image.alt = step.title + '，第 ' + (index + 1) + ' 帧操作演示';
            ui.image.style.opacity = '1';
            ui.cursor.hidden = false;
            animateStep(step);
            if (index + 1 < steps.length) loadImage(index + 1).catch(() => {});
        } catch (_) {
            if (version !== revision || !dialog.open) return;
            ui.error.textContent = '这张教程图片暂时未能加载。点「重播动作」重试，或继续下一步。';
        } finally {
            if (version === revision) { loading = false; ui.next.disabled = false; }
        }
    }
    function animateStep(step) {
        ui.cursor.className = 'tutorial-cursor';
        ui.path.style.strokeDasharray = '';
        ui.path.style.strokeDashoffset = '';
        if (reducedMotion.matches) {
            const p = step.points[step.points.length - 1];
            ui.cursor.style.left = (p[3] ?? p[0]) + '%';
            ui.cursor.style.top = (p[4] ?? p[1]) + '%';
            if (p[2] === 'drag') drawWire(p, false);
            if (p[2] === 'result') ui.result.hidden = false;
            return;
        }
        step.points.forEach((point, index) => later(() => {
            ui.cursor.className = 'tutorial-cursor';
            ui.gesture.textContent = '';
            ui.cursor.style.left = point[0] + '%';
            ui.cursor.style.top = point[1] + '%';
            later(() => {
                const action = point[2];
                if (action === 'drag') {
                    ui.gesture.textContent = '按住 · 拖动';
                    drawWire(point, true);
                    ui.cursor.style.transitionDuration = '1.1s';
                    ui.cursor.style.left = point[3] + '%';
                    ui.cursor.style.top = point[4] + '%';
                    later(() => { ui.cursor.style.transitionDuration = ''; ui.gesture.textContent = ''; }, 1150);
                } else if (action === 'pulse') {
                    ui.cursor.classList.add('is-pulsing');
                } else if (action === 'result') {
                    ui.result.hidden = false;
                } else if (action !== 'hover') {
                    ui.cursor.classList.add('is-clicking');
                    if (action === 'gold') ui.cursor.classList.add('is-gold');
                    if (action === 'right') ui.gesture.textContent = '右键';
                }
            }, 650);
        }, 100 + index * 2200));
    }
    function drawWire(point, animated) {
        const x1 = point[0] * 19.2, y1 = point[1] * 10.8;
        const x2 = point[3] * 19.2, y2 = point[4] * 10.8;
        const mid = (x1 + x2) / 2;
        ui.path.setAttribute('d', 'M ' + x1 + ' ' + y1 + ' C ' + mid + ' ' + y1 + ', ' + mid + ' ' + y2 + ', ' + x2 + ' ' + y2);
        ui.wire.removeAttribute('hidden');
        if (animated) {
            const length = ui.path.getTotalLength();
            ui.path.style.strokeDasharray = String(length);
            animations.push(ui.path.animate([{strokeDashoffset: length}, {strokeDashoffset: 0}], {duration:1100, fill:'forwards', easing:'ease-in-out'}));
        }
    }
    function next() {
        if (busy || loading) return;
        if (currentStep < steps.length - 1) renderStep(currentStep + 1);
        else finish();
    }
    function skip() {
        if (busy || !dialog?.open) return;
        rememberDone();
        close();
    }
    function close() {
        clearActions();
        ++revision;
        dialog.close();
        dialog.classList.remove('is-closing');
        (returnFocus?.isConnected ? returnFocus : entry)?.focus({preventScroll:true});
    }
    async function requestDemo() {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        try {
            const response = await fetch('/api/tutorial/demo', {method:'POST', signal:controller.signal});
            if (!response.ok) throw new Error('demo request failed');
            const data = await response.json();
            if (!data.canvas?.id) throw new Error('missing canvas');
            return data.canvas;
        } finally { clearTimeout(timeout); }
    }
    function openDemo(canvas) {
        const frame = document.getElementById('frame-canvas');
        if (!frame || typeof window.switchUI !== 'function') return Promise.reject(new Error('missing canvas frame'));
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => { cleanup(); reject(new Error('canvas timeout')); }, 25000);
            const ready = event => {
                if (event.origin !== location.origin || event.source !== frame.contentWindow
                    || event.data?.type !== 'tutorial-canvas-ready' || event.data.id !== canvas.id) return;
                cleanup();
                const button = document.querySelector('.nav-item[onclick*="\'canvas\'"]');
                window.switchUI(button, 'canvas');
                resolve();
            };
            function cleanup() { clearTimeout(timeout); window.removeEventListener('message', ready); }
            window.addEventListener('message', ready);
            frame.src = '/static/canvas.html?id=' + encodeURIComponent(canvas.id)
                + '&project=' + encodeURIComponent(canvas.project || 'default') + '&tutorial=kitten-v1';
        });
    }
    async function finish() {
        if (busy || !dialog.open) return;
        clearActions();
        setBusy(true);
        ui.error.textContent = '';
        ui.next.textContent = '正在准备你的画布…';
        try {
            // 优先直接打开用户现有的真实“演示”画布
            let canvas = { id: '825bd5531f664c7b9afe820ce2b711da', project: 'default' };
            try {
                const check = await fetch('/api/canvases/825bd5531f664c7b9afe820ce2b711da/meta');
                if(!check.ok) throw new Error('demo canvas not found');
            } catch(_) {
                canvas = await requestDemo();
            }
            await openDemo(canvas);
            rememberDone();
            dialog.classList.add('is-closing');
            later(() => { close(); setBusy(false); }, reducedMotion.matches ? 0 : 300);
        } catch (_) {
            setBusy(false);
            ui.next.textContent = '重试进入演示画布';
            ui.error.textContent = '暂时无法打开演示画布，请确认本地服务已启动并更新后重试。你也可以跳过，稍后从侧栏重新观看。';
        }
    }
    window.startTutorialGuide = function () {
        clearTimeout(autoStartTimer);
        build();
        if (dialog.open || busy) return;
        returnFocus = document.activeElement;
        dialog.classList.remove('is-closing');
        dialog.showModal();
        renderStep(0);
        // Keep a stable initial focus even while the first image is loading.
        ui.skip.focus({preventScroll:true});
    };
    window.nextTutorialStep = next;
    window.finishTutorialGuide = skip;
    function init() {
        const actions = document.querySelector('.side-actions');
        if (!actions) return;
        entry = document.createElement('button');
        entry.type = 'button';
        entry.id = 'tutorial-replay-entry';
        entry.className = 'side-pill';
        entry.title = '新手教程';
        entry.setAttribute('aria-label', '重新观看新手教程');
        entry.innerHTML = '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4z" stroke-linejoin="round"/></svg><span class="side-pill-text">新手教程</span>';
        entry.addEventListener('click', window.startTutorialGuide);
        actions.prepend(entry);
        let completed = false;
        try { completed = localStorage.getItem(completedKey) === 'true'; } catch (_) {}
        if (!completed) autoStartTimer = setTimeout(window.startTutorialGuide, 800);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
    else init();
})();
