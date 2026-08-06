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
    let visibleSurfaces = []; // Normalized viewport-surface rectangles from DOM

    /* ── Surface-compute rAF scheduler (one-raf throttle) ──────── */
    let surfRaf = 0;

    const listeners = [];
    function on(target, event, handler, options) { target.addEventListener(event, handler, options); listeners.push(() => target.removeEventListener(event, handler, options)); }
    function load() { try { state = core.importState(root.localStorage.getItem(STORAGE_KEY) || null); } catch (_) { state = core.createState(); } }
    function save() { try { root.localStorage.setItem(STORAGE_KEY, core.exportState(state)); } catch (_) {} }
    function mediaReduced() { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); }

    /* ── Modal/access-gate detection ───────────────────────────── */
    function modalBlocks() {
        const gate = root.document.getElementById('access-gate'), modal = root.document.getElementById('calendar-modal');
        return !!((gate && getComputedStyle(gate).display !== 'none') || (modal && !modal.classList.contains('hidden')));
    }

    /* ── Pointer-event routing helper ──────────────────────────── */
    /**
     * Check whether a pointer event originated from an element that
     * should NOT trigger triple-tap or any document-level wolf gesture.
     * Uses composedPath() + closest-selector so shadow-DOM and nested
     * elements are correctly handled.
     */
    function blockedTarget(target) {
        if (!target || !target.closest) return true;
        // Controls, cards, modals, scrollable containers, draggable items
        if (target.closest('button, input, select, textarea, a, [role="button"], .task-card, .agenda-task-card, .agenda-event, .calendar-modal, .scrollable, [draggable="true"]')) return true;
        // Also block scrollable parents (vertical/horizontal overflow indicates scroll container)
        let node = target;
        while (node && node !== root.document.body) {
            if (node.scrollHeight > node.clientHeight + 2 || node.scrollWidth > node.clientWidth + 2) return true;
            node = node.parentElement;
        }
        return false;
    }

    /* ── Visible dashboard surface derivation ────────────────────── */
    /**
     * Query the live DOM for panel/card/border elements that can serve
     * as walkable terrain for the wolf. Excludes the wolf layer itself,
     * modals, access gates, hidden panels, inputs, and buttons.
     */
    function getVisibleSurfaceRects() {
        var selectors = '.widget, .view-panel > section, .task-card, .agenda-task-card, .agenda-vector-group, .filter-bar, .shared-widgets';
        var results = root.document.querySelectorAll(selectors);
        var rects = [];
        for (var i = 0; i < results.length; i++) {
            var el = results[i];
            var style = getComputedStyle(el);
            // Skip hidden / zero-size elements
            if (style.display === 'none' || style.visibility === 'hidden') continue;
            if (el.offsetWidth <= 0 || el.offsetHeight <= 0) continue;
            var rect = el.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) continue;
            rects.push(rect);
        }
        return rects;
    }

    /**
     * Normalize DOM rects into viewport-coordinates via the core normalizer.
     * Returns an array of {left,top,right,bottom,width,height} used for
     * surface-based roaming targets. Throttled through one-rAF when called
     * from dynamic sources (scroll, resize).
     */
    function computeSurfaces() {
        if (destroyed) return;
        var domRects = getVisibleSurfaceRects();
        var vp = root.visualViewport;
        var bounds = {
            width: vp ? vp.width : root.innerWidth,
            height: vp ? vp.height : root.innerHeight
        };
        visibleSurfaces = core.normalizeSurfaces(domRects, bounds, { width: CSS_SIZE, height: CSS_SIZE });
    }

    function scheduleSurfaceCompute() {
        if (surfRaf) return; // Already pending — one-rAF throttling
        surfRaf = root.requestAnimationFrame(function () {
            surfRaf = 0;
            if (!destroyed) computeSurfaces();
        });
    }

    /* ── Position helpers ──────────────────────────────────────── */
    function getSurface() {
        // Fallback to viewport when no valid surfaces exist
        if (visibleSurfaces && visibleSurfaces.length > 0) {
            // Return bounding-box of all surfaces combined
            var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (var i = 0; i < visibleSurfaces.length; i++) {
                var s = visibleSurfaces[i];
                if (s.left < minX) minX = s.left;
                if (s.top < minY) minY = s.top;
                if (s.right > maxX) maxX = s.right;
                if (s.bottom > maxY) maxY = s.bottom;
            }
            return { width: maxX - minX, height: maxY - minY, left: minX, top: minY, right: maxX, bottom: maxY };
        }
        var vp = root.visualViewport;
        return { width: vp ? vp.width : root.innerWidth, height: vp ? vp.height : root.innerHeight };
    }

    function pickNewRoamTarget() {
        if (visibleSurfaces && visibleSurfaces.length > 0) {
            // Pick a random surface from available ones
            var idx = Math.floor(Math.random() * visibleSurfaces.length);
            var surface = visibleSurfaces[idx];
            // Try a few anchors before falling back to random
            var anchors = ['random', 'center'];
            var anchorIdx = Math.floor(Math.random() * anchors.length);
            var tgt = core.surfaceTarget(surface, { width: CSS_SIZE, height: CSS_SIZE }, anchors[anchorIdx]);
            if (tgt) {
                // Convert surface-relative position to viewport position
                roamTarget = { x: tgt.x, y: tgt.y };
                return;
            }
        }
        // Fallback: random viewport position (when no valid surfaces)
        var surface = getSurface();
        var margin = 10;
        roamTarget = {
            x: margin + Math.random() * (surface.width - CSS_SIZE - margin * 2),
            y: margin + Math.random() * (surface.height - CSS_SIZE - margin * 2 - 60) + 60 // avoid very top
        };
    }

    /* ── Render: draw the pixel-art wolf ───────────────────────── */
    const palette = core.getPalette();
    function drawWolf() {
        if (!ctx) return;
        ctx.clearRect(0, 0, LOGICAL_SIZE, LOGICAL_SIZE);
        ctx.imageSmoothingEnabled = false;

        var blocks;
        if (animFrame === 'WALK_A' || animFrame === 'WALK_B') {
            blocks = core.getWalkFrame(walkStep);
        } else {
            blocks = core.getFrameBlocks(animFrame);
        }

        // Draw each rectangle block at logical coordinates
        for (var i = 0; i < blocks.length; i++) {
            var b = blocks[i];
            ctx.fillStyle = palette[b[0]];
            ctx.fillRect(b[1], b[2], b[3], b[4]);
        }

        // Blink: draw eyelid over eye area when eyes closed
        var blinkFrame = !blinkOpen && (animFrame === 'IDLE');
        if (blinkFrame) {
            ctx.fillStyle = palette.BLACK;
            ctx.fillRect(14, 7, 3, 3);
        }
    }

    /* ── Position rendering ────────────────────────────────────── */
    function render() {
        if (!button) return;
        var breathOffset = 0;
        if (state.state === core.STATES.IDLE && !reduced) {
            breathOffset = Math.sin(animTick * 0.08) * 1; // subtle 1px breathe
        } else if (state.state === core.STATES.CELEBRATING && !reduced) {
            breathOffset = Math.sin(animTick * 0.3) * 2; // excited bounce 2px
        }
        var yOff = Math.round(state.position.y + breathOffset);
        button.style.transform = 'translate3d(' + Math.round(state.position.x) + 'px,' + yOff + 'px,0)';
        button.dataset.state = state.state;
        drawWolf();
    }

    function schedule() {
        if (!raf && !destroyed) raf = root.requestAnimationFrame(tick);
    }

    /* ── Animation tick ─────────────────────────────────────────── */
    function tick(timestamp) {
        raf = 0;
        if (destroyed) return;
        if (reduced) { render(); return; }

        var currentState = state.state;

        if (currentState === core.STATES.IDLE || currentState === core.STATES.ROAMING) {
            animTick++;

            // Blink cycle: ~every 0.5s at 60fps
            if (animTick % 30 === 0) { // toggle closed
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
                    var dx = roamTarget.x - state.position.x;
                    var dy = roamTarget.y - state.position.y;
                    var dist = Math.hypot(dx, dy);
                    if (dist > 2) {
                        var speed = 0.5;
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

    /* ── Resize ─────────────────────────────────────────────────── */
    function resize() {
        if (!layer) return;
        var surface = getSurface();
        layer.style.width = surface.width + 'px';
        layer.style.height = surface.height + 'px';
        state.position = core.clampPosition(state.position, surface, { width: CSS_SIZE, height: CSS_SIZE });
        schedule();
        // Recompute surfaces on resize (throttled through rAF)
        scheduleSurfaceCompute();
    }

    /* ── State setter ───────────────────────────────────────────── */
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
        if (!reduced) root.setTimeout(function () { setState(core.STATES.IDLE); }, 900);
    }

    function pointerDown(event) {
        activePointers.add(event.pointerId);
        pointerStart = { x: event.clientX, y: event.clientY };
    }

    function pointerUp(event) {
        activePointers.delete(event.pointerId);
        // Triple-tap should not fire when pointing at interactive controls
        if (!validTap(event)) { taps = []; pointerStart = null; return; }
        var now = performance.now();
        taps = taps.filter(function (t) { return now - t.time <= TAP_WINDOW; });
        taps.push({ time: now, x: event.clientX, y: event.clientY });
        if (taps.length >= 3) {
            var first = taps[taps.length - 3];
            var near = taps.slice(-3).every(function (t) {
                return Math.hypot(t.x - first.x, t.y - first.y) <= TAP_DISTANCE;
            });
            if (near) { taps = []; callWolf(); }
        }
        pointerStart = null;
    }

    function validTap(event) {
        if (event.pointerType === 'touch' && activePointers.size > 1) return false;
        if (pointerStart && Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > TAP_DISTANCE) return false;
        return !blockedTarget(event.target) && !modalBlocks();
    }

    function visibility() {
        paused = root.document.visibilityState === 'hidden';
        setState(paused ? core.STATES.PAUSED : core.STATES.IDLE);
    }

    function rewardTaskCompletion(taskId, metadata, config) {
        var result = core.rewardTaskCompletion(state, taskId, metadata, config);
        if (result.awarded) {
            state = result.state;
            save();
            setState(core.STATES.CELEBRATING);
            if (!reduced) root.setTimeout(function () { setState(core.STATES.IDLE); }, 1200);
        }
        return result;
    }

    /* ── Init / Destroy ────────────────────────────────────────── */
    function init() {
        if (layer || destroyed) return api;
        destroyed = false;
        reduced = mediaReduced();
        load();

        // Create transparent fixed overlay layer
        layer = root.document.createElement('div');
        layer.id = 'wolf-layer';
        layer.setAttribute('aria-label', 'CyberWolf companion');

        button = root.document.createElement('button');
        button.type = 'button';
        button.className = 'wolf-companion';
        button.tabIndex = 0;
        button.setAttribute('title', 'Call CyberWolf');
        button.setAttribute('aria-label', 'Click to call the CyberWolf');

        // Use logical-size canvas, CSS scales up
        canvas = root.document.createElement('canvas');
        canvas.width = LOGICAL_SIZE;
        canvas.height = LOGICAL_SIZE;
        canvas.setAttribute('aria-hidden', 'true');
        ctx = canvas.getContext('2d');
        button.appendChild(canvas);
        layer.appendChild(button);
        root.document.body.appendChild(layer);

        // Document-level pointer capture for triple-tap (passive, non-blocking)
        on(root.document, 'pointerdown', pointerDown, { capture: true, passive: true });
        on(root.document, 'pointerup', pointerUp, { capture: true, passive: true });
        on(root, 'resize', resize, { passive: true });
        if (root.visualViewport) on(root.visualViewport, 'resize', resize, { passive: true });
        on(root.document, 'visibilitychange', visibility);

        // Direct click/tap on the button is the primary interaction seam
        on(button, 'click', function (e) {
            e.stopPropagation(); // Don't bubble to document triple-tap
            callWolf();
        });

        // Scroll-based surface recomputation (throttled through rAF)
        on(root.document, 'scroll', scheduleSurfaceCompute, { passive: true });

        // Compute initial surfaces after paint
        root.setTimeout(function () {
            computeSurfaces();
            // Observe DOM for layout changes using ResizeObserver + MutationObserver
            tryObserve();
        }, 500);

        resize();
        setState(core.STATES.ENTERING);
        if (reduced) {
            setState(core.STATES.IDLE);
        } else {
            root.setTimeout(function () { setState(core.STATES.IDLE); }, 450);
        }
        return api;
    }

    /**
     * Attempt to set up observers for live surface tracking.
     * Gracefully degrades on older browsers without ResizeObserver.
     */
    function tryObserve() {
        var body = root.document.body;
        // ResizeObserver: detect panel size/content changes
        if (root.ResizeObserver) {
            var ro = new root.ResizeObserver(function () {
                if (!destroyed) scheduleSurfaceCompute();
            });
            // Observe key widget containers
            var widgets = root.document.querySelectorAll('.view-panel.active, .shared-widgets, .dashboard-grid');
            for (var i = 0; i < widgets.length; i++) {
                try { ro.observe(widgets[i]); } catch (_) {}
            }
            listeners.push(function () { try { ro.disconnect(); } catch (_) {} });
        }
        // MutationObserver: detect added/removed cards or panels
        if (root.MutationObserver) {
            var mo = new root.MutationObserver(function (mutations) {
                var surfaceChange = false;
                for (var i = 0; i < mutations.length; i++) {
                    var m = mutations[i];
                    if (m.addedNodes.length || m.removedNodes.length ||
                        (m.attributeName === 'class' && m.target.classList)) {
                        // Check if mutation affects visible widget areas
                        if (m.target.closest('.widget, .view-panel, .task-card, .agenda-task-card, .shared-widgets')) {
                            surfaceChange = true;
                            break;
                        }
                    }
                }
                if (surfaceChange && !destroyed) scheduleSurfaceCompute();
            });
            mo.observe(body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
            listeners.push(function () { try { mo.disconnect(); } catch (_) {} });
        }
    }

    function destroy() {
        listeners.splice(0).forEach(function (fn) { fn(); });
        if (raf) root.cancelAnimationFrame(raf);
        if (surfRaf) root.cancelAnimationFrame(surfRaf);
        if (layer) layer.remove();
        layer = button = canvas = ctx = null;
        visibleSurfaces = [];
        destroyed = true;
    }

    var api = { init: init, destroy: destroy, exportState: function () { return core.exportState(state); }, rewardTaskCompletion: rewardTaskCompletion, getState: function () { return core.createState(state); } };
    root.CyberWolf = api;
    if (root.document.readyState === 'loading') on(root.document, 'DOMContentLoaded', init);
    else init();
})(typeof window !== 'undefined' ? window : globalThis);

/* Fixed surface: pointer-events stay off except for the accessible companion control. */
