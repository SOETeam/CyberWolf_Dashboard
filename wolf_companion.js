/* CyberWolf companion browser layer. Keeps DOM, gesture, animation and storage out of the pure core. */
(function (root) {
    'use strict';
    const core = root.CyberWolfCompanionCore;
    if (!core || !root.document) return;
    const STORAGE_KEY = 'cyberwolf_companion_v1';
    const TAP_WINDOW = 550, TAP_DISTANCE = 36;
    const LOGICAL_SIZE = core.SPRITE_SIZE; // 24
    const CSS_SIZE = 48; // CSS px

    let state = core.createState(), layer, button, canvas, ctx, raf = 0, destroyed = false, paused = false;
    let taps = [], pointerStart = null, activePointers = new Set(), reduced = false;
    let animFrame = 'IDLE', walkStep = 0, animTick = 0, blinkOpen = true;
    let roamTarget = null;

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

    /* ── Render: draw the pixel-art wolf ──────────────────────── */
    const palette = core.getPalette();
    function drawWolf() {
        if (!ctx) return;
        ctx.clearRect(0, 0, LOGICAL_SIZE, LOGICAL_SIZE);
        ctx.imageSmoothingEnabled = false;

        let blocks;
        if (animFrame === 'WALK_A' || animFrame === 'WALK_B') {
            blocks = core.getWalkFrame(walkStep);
        } else {
            blocks = core.getFrameBlocks(animFrame);
        }

        // Draw each rectangle block at logical coordinates
        for (let i = 0; i < blocks.length; i++) {
            const b = blocks[i];
            ctx.fillStyle = palette[b[0]];
            ctx.fillRect(b[1], b[2], b[3], b[4]);
        }

        // Blink: draw eyelid over eye area when eyes closed
        const blinkFrame = !blinkOpen && (animFrame === 'IDLE');
        if (blinkFrame) {
            ctx.fillStyle = palette.BLACK;
            // Eye spans (18,8,2,1) + glow at (18,9,1,1); cover all with 2x2 eyelid
            ctx.fillRect(18, 8, 2, 2);
        }
    }

    /* ── Position rendering ───────────────────────────────────── */
    function render() {
        if (!button) return;
        let breathOffset = 0;
        if (state.state === core.STATES.IDLE && !reduced) {
            breathOffset = Math.sin(animTick * 0.08) * 1; // subtle 1px breathe
        } else if (state.state === core.STATES.CELEBRATING && !reduced) {
            breathOffset = Math.sin(animTick * 0.3) * 2; // excited bounce 2px
        }
        const yOff = Math.round(state.position.y + breathOffset);
        button.style.transform = 'translate3d(' + Math.round(state.position.x) + 'px,' + yOff + 'px,0)';
        button.dataset.state = state.state;
        drawWolf();
    }

    function schedule() {
        if (!raf && !destroyed) raf = root.requestAnimationFrame(tick);
    }

    /* ── Animation tick ───────────────────────────────────────── */
    function tick(timestamp) {
        raf = 0;
        if (destroyed) return;
        if (reduced) { render(); return; }

        const currentState = state.state;

        if (currentState === core.STATES.IDLE || currentState === core.STATES.ROAMING) {
            animTick++;

            // Breath animation: subtle canvas oscillation (handled via CSS class or position shift)
            // Actually, just update blink state and walk frame
            if (animTick % 30 === 0) { // ~every 0.5s at 60fps
                blinkOpen = !blinkOpen;
            }
            // Reset blink after 1 closed frame
            if (!blinkOpen && animTick % 30 >= 2) {
                blinkOpen = true;
            }

            if (currentState === core.STATES.ROAMING) {
                // Walk cycle: alternate legs every 6 frames
                if (animTick % 6 === 0) {
                    walkStep = (walkStep + 1) % 2;
                }
                animFrame = walkStep === 0 ? 'WALK_A' : 'WALK_B';
                // Roam toward target
                if (roamTarget) {
                    const dx = roamTarget.x - state.position.x;
                    const dy = roamTarget.y - state.position.y;
                    const dist = Math.hypot(dx, dy);
                    if (dist > 2) {
                        const speed = 0.5;
                        state.position.x += (dx / dist) * speed;
                        state.position.y += (dy / dist) * speed;
                    } else {
                        pickNewRoamTarget();
                    }
                }
            } else {
                animFrame = 'IDLE';
            }
        } else if (currentState === core.STATES.ENTERING || currentState === core.STATES.EXITING) {
            animFrame = 'IDLE';
        } else if (currentState === core.STATES.CALLED) {
            animFrame = 'IDLE';
            blinkOpen = true; // alert eyes
        } else if (currentState === core.STATES.CELEBRATING) {
            animFrame = (animTick++ % 12 < 6) ? 'WALK_A' : 'WALK_B'; // excited bounce
        }

        if (currentState !== core.STATES.CELEBRATING) {
            // Apply clamped position (layout may have changed)
            state.position = core.clampPosition(state.position, getSurface(), { width: CSS_SIZE, height: CSS_SIZE });
        }

        render();

        if (!destroyed) raf = root.requestAnimationFrame(tick);
    }

    function getSurface() {
        const vp = root.visualViewport;
        return { width: vp ? vp.width : root.innerWidth, height: vp ? vp.height : root.innerHeight };
    }

    function pickNewRoamTarget() {
        const surface = getSurface();
        const margin = 10;
        roamTarget = {
            x: margin + Math.random() * (surface.width - CSS_SIZE - margin * 2),
            y: margin + Math.random() * (surface.height - CSS_SIZE - margin * 2 - 60) + 60 // avoid very top
        };
    }

    /* ── Resize ────────────────────────────────────────────────── */
    function resize() {
        if (!layer) return;
        const surface = getSurface();
        layer.style.width = surface.width + 'px';
        layer.style.height = surface.height + 'px';
        state.position = core.clampPosition(state.position, surface, { width: CSS_SIZE, height: CSS_SIZE });
        schedule();
    }

    /* ── State setter ──────────────────────────────────────────── */
    function setState(next) {
        state = core.createState(Object.assign({}, state, { state: next }));
        save();
        if (next === core.STATES.IDLE || next === core.STATES.ROAMING) {
            blinkOpen = true; // eyes open on state entry
            if (next === core.STATES.ROAMING) pickNewRoamTarget();
        }
        schedule();
    }

    /* ── Companion interaction ─────────────────────────────────── */
    function callWolf() {
        if (destroyed || paused || modalBlocks()) return;
        setState(core.STATES.CALLED);
        if (!reduced) root.setTimeout(() => setState(core.STATES.IDLE), 900);
    }

    function validTap(event) {
        if (event.pointerType === 'touch' && activePointers.size > 1) return false;
        if (pointerStart && Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > TAP_DISTANCE) return false;
        return !blockedTarget(event.target) && !modalBlocks();
    }

    function pointerDown(event) { activePointers.add(event.pointerId); pointerStart = { x: event.clientX, y: event.clientY }; }
    function pointerUp(event) {
        activePointers.delete(event.pointerId);
        if (!validTap(event)) { taps = []; pointerStart = null; return; }
        const now = performance.now();
        taps = taps.filter(t => now - t.time <= TAP_WINDOW);
        taps.push({ time: now, x: event.clientX, y: event.clientY });
        if (taps.length >= 3) {
            const first = taps[taps.length - 3];
            const near = taps.slice(-3).every(t => Math.hypot(t.x - first.x, t.y - first.y) <= TAP_DISTANCE);
            if (near) { taps = []; callWolf(); }
        }
        pointerStart = null;
    }

    function visibility() {
        paused = root.document.visibilityState === 'hidden';
        setState(paused ? core.STATES.PAUSED : core.STATES.IDLE);
    }

    function rewardTaskCompletion(taskId, metadata, config) {
        const result = core.rewardTaskCompletion(state, taskId, metadata, config);
        if (result.awarded) {
            state = result.state;
            save();
            setState(core.STATES.CELEBRATING);
            if (!reduced) root.setTimeout(() => setState(core.STATES.IDLE), 1200);
        }
        return result;
    }

    /* ── Init / Destroy ────────────────────────────────────────── */
    function init() {
        if (layer || destroyed) return api;
        destroyed = false;
        reduced = mediaReduced();
        load();

        layer = root.document.createElement('div');
        layer.id = 'wolf-layer';
        layer.setAttribute('aria-label', 'CyberWolf companion');

        button = root.document.createElement('button');
        button.type = 'button';
        button.className = 'wolf-companion';
        button.tabIndex = 0;

        // Use logical-size canvas, CSS scales up
        canvas = root.document.createElement('canvas');
        canvas.width = LOGICAL_SIZE;
        canvas.height = LOGICAL_SIZE;
        canvas.setAttribute('aria-hidden', 'true');
        ctx = canvas.getContext('2d');
        button.appendChild(canvas);
        layer.appendChild(button);
        root.document.body.appendChild(layer);

        on(root.document, 'pointerdown', pointerDown, { capture: true, passive: true });
        on(root.document, 'pointerup', pointerUp, { capture: true, passive: true });
        on(root, 'resize', resize, { passive: true });
        if (root.visualViewport) on(root.visualViewport, 'resize', resize, { passive: true });
        on(root.document, 'visibilitychange', visibility);
        on(button, 'click', callWolf);

        resize();
        setState(core.STATES.ENTERING);
        if (reduced) {
            setState(core.STATES.IDLE);
        } else {
            root.setTimeout(() => setState(core.STATES.IDLE), 450);
        }
        return api;
    }

    function destroy() {
        listeners.splice(0).forEach(fn => fn());
        if (raf) root.cancelAnimationFrame(raf);
        if (layer) layer.remove();
        layer = button = canvas = ctx = null;
        destroyed = true;
    }

    const api = { init, destroy, exportState: () => core.exportState(state), rewardTaskCompletion, getState: () => core.createState(state) };
    root.CyberWolf = api;
    if (root.document.readyState === 'loading') on(root.document, 'DOMContentLoaded', init);
    else init();
})(typeof window !== 'undefined' ? window : globalThis);

/* Fixed surface: pointer-events stay off except for the accessible companion control. */
