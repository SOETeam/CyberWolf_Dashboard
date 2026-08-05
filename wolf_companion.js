/* CyberWolf companion browser layer. Keeps DOM, gesture, animation and storage out of the pure core. */
(function (root) {
    'use strict';
    const core = root.CyberWolfCompanionCore;
    if (!core || !root.document) return;
    const STORAGE_KEY = 'cyberwolf_companion_v1';
    const TAP_WINDOW = 550, TAP_DISTANCE = 36, SIZE = 48;
    let state = core.createState(), layer, button, canvas, ctx, raf = 0, destroyed = false, paused = false;
    let taps = [], pointerStart = null, activePointers = new Set(), reduced = false;
    const listeners = [];
    function on(target, event, handler, options) { target.addEventListener(event, handler, options); listeners.push(() => target.removeEventListener(event, handler, options)); }
    function load() { try { state = core.importState(root.localStorage.getItem(STORAGE_KEY) || null); } catch (_) { state = core.createState(); } }
    function save() { try { root.localStorage.setItem(STORAGE_KEY, core.exportState(state)); } catch (_) {} }
    function mediaReduced() { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); }
    function modalBlocks() {
        const gate = root.document.getElementById('access-gate'), modal = root.document.getElementById('calendar-modal');
        return !!((gate && getComputedStyle(gate).display !== 'none') || (modal && !modal.classList.contains('hidden')));
    }
    function blockedTarget(target) {
        if (!target || !target.closest) return true;
        if (target.closest('button, input, select, textarea, a, [role="button"], .task-card, .agenda-task-card, .agenda-event, .calendar-modal, .scrollable, [draggable="true"]')) return true;
        let node = target;
        while (node && node !== root.document.body) {
            if (node.scrollHeight > node.clientHeight + 2 || node.scrollWidth > node.clientWidth + 2) return true;
            node = node.parentElement;
        }
        return false;
    }
    function resize() {
        if (!layer) return;
        const viewport = root.visualViewport, width = viewport ? viewport.width : root.innerWidth, height = viewport ? viewport.height : root.innerHeight;
        layer.style.width = width + 'px'; layer.style.height = height + 'px';
        state.position = core.clampPosition(state.position, { width, height }, { width: SIZE, height: SIZE }); render();
    }
    function drawWolf() {
        if (!ctx) return; ctx.clearRect(0, 0, SIZE, SIZE); ctx.imageSmoothingEnabled = false;
        const black = '#05070b', dark = '#111827', cyan = '#00f0ff', magenta = '#ff28d7';
        const blocks = [[3,7,6,7],[7,3,4,5],[11,7,7,10],[18,11,5,9],[23,8,6,14],[29,5,4,10],[33,9,5,12],[38,14,4,11],[15,20,15,5],[10,25,24,6],[5,29,10,5],[29,28,6,5],[12,34,5,7],[28,34,5,7],[7,40,8,4],[28,40,9,4]];
        ctx.fillStyle = black; blocks.forEach(b => ctx.fillRect(b[0], b[1], b[2], b[3]));
        ctx.fillStyle = dark; ctx.fillRect(17, 16, 12, 9); ctx.fillRect(20, 25, 13, 7);
        ctx.fillStyle = cyan; ctx.fillRect(12, 14, 4, 3); ctx.fillRect(29, 14, 4, 3); ctx.fillRect(36, 27, 4, 2);
        ctx.fillStyle = magenta; ctx.fillRect(21, 20, 3, 2); ctx.fillRect(17, 30, 4, 2); ctx.fillRect(25, 35, 4, 2);
    }
    function render() { if (!button) return; button.style.transform = 'translate3d(' + Math.round(state.position.x) + 'px,' + Math.round(state.position.y) + 'px,0)'; button.dataset.state = state.state; drawWolf(); }
    function schedule() { if (!raf && !destroyed) raf = root.requestAnimationFrame(() => { raf = 0; render(); }); }
    function setState(next) { state = core.createState(Object.assign({}, state, { state: next })); save(); schedule(); }
    function callWolf() { if (destroyed || paused || modalBlocks()) return; setState(core.STATES.CALLED); if (!reduced) root.setTimeout(() => setState(core.STATES.IDLE), 900); }
    function validTap(event) { if (event.pointerType === 'touch' && activePointers.size > 1) return false; if (pointerStart && Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > TAP_DISTANCE) return false; return !blockedTarget(event.target) && !modalBlocks(); }
    function pointerDown(event) { activePointers.add(event.pointerId); pointerStart = { x: event.clientX, y: event.clientY }; }
    function pointerUp(event) {
        activePointers.delete(event.pointerId); if (!validTap(event)) { taps = []; pointerStart = null; return; }
        const now = performance.now(); taps = taps.filter(t => now - t.time <= TAP_WINDOW); taps.push({ time: now, x: event.clientX, y: event.clientY });
        if (taps.length >= 3) { const first = taps[taps.length - 3], near = taps.slice(-3).every(t => Math.hypot(t.x - first.x, t.y - first.y) <= TAP_DISTANCE); if (near) { taps = []; callWolf(); } }
        pointerStart = null;
    }
    function visibility() { paused = root.document.visibilityState === 'hidden'; setState(paused ? core.STATES.PAUSED : core.STATES.IDLE); }
    function rewardTaskCompletion(taskId, metadata, config) { const result = core.rewardTaskCompletion(state, taskId, metadata, config); if (result.awarded) { state = result.state; save(); setState(core.STATES.CELEBRATING); if (!reduced) root.setTimeout(() => setState(core.STATES.IDLE), 1200); } return result; }
    function init() {
        if (layer || destroyed) return api; destroyed = false; reduced = mediaReduced(); load();
        layer = root.document.createElement('div'); layer.id = 'wolf-layer'; layer.setAttribute('aria-label', 'CyberWolf companion');
        button = root.document.createElement('button'); button.type = 'button'; button.className = 'wolf-companion'; button.tabIndex = 0; canvas = root.document.createElement('canvas'); canvas.width = SIZE; canvas.height = SIZE; canvas.setAttribute('aria-hidden', 'true'); ctx = canvas.getContext('2d'); button.appendChild(canvas); layer.appendChild(button); root.document.body.appendChild(layer);
        on(root.document, 'pointerdown', pointerDown, { capture: true, passive: true }); on(root.document, 'pointerup', pointerUp, { capture: true, passive: true }); on(root, 'resize', resize, { passive: true }); if (root.visualViewport) on(root.visualViewport, 'resize', resize, { passive: true }); on(root.document, 'visibilitychange', visibility); on(button, 'click', callWolf);
        resize(); setState(core.STATES.ENTERING); if (reduced) setState(core.STATES.IDLE); else root.setTimeout(() => setState(core.STATES.IDLE), 450); return api;
    }
    function destroy() { listeners.splice(0).forEach(fn => fn()); if (raf) root.cancelAnimationFrame(raf); if (layer) layer.remove(); layer = button = canvas = ctx = null; destroyed = true; }
    const api = { init, destroy, exportState: () => core.exportState(state), rewardTaskCompletion, getState: () => core.createState(state) }; root.CyberWolf = api;
    if (root.document.readyState === 'loading') on(root.document, 'DOMContentLoaded', init); else init();
})(typeof window !== 'undefined' ? window : globalThis);

/* Fixed surface: pointer-events stay off except for the accessible companion control. */
