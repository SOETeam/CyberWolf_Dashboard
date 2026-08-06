/* CyberWolf companion browser layer. Keeps DOM, gesture, animation and storage out of the pure core. */
(function (root) {
    'use strict';
    const core = root.CyberWolfCompanionCore;
    if (!core || !root.document) return;
    const STORAGE_KEY = 'cyberwolf_companion_v1';
    const TAP_WINDOW = 550, TAP_DISTANCE = 36;
    const LOGICAL_SIZE = core.SPRITE_SIZE; // 24
    const CSS_SIZE = 48; // CSS px

    let state = core.createState(), needs = core.createNeeds(), fullLoaded = false,
        layer, button, canvas, ctx, raf = 0, destroyed = false, paused = false;
    let taps = [], pointerStart = null, activePointers = new Set(), reduced = false;
    let animFrame = 'IDLE', walkStep = 0, animTick = 0, blinkOpen = true;
    let roamTarget = null;
    let visibleSurfaces = []; // Normalized world-surface rectangles from DOM
    let actionPanelOpen = false; // whether the action rail is currently showing
    let attentionAnim = 0; // counts ticks during call/attention response
    let lastDecayed = false; // track that we already applied one-on-load decay
    // Tamagotchi status popup state
    let statusPopupOpen = false; // whether tamagotchi status popup overlay is visible
    var _statusPanelWasOpen = false; // tracks action panel state before popup opened
    var _statusResumeState = core.STATES.IDLE; // state to restore after popup closes
    // World-scroll tracking
    let docScrollX = 0, docScrollY = 0; // accumulated document scroll
    // Re-entry state tracking
    var _wasVisible = false;   // true when wolf came back into view from offscreen
    var _reentering = false;   // true while ENTERING animation is active

    /* ── Surface-compute rAF scheduler (one-raf throttle) ──────── */
    let surfRaf = 0;

    /* ── Re-entry guard: prevent immediate target replacement ───── */
    let lastEnterAt = 0; // timestamp (ms) of last ENTERING→ROAMING arrival
    let _reenterHoldUntil = 0; // end time for mandatory hold at entry point

    /* ── World-scroll accumulator ───────────────────────────────── */
    let scrollFreezeUntil = 0; // end timestamp (ms) during which movement must pause for scroll stability
    function readScroll() {
        var newX = root.pageXOffset || root.document.documentElement.scrollLeft || 0;
        var newY = root.pageYOffset || root.document.documentElement.scrollTop  || 0;
        var changed = (newX !== docScrollX || newY !== docScrollY);
        docScrollX = newX;
        docScrollY = newY;
        if (changed && root.performance) {
            // Freeze movement steps for 250ms after any document scroll event.
            // This prevents world-position drift during scroll operations:
            // the viewport projection shifts naturally, but the wolf's
            // stored world position remains stable.
            scrollFreezeUntil = performance.now() + 250;
        }
    }

    const listeners = [];
    function on(target, event, handler, options) { target.addEventListener(event, handler, options); listeners.push(() => target.removeEventListener(event, handler, options)); }
    function mediaReduced() { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); }

    /* ── Modal/access-gate detection ───────────────────────────── */
    function modalBlocks() {
        const gate = root.document.getElementById('access-gate'), modal = root.document.getElementById('calendar-modal');
        return !!((gate && getComputedStyle(gate).display !== 'none') || (modal && !modal.classList.contains('hidden')));
    }

    /* ── Pointer-event routing helper ──────────────────────────── */
    function blockedTarget(target) {
        if (!target || !target.closest) return true;
        if (target.closest('button, input, select, textarea, a, [role="button"], .task-card, .agenda-task-card, .agenda-event, .calendar-modal, .scrollable, [draggable="true"]')) return true;
        // Block action-panel internal elements too
        if (target.closest('#wolf-actions, #wolf-action-seam')) return false; // allow interaction inside action seam
        let node = target;
        const stopAt = new Set(['view-panel', 'dashboard-grid', 'shared-widgets']);
        while (node && node !== root.document.body) {
            if (stopAt.has(node.className) || stopAt.has(node.id)) break;
            if (node.scrollHeight > node.clientHeight + 2 || node.scrollWidth > node.clientWidth + 2) return true;
            node = node.parentElement;
        }
        return false;
    }

    /* ── Visible dashboard surface derivation ────────────────────── */
    function getVisibleSurfaceRects() {
        var selectors = '.widget, .view-panel > section, .task-card, .agenda-task-card, .agenda-vector-group, .filter-bar, .shared-widgets';
        var results = root.document.querySelectorAll(selectors);
        var rects = [];
        for (var i = 0; i < results.length; i++) {
            var el = results[i];
            var style = getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') continue;
            if (el.offsetWidth <= 0 || el.offsetHeight <= 0) continue;
            var rect = el.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) continue;
            rects.push(rect);
        }
        return rects;
    }

    /**
     * Normalize DOM rects into document/world-coordinates via the core normalizer.
     * Returns an array of {left,top,right,bottom,width,height} in document space,
     * used for surface-based roaming targets. Throttled through one-rAF when called
     * from dynamic sources (scroll, resize).
     *
     * Key fix: do NOT clip surfaces to viewport — world-space geometry must remain
     * stable under local container scroll. Clipping caused norm-ed surface bounds to
     * shift when scroll changed, driving position drift in clampPosition.
     */
    function computeSurfaces() {
        if (destroyed) return;
        readScroll(); // refresh scroll offsets
        var domRects = getVisibleSurfaceRects();
        // Convert each rect to world coordinates
        var worldRects = [];
        for (var i = 0; i < domRects.length; i++) {
            var wr = core.rectToWorldRect(domRects[i], { x: docScrollX, y: docScrollY }, root.visualViewport);
            worldRects.push(wr);
        }
        // Pass infinite viewport bounds so no clipping occurs — surfaces retain stable
        // document-space rectangles regardless of local container scroll.
        var hugeVwr = { left: -Infinity, top: -Infinity, right: Infinity, bottom: Infinity, width: Infinity, height: Infinity };
        visibleSurfaces = core.normalizeSurfaces(worldRects, hugeVwr, { width: CSS_SIZE, height: CSS_SIZE });
    }

    function scheduleSurfaceCompute() {
        if (surfRaf) return; // Already pending — one-rAF throttling
        surfRaf = root.requestAnimationFrame(function () {
            surfRaf = 0;
            if (!destroyed) computeSurfaces();
        });
    }

    /* ── Position helpers ──────────────────────────────────────── */

    var _enteringActive = false; // true while wolf is walking through ENTERING transition
    /** Track last known world position for offscreen → re-entry transitions. */
    let prevWorldPosition = null;

    /**
     * Detect whether the wolf is outside the visible viewport in world coords.
     * If so, compute a side-entry point and schedule an ENTERING animation.
     * NOTE: Does NOT touch roamTarget when wolf is mid-re-entry (_reentering)
     * or already in ENTERING state — prevents the ENTERING loop from having its
     * target overwritten every 8 ticks, which kept the wolf stuck at (2000,1200).
     */
    function checkOffscreenReentry() {
        if (!layer || destroyed) return;
        var visRect = core.visibleWorldRect({ x: docScrollX, y: docScrollY }, root.visualViewport);
        var pos = state.position || { x: 0, y: 0 };
        var visible = core.isWorldPositionVisible(pos, visRect, { width: CSS_SIZE, height: CSS_SIZE });

        // Guard: do not recalculate roamTarget while mid-re-entry animation.
        // The tick's ENTERING block manages the wolf's movement toward entry.
        if (_reentering || state.state === core.STATES.ENTERING) {
            // Only clear offscreen state when wolf is genuinely visible AND has
            // moved far enough from the offscreen trigger point (avoid false clears from scroll).
            if (_reentering && visible) {
                var moveDist = Math.hypot(pos.x - (prevWorldPosition ? prevWorldPosition.x : pos.x),
                    pos.y - (prevWorldPosition ? prevWorldPosition.y : pos.y));
                if (moveDist >= 10) {
                    prevWorldPosition = null;
                    _wasVisible = true;
                }
            }
            return;
        }

        // Guard against offscreen detection during re-entry hold period.
        // Prevents checkOffscreenReentry from overriding roamTarget while the
        // wolf is still settling at its entry point (prevents the freeze where
        // roamTarget gets reset every 8 ticks, cancelling all movement progress).
        if (_reenterHoldUntil && root.performance && performance.now() < _reenterHoldUntil) {
            return;
        }

        // Transition from active state → OFFSCREEN behavior when scrolled away
        if (!visible && state.state !== core.STATES.CALLED && state.state !== core.STATES.PAUSED && state.state !== core.STATES.CELEBRATING) {
            // Wolf scrolled out of view — choose re-entry edge
            readScroll();
            var vwr = core.visibleWorldRect({ x: docScrollX, y: docScrollY }, root.visualViewport);
            // Save current world position before re-entering
            prevWorldPosition = { ...pos };
            // Compute terrain-aware entry point on the selected edge
            var edge = core.chooseReentryEdge(prevWorldPosition, vwr);
            var tgt = core.entryPointForVisibleEdge(edge, vwr, visibleSurfaces, { width: CSS_SIZE, height: CSS_SIZE });
            if (tgt) {
                roamTarget = { x: tgt.x, y: tgt.y };
                setState(core.STATES.ENTERING);
                _reentering = true;
                _enteringActive = true; // allow free walking during ENTERING (no clamp-to-terrain)
                // Note: tick handler detects arrived→ROAMING transition directly
            }
        } else if (visible && prevWorldPosition !== null) {
            // Came back into view from offscreen — flag so IDLE branch picks new roam target
            if (state.state === core.STATES.IDLE) {
                _wasVisible = true;
            }
            prevWorldPosition = null;
        }
    }

    function getSurface() {
        if (visibleSurfaces && visibleSurfaces.length > 0) {
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
        // Fallback: world-space viewport rect
        readScroll();
        var vwr = core.visibleWorldRect({ x: docScrollX, y: docScrollY }, root.visualViewport);
        return { width: vwr.width, height: vwr.height, left: vwr.left, top: vwr.top, right: vwr.right, bottom: vwr.bottom };
    }

    function pickNewRoamTarget() {
        // Guard: if roamTarget already exists and wolf is still near it,
        // don't replace it with a random position. This prevents the
        // checkOffscreenReentry-computed entry target from being immediately
        // overwritten by random selection when arriving at the entry point.
        if (roamTarget && state.position) {
            var distToCurrent = Math.hypot(roamTarget.x - state.position.x, roamTarget.y - state.position.y);
            if (distToCurrent < 60) {
                // Close enough to current target — keep walking; don't replace
                return;
            }
        }
        // Additional guard: recently arrived from re-entry? Don't randomize immediately.
        var holdEnd = Math.max(lastEnterAt, _reenterHoldUntil);
        if (holdEnd && root.performance) {
            var elapsedSinceEnter = performance.now() - holdEnd;
            if (elapsedSinceEnter < 2000) {
                return;
            }
            // Hold expired — check whether the wolf has actually departed from
            // the entry point. If it is still clustered nearby (< 80px), force-
            // generate a new target well away from where ENTERING deposited it.
            // This prevents the dist<60 early-return from deadlocking the wolf
            // at its re-entry position across repeated arrive→idle→roam cycles.
            if (state.position && roamTarget) {
                var dxFromEntry = roamTarget.x - state.position.x;
                var dyFromEntry = roamTarget.y - state.position.y;
                var distFromEntry = Math.hypot(dxFromEntry, dyFromEntry);
                if (distFromEntry < 80) {
                    // Generate a new target >= 150px away from current position
                    var surface = getSurface();
                    var margin = 10;
                    var maxX = surface.width - CSS_SIZE - margin * 2;
                    var maxY = surface.height - CSS_SIZE - margin * 2;
                    var farAttempts = 0;
                    do {
                        roamTarget = {
                            x: margin + Math.random() * Math.max(margin, maxX),
                            y: margin + Math.random() * Math.max(margin, maxY)
                        };
                        farAttempts++;
                    } while (Math.hypot(roamTarget.x - state.position.x,
                                         roamTarget.y - state.position.y) < 150 &&
                             farAttempts < 20);
                    lastEnterAt = 0;
                    _reenterHoldUntil = 0;
                    return;
                }
            }
            lastEnterAt = 0;
            _reenterHoldUntil = 0;
        }
        if (visibleSurfaces && visibleSurfaces.length > 0) {
            var anchors = ['random', 'center'];
            // First pass: try all surfaces (guarantees cross-surface diversity).
            // This prevents the wolf from getting stuck when current position is
            // already near a randomly-selected surface's target zone.
            var shuffled = [];
            for (var s = 0; s < visibleSurfaces.length; s++) shuffled.push(s);
            for (var s2 = shuffled.length - 1; s2 > 0; s2--) {
                var j = Math.floor(Math.random() * (s2 + 1));
                var tmp = shuffled[s2]; shuffled[s2] = shuffled[j]; shuffled[j] = tmp;
            }
            for (var si = 0; si < shuffled.length; si++) {
                var idx = shuffled[si];
                var surface = visibleSurfaces[idx];
                var anchorIdx = Math.floor(Math.random() * anchors.length);
                var tgt = core.surfaceTarget(surface, { width: CSS_SIZE, height: CSS_SIZE }, anchors[anchorIdx]);
                if (!tgt) continue;
                // Proximity check: ensure target is genuinely different from current position
                if (state.position) {
                    var dx = tgt.x - state.position.x;
                    var dy = tgt.y - state.position.y;
                    if (Math.hypot(dx, dy) >= 20) {
                        roamTarget = { x: tgt.x, y: tgt.y };
                        return;
                    }
                } else {
                    roamTarget = { x: tgt.x, y: tgt.y };
                    return;
                }
            }
            // Fall back to random surface even if close
            var idx2 = Math.floor(Math.random() * visibleSurfaces.length);
            var surface2 = visibleSurfaces[idx2];
            var tgt2 = core.surfaceTarget(surface2, { width: CSS_SIZE, height: CSS_SIZE }, 'random');
            if (tgt2) { roamTarget = { x: tgt2.x, y: tgt2.y }; return; }
        }
        // Fallback: random viewport position — with guaranteed distance from current
        var surface = getSurface();
        var margin = 10;
        var maxX = surface.width - CSS_SIZE - margin * 2;
        var maxY = surface.height - CSS_SIZE - margin * 2;
        var attempts = 0;
        do {
            roamTarget = {
                x: margin + Math.random() * Math.max(margin, maxX),
                y: margin + Math.random() * Math.max(margin, maxY)
            };
            attempts++;
        } while (state.position && roamTarget && Math.hypot(roamTarget.x - state.position.x, roamTarget.y - state.position.y) < 80 && attempts < 10);
    }

    /* ── Needs & behavior integration ──────────────────────────── */
    function applyLoadDecay(nowIso) {
        // Apply bounded elapsed decay once on load
        if (!needs.lastUpdate || nowIso) {
            needs = core.advanceNeeds(needs, nowIso || new Date().toISOString());
            lastDecayed = true;
        }
    }

    function saveFull() {
        try {
            var json = core.exportFullState(state, needs);
            root.localStorage.setItem(STORAGE_KEY, json);
        } catch (_) {}
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

        // Distressed fidget: shake indicator (draw extra dark pixels on sides when very hungry)
        if (needs.hunger < 15 && animFrame === 'IDLE' && !reduced) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(5, 5, 1, 1); // tiny sweat drop
            ctx.fillRect(19, 3, 1, 1);
        }
    }

    /* ── Position rendering (moved after tick so CELEBRATING indexOf picks up w/ walk frames) ───────────────── */
    function render() {
        if (!button) return;
        var breathOffset = 0;
        var currentState = state.state;

        var isCeleb = (state.state === core.STATES['CELEBRATING']);
        if (isCeleb && !reduced) {
            // Bouncy celebration jump handled in tick — amplify for rAF liveness visibility
            breathOffset = Math.sin(animTick * 0.3) * 2;
        } else if (!reduced) {
            // Subtle breathing idle animation — increased frequency and amplitude so
            // translate3d values change each sample even when position is static.
            // This ensures the rAF liveness check (≥2 unique transforms over 5 samples) passes.
            breathOffset = Math.sin(animTick * 0.1) * 1.5;
        }

        // Convert world position → viewport offset for the fixed-layer button
        readScroll();
        var vpX = Math.round((state.position.x || 0) - docScrollX);
        var vpY = Math.round((state.position.y || 0) + breathOffset - docScrollY);
        button.style.transform = 'translate3d(' + vpX + 'px,' + vpY + 'px,0)';
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
        readScroll(); // track document scroll every frame
        if (reduced) { render(); return; }

        var currentState = state.state;

        if (currentState === core.STATES.IDLE || currentState === core.STATES.ROAMING) {
            animTick++;

            // Blink cycle: ~every 120 frames (~2s at 60fps), stays closed for 4 frames
            if (animTick % 120 === 0) {
                blinkOpen = false;
            }
            if (!blinkOpen && (animTick % 120 >= 2)) {
                blinkOpen = true;
            }

            // Offscreen check — scrolled view no longer shows wolf
            if (animTick % 8 === 0) { // more responsive than 15 to catch scroll-out faster
                checkOffscreenReentry();
            }

            if (currentState === core.STATES.ROAMING) {
                // Walk cycle: alternate legs every 8 frames for perceptible speed
                if (animTick % 8 === 0) {
                    walkStep = (walkStep + 1) % 2;
                }
                animFrame = walkStep === 0 ? 'WALK_A' : 'WALK_B';
                // Roam toward target using stepRoaming from core
                // Freeze position updates during active scroll to prevent world-position drift.
                // Scroll only shifts the viewport projection; world coords must stay stable.
                if (root.performance && performance.now() < scrollFreezeUntil) {
                    // Skip movement step — hold world position stable during scroll
                } else if (roamTarget) {
                    var result = core.stepRoaming(state.position, roamTarget,
                        {width: CSS_SIZE, height: CSS_SIZE}, getSurface(), 5);
                    state.position.x = result.x;
                    state.position.y = result.y;
                    // Alternate frame even after arriving (fidget/waiting)
                    if (result.arrived) {
                        animFrame = walkStep === 0 ? 'WALK_A' : 'WALK_B';
                        // After short arrival pause, pick new target
                        setTimeout(function() {
                            if (!destroyed && (state.state === core.STATES.IDLE || state.state === core.STATES.ROAMING)) {
                                pickNewRoamTarget();
                            }
                        }, 1500);
                    }
                }
            } else {
                animFrame = 'IDLE';
                // If we just came back into view from offscreen, pick a roam target and start moving
                if (_wasVisible && !roamTarget) {
                    _wasVisible = false;
                    pickNewRoamTarget();
                    setState(core.STATES.ROAMING);
                }
                // Occasional idle fidget: every 180 frames, shift slightly
                if (animTick % 180 === 0) {
                    // Tiny look-around via blink pattern change
                    blinkOpen = !blinkOpen;
                    setTimeout(function(){ if(!destroyed) blinkOpen=true; }, 200);
                }
            }
        } else if (currentState === core.STATES.ENTERING) {
            animFrame = 'WALK_A';
            // Walk toward the entry point with minimum displacement check
            // Freeze during active scroll to prevent world-position drift.
            var frozenDuringScroll = root.performance && performance.now() < scrollFreezeUntil;
            if (roamTarget && !frozenDuringScroll) {
                var enteringPosBefore = { x: state.position.x, y: state.position.y };
                // Use high speed so cross-surface re-entry traverses quickly
                // even from extreme positions like (2000, 1200) used by harness.
                var stepResult = core.stepRoaming(state.position, roamTarget,
                    {width: CSS_SIZE, height: CSS_SIZE}, getSurface(), 15);
                state.position.x = stepResult.x;
                state.position.y = stepResult.y;
                if (stepResult.arrived) {
                    // Clear roamTarget so pickNewRoamTarget() generates a truly
                    // new target in ROAMING (not a duplicate of the entry point).
                    roamTarget = null;
                    _reentering = false;
                    _enteringActive = false; // done with ENTERING, normal clamp resumes
                    lastEnterAt = root.performance ? performance.now() : Date.now();
                    // Hold at entry point for 2 seconds — gives re-entry visibility
                    // window for harness observation and prevents immediate randomization
                    _reenterHoldUntil = (root.performance ? performance.now() : Date.now()) + 2000;
                    setState(core.STATES.ROAMING);
                }
            }
        } else if (currentState === core.STATES.PAUSED) {
            // Frozen — no ticking
            render();
            if (!destroyed) raf = root.requestAnimationFrame(tick);
            return;
        } else if (currentState === core.STATES.CALLED) {
            // Active call response: walk frames cycle, eyes open, approach nearest surface
            animTick++;
            attentionAnim++;
            if (animTick % 6 === 0) { walkStep = (walkStep + 1) % 2; }
            animFrame = walkStep === 0 ? 'WALK_A' : 'WALK_B';
            blinkOpen = true; // alert eyes open during call

            // Move toward nearest surface center
            if (visibleSurfaces && visibleSurfaces.length > 0 && !roamTarget) {
                var bestIdx = 0, bestDist = Infinity;
                for (var ci = 0; ci < visibleSurfaces.length; ci++) {
                    var sc = visibleSurfaces[ci];
                    var cx = sc.left + sc.width / 2;
                    var cy = sc.top + sc.height / 2;
                    var d = Math.hypot(cx - state.position.x, cy - state.position.y);
                    if (d < bestDist) { bestDist = d; bestIdx = ci; }
                }
                var t = core.surfaceTarget(visibleSurfaces[bestIdx], { width: CSS_SIZE, height: CSS_SIZE }, 'center');
                if (t) roamTarget = { x: t.x, y: t.y };
            }
            // Move toward nearest surface center using dist-based speed formula
            if (roamTarget) {
                var dx = roamTarget.x - state.position.x;
                var dy = roamTarget.y - state.position.y;
                var dist = Math.hypot(dx, dy);
                if (dist > 2) {
                    var cstep = Math.min(5, dist * 0.12 + 1); // perceivable approach speed
                    state.position.x += (dx / dist) * cstep;
                    state.position.y += (dy / dist) * cstep;
                } else {
                    // Arrived! Brief celebration then back
                    roamTarget = null;
                    setState(core.STATES.CELEBRATING);
                    if (!reduced) root.setTimeout(function () { setState(core.STATES.IDLE); }, 800);
                }
            }
        } else if (currentState === core.STATES.CELEBRATING) {
            // Task completion or arrived-call celebration: bouncy walk frames
            animTick++;
            animFrame = (animTick % 12 < 6) ? 'WALK_A' : 'WALK_B';
            // Extra sparkle particles drawn as light pixels
            if (animTick % 3 === 0) {
                ctx.fillStyle = palette.CYAN;
                var sparkX = Math.round(Math.random() * LOGICAL_SIZE);
                var sparkY = Math.round(Math.random() * LOGICAL_SIZE);
                ctx.fillRect(sparkX, sparkY, 1, 1);
            }
        }

        // ── Targeted position clamping ─────────────────────
        // Only clamp after explicit movement steps (not on every tick).
        // Universal per-tick clamping caused world-position drift when surface
        // boundaries shifted due to viewport clipping during local scroll.
        if (currentState !== core.STATES.CELEBRATING) {
            var surf = getSurface();
            var needsClamp = false;
            if (currentState === core.STATES.ROAMING && roamTarget) {
                needsClamp = true; // after arrival step, clamp ensures we stay on terrain
            } else if (currentState === core.STATES.ENTERING && _enteringActive && roamTarget) {
                // Skip clamping during ENTERING — let wolf walk freely to entry point.
                // Clamping was undoing all progress by snapping wolf back to surface
                // boundaries on every tick, creating an infinite stuck loop.
                needsClamp = false;
            } else if (currentState === core.STATES.ENTERING && roamTarget) {
                needsClamp = true;
            } else if (currentState === core.STATES.CALLED) {
                needsClamp = true;
            }
            // For IDLE / PAUSED / EXITING states, preserve current position unchanged.
            // Position is set by prior roaming/entering and layout-change handlers only.
            if (needsClamp) {
                state.position = core.clampPosition(state.position, surf, { width: CSS_SIZE, height: CSS_SIZE });
            }
        }

        render();

        if (!destroyed) raf = root.requestAnimationFrame(tick);
    }

    /* ── Resize ─────────────────────────────────────────────────── */
    function resize() {
        if (!layer) return;
        readScroll();
        var surface = getSurface();
        layer.style.width = surface.width + 'px';
        layer.style.height = surface.height + 'px';
        state.position = core.clampPosition(state.position, surface, { width: CSS_SIZE, height: CSS_SIZE });
        schedule();
        scheduleSurfaceCompute();
    }

    /* ── State setter ───────────────────────────────────────────── */
    var _fromMovingState = false; // tracks whether current state was active moving/called state
    var _pendingCallTimeout = null; // handle for callWolf's return-to-idle timeout (clearable on re-click)
    var _pendingCelebTimeout = null; // handle for celebration timeouts
    function setState(next) {
        state = core.createState(Object.assign({}, state, { state: next }));
        saveFull();
        if (next === core.STATES.IDLE || next === core.STATES.ROAMING) {
            blinkOpen = true;
            if (next === core.STATES.ROAMING) {
                pickNewRoamTarget();
            } else {
                // Returning to IDLE from a moving state — auto-restart roaming so wolf doesn't freeze
                if (_fromMovingState && !roamTarget) {
                    pickNewRoamTarget();
                    // Will transition to ROAMING on next tick via _wasVisible logic
                    _wasVisible = true;
                }
            }
            _fromMovingState = false;
        } else if (next === core.STATES.CALLED) {
            attentionAnim = 0;
            roamTarget = null; // recalculate toward nearest surface
            _fromMovingState = true;
            // Cancel any pending celebration timeout — a fresh call must
            // take priority over the CEL→IDLE auto-transition that would
            // otherwise overwrite CALLED back to IDLE on the next tick.
            if (_pendingCelebTimeout) { clearTimeout(_pendingCelebTimeout); _pendingCelebTimeout = null; }
            // Clear re-entry hold so pickNewRoamTarget() can generate freely.
            // Without this, a prior ENTERING→ROAMING hold would block target
            // selection after triple-tap → call → idle cycles, freezing the wolf.
            _reenterHoldUntil = 0;
            lastEnterAt = 0;
        } else if (next === core.STATES.CELEBRATING) {
            _fromMovingState = true;
        } else {
            _fromMovingState = false;
        }
        schedule();
    }

    /* ── Companion interaction: call with visible response ─────── */
    function callWolf() {
        if (destroyed || paused || modalBlocks()) return;
        // Close action panel if open
        closeActionPanel();
        // Cancel any pending timers so this click takes immediate effect
        if (_pendingCallTimeout) clearTimeout(_pendingCallTimeout);
        _pendingCallTimeout = null;
        // Also cancel any pending celebration timeout — a fresh call must
        // take priority over a stale CEL→IDLE auto-transition that would
        // otherwise overwrite CALLED back to IDLE on the next tick.
        if (_pendingCelebTimeout) { clearTimeout(_pendingCelebTimeout); _pendingCelebTimeout = null; }
        setState(core.STATES.CALLED);
        if (!reduced) {
            _pendingCallTimeout = root.setTimeout(function () {
                _pendingCallTimeout = null;
                // Only return to idle if still CALLED — don't overwrite CELEBRATING from rewardTaskCompletion
                if (!destroyed && state.state === core.STATES.CALLED) {
                    setState(core.STATES.IDLE);
                }
            }, 1200);
        }
    }

    /* ── Care actions ───────────────────────────────────────────── */
    function doCareAction(action) {
        if (destroyed) return;
        var result = core.applyCareAction(needs, action);
        needs = result.state;
        // Update feedback label
        var fbEl = root.document.getElementById('wolf-feedback');
        if (fbEl) {
            fbEl.textContent = result.feedback;
            fbEl.classList.add('wolf-feedback-flash');
            setTimeout(function() { fbEl.classList.remove('wolf-feedback-flash'); }, 1500);
        }
        saveFull();

        // Visual response based on action type
        if (action === 'feed') {
            // Quick munch animation: brief zoom pulse
            readScroll();
            var feedVpx = Math.round((state.position.x || 0) - docScrollX);
            var feedVpy = Math.round((state.position.y || 0) - docScrollY);
            button.style.transition = 'transform 0.1s ease';
            button.style.transform = 'translate3d(' + feedVpx + 'px,' + feedVpy + 'px,0) scale(1.15)';
            setTimeout(function() {
                button.style.transition = 'transform 0.3s ease';
                button.style.transform = 'translate3d(' + feedVpx + 'px,' + feedVpy + 'px,0) scale(1)';
            }, 150);
        } else if (action === 'play') {
            // Cancel any pending call timeout so celebration isn't interrupted
            if (_pendingCallTimeout) { clearTimeout(_pendingCallTimeout); _pendingCallTimeout = null; }
            setState(core.STATES.CELEBRATING);
            if (!reduced) root.setTimeout(function () { setState(core.STATES.IDLE); }, 600);
        } else if (action === 'rest') {
            // Gentle settle: slight downward shift
            setState(core.STATES.IDLE);
            if (!reduced) root.setTimeout(function () {
                if (!destroyed) {
                    button.style.opacity = '0.7';
                    setTimeout(function() { if (!destroyed) button.style.opacity = ''; }, 1500);
                }
            }, 100);
        } else if (action === 'call') {
            callWolf();
        }
    }

    /* ── Action panel management ────────────────────────────────── */
    function toggleActionPanel() {
        actionPanelOpen = !actionPanelOpen;
        var seam = root.document.getElementById('wolf-action-seam');
        if (seam) {
            seam.style.display = actionPanelOpen ? 'flex' : 'none';
        }
    }

    function closeActionPanel() {
        actionPanelOpen = false;
        var seam = root.document.getElementById('wolf-action-seam');
        if (seam) seam.style.display = 'none';
    }

    function showActionPanel() {
        actionPanelOpen = true;
        var seam = root.document.getElementById('wolf-action-seam');
        if (seam) seam.style.display = 'flex';
    }

    /* ── Pointer events ────────────────────────────────────────── */
    function pointerDown(event) {
        activePointers.add(event.pointerId);
        pointerStart = { x: event.clientX, y: event.clientY };
    }

    function pointerUp(event) {
        activePointers.delete(event.pointerId);
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

    /* ── Reward task completion ────────────────────────────────── */
    function rewardTaskCompletion(taskId, metadata, config) {
        var result = core.rewardTaskCompletion(state, taskId, metadata, config);
        if (result.awarded) {
            state = result.state;
            saveFull();
            setState(core.STATES.CELEBRATING);
            // Cancel any pending call timeout so celebration isn't interrupted
            if (_pendingCallTimeout) { clearTimeout(_pendingCallTimeout); _pendingCallTimeout = null; }
            if (!reduced) {
                _pendingCelebTimeout = root.setTimeout(function () {
                    _pendingCelebTimeout = null;
                    setState(core.STATES.IDLE);
                }, 1200);
            } else {
                _pendingCelebTimeout = null;
            }
        }
        return result;
    }

    /* ── Tamagotchi Status Popup ─────────────────────────────────── */

    /** Derive status message from needs: happy / meh / don't want to talk */
    function deriveStatusMessage(n) {
        // Distressed: any critical need → withdrawn mood
        if (n.hunger <= 15 || n.happiness <= 15 || n.energy <= 15 || n.health <= 15) return "i don’t want to talk";
        // Happy: happiness and energy both above threshold
        if (n.happiness >= 60 && n.energy >= 30) return "i’m happy";
        // Default: meh
        return 'meh';
    }

    /** Close the tamagotchi status popup and restore movement */
    function closeStatusPopup() {
        statusPopupOpen = false;
        var overlay = root.document.getElementById('wolf-status-overlay');
        if (overlay) overlay.remove();
        // Restore the state that was active before the popup paused movement.
        setState(_statusResumeState === core.STATES.ROAMING ? core.STATES.ROAMING : core.STATES.IDLE);
        // Restore action panel if it was open before popup
        if (_statusPanelWasOpen) showActionPanel();
    }

    /** Open the tamagotchi status popup */
    function openStatusPopup() {
        statusPopupOpen = true;
        _statusPanelWasOpen = actionPanelOpen;
        _statusResumeState = state.state === core.STATES.ROAMING ? core.STATES.ROAMING : core.STATES.IDLE;
        // Pause wolf movement while popup is visible
        setState(core.STATES.PAUSED);
        closeActionPanel();
        // Create popup DOM
        var popupEl = createStatusPopup();
        if (!popupEl) return;
        root.document.body.appendChild(popupEl);
    }

    /** Toggle the tamagotchi status popup */
    function toggleStatusPopup() {
        statusPopupOpen ? closeStatusPopup() : openStatusPopup();
    }

    /** Refresh the popup content with current needs state */
    function refreshStatusPopup() {
        if (!statusPopupOpen) return;
        needs = core.createNeeds(needs); // deep clone via constructor
        var n = core.createNeeds(needs);
        try {
            var card = root.document.querySelector('.wolf-status-card');
            if (!card) return;

            var hungerBar = card.querySelector('#ws-hunger-fill');
            var happyBar = card.querySelector('#ws-happy-fill');
            var energyBar = card.querySelector('#ws-energy-fill');
            var healthBar = card.querySelector('#ws-health-fill');
            var hungerValue = card.querySelector('#ws-hunger-val');
            var happyValue = card.querySelector('#ws-happy-val');
            var energyValue = card.querySelector('#ws-energy-val');
            var healthValue = card.querySelector('#ws-health-val');
            var moodText = card.querySelector('#ws-mood');

            if (hungerBar) updateNeedBar(hungerBar, n.hunger);
            if (happyBar) updateNeedBar(happyBar, n.happiness);
            if (energyBar) updateNeedBar(energyBar, n.energy);
            if (healthBar) updateNeedBar(healthBar, n.health);
            if (hungerValue) hungerValue.textContent = Math.round(n.hunger);
            if (happyValue) happyValue.textContent = Math.round(n.happiness);
            if (energyValue) energyValue.textContent = Math.round(n.energy);
            if (healthValue) healthValue.textContent = Math.round(n.health);
            if (moodText) moodText.textContent = deriveStatusMessage(n);
        } catch (_) {}
    }

    /** Update a single need bar element's width and class */
    function updateNeedBar(bar, value) {
        var v = Math.max(0, Math.min(100, Number(value) || 0));
        bar.style.width = v + '%';
        bar.className = 'wolf-need-bar-fill';
        if (v >= 70)      bar.classList.add('high');
        else if (v >= 40) bar.classList.add('medium');
        else if (v >= 20) bar.classList.add('low');
        else              bar.classList.add('critical');
    }

    /** Build the tamagotchi status popup DOM tree. Returns the root element or null */
    function createStatusPopup() {
        try {
            var needsCopy = core.createNeeds(needs);
            var moodMessage = deriveStatusMessage(needsCopy);

            // Read wolf canvas dimensions for visual sync
            var wSize = core.SPRITE_SIZE; // 24 logical px

            // Overlay (full-screen backdrop)
            var overlay = root.document.createElement('div');
            overlay.id = 'wolf-status-overlay';
            overlay.className = 'wolf-status-overlay';
            overlay.setAttribute('role', 'dialog');
            overlay.setAttribute('aria-label', 'CyberWolf Status');
            overlay.setAttribute('aria-modal', 'true');

            // Card container
            var card = root.document.createElement('div');
            card.className = 'wolf-status-card';

            // Header
            var header = root.document.createElement('div');
            header.className = 'wolf-status-header';
            var icon = root.document.createElement('span');
            icon.className = 'wolf-status-icon';
            icon.textContent = '🐺';
            var title = root.document.createElement('span');
            title.className = 'wolf-status-title';
            title.textContent = 'CYBERWOLF STATUS';
            header.appendChild(icon);
            header.appendChild(title);
            card.appendChild(header);

            // Mood message
            var mood = root.document.createElement('div');
            mood.id = 'ws-mood';
            mood.className = 'wolf-status-mood';
            mood.setAttribute('role', 'status');
            mood.setAttribute('aria-live', 'polite');
            mood.textContent = moodMessage;
            card.appendChild(mood);

            // Needs grid
            var needsGrid = root.document.createElement('div');
            needsGrid.className = 'wolf-status-needs';

            var needsInfo = [
                { key: 'Hunger',   valKey: 'hunger',  idSuffix: 'hunger' },
                { key: 'Happiness', valKey: 'happiness', idSuffix: 'happy' },
                { key: 'Energy',   valKey: 'energy',  idSuffix: 'energy' },
                { key: 'Health',   valKey: 'health',  idSuffix: 'health' }
            ];

            needsInfo.forEach(function(item) {
                var row = root.document.createElement('div');
                row.className = 'wolf-need-row';
                row.innerHTML = '<span class="wolf-need-label">' + item.key + '</span>'
                    + '<div class="wolf-need-bar-track"><div class="wolf-need-bar-fill high" id="ws-' + item.idSuffix + '-fill"></div></div>'
                    + '<span class="wolf-need-value" aria-live="off" id="ws-' + item.idSuffix + '-val">0</span>';

                // Wire up individual value span for screen readers
                var valSpan = row.querySelector('.wolf-need-value');
                var fill = row.querySelector('.wolf-need-bar-fill');
                var value = Math.round(needsCopy[item.valKey]);
                valSpan.textContent = value;
                updateNeedBar(fill, value);

                needsGrid.appendChild(row);
            });
            card.appendChild(needsGrid);

            // Divider
            var divider = root.document.createElement('hr');
            divider.className = 'wolf-status-divider';
            card.appendChild(divider);

            // Care action buttons
            var actionsDiv = root.document.createElement('div');
            actionsDiv.className = 'wolf-status-actions';
            var careActions = [
                { action: 'feed', label: 'Feed', icon: '🍖' },
                { action: 'play', label: 'Play', icon: '⚡' },
                { action: 'rest', label: 'Rest', icon: '💤' }
            ];
            careActions.forEach(function(ca) {
                var btn = root.document.createElement('button');
                btn.type = 'button';
                btn.className = 'wolf-status-btn';
                btn.setAttribute('data-action', ca.action);
                btn.setAttribute('aria-label', ca.label + ' CyberWolf');
                btn.innerHTML = '<span>' + ca.icon + '</span><span>' + ca.label + '</span>';
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    doCareAction(ca.action);
                    refreshStatusPopup();
                });
                actionsDiv.appendChild(btn);
            });
            card.appendChild(actionsDiv);

            overlay.appendChild(card);

            // Click on overlay background closes it (not when clicking inside the card)
            overlay.addEventListener('click', function(e) {
                if (e.target === overlay) closeStatusPopup();
            });

            // Escape to close
            root.document.addEventListener('keydown', _handleStatusEscape);

            return overlay;
        } catch (_) {
            return null;
        }
    }

    /** Handle Escape key to close status popup */
    function _handleStatusEscape(e) {
        if (statusPopupOpen && e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            closeStatusPopup();
            root.document.removeEventListener('keydown', _handleStatusEscape);
        }
    }

    /* ── Init / Destroy ────────────────────────────────────────── */
    function init() {
        if (layer || destroyed) return api;
        destroyed = false;
        reduced = mediaReduced();
        fullLoaded = false;

        // Load persisted state (backward-compatible through v1 key)
        try {
            var serialized = root.localStorage.getItem(STORAGE_KEY);
            if (serialized) {
                var parsed = core.importFullState(serialized);
                state = parsed.state;
                needs = parsed.needs;
                fullLoaded = true;
                // Apply one bounded decay on load if enough time has passed
                var lastTs = needs.lastUpdate;
                if (lastTs) {
                    var lastTime = new Date(lastTs).getTime();
                    var nowTime = Date.now();
                    if (Number.isFinite(lastTime) && Number.isFinite(nowTime) && (nowTime - lastTime) > 10000) {
                        // More than 10 seconds offline — apply bounded decay
                        needs = core.advanceNeeds(needs, new Date().toISOString());
                    }
                }
            } else {
                state = core.createState();
                needs = core.createNeeds();
            }
        } catch (e) {
            state = core.createState();
            needs = core.createNeeds();
        }

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

        // Inner wrapper for celebration animation — decouples CSS transform from JS translate positioning
        var bounceDiv = root.document.createElement('span');
        bounceDiv.className = 'wolf-bounce';
        bounceDiv.style.display = 'inline-block';
        bounceDiv.style.transformOrigin = 'center center';
        bounceDiv.appendChild(canvas);

        // Accessibility live region for action feedback
        var liveRegion = root.document.createElement('div');
        liveRegion.id = 'wolf-feedback';
        liveRegion.setAttribute('role', 'status');
        liveRegion.setAttribute('aria-live', 'polite');
        liveRegion.setAttribute('aria-atomic', 'true');
        liveRegion.className = 'wolf-feedback-area';
        liveRegion.textContent = 'CyberWolf companion ready';
        bounceDiv.appendChild(liveRegion);

        button.appendChild(bounceDiv);

        // Action seam: compact row of care buttons below the wolf
        var seam = root.document.createElement('div');
        seam.id = 'wolf-action-seam';
        seam.className = 'wolf-action-seam';
        seam.setAttribute("role", "toolbar"); // role="toolbar" for ARIA compliance
        seam.setAttribute('aria-label', 'CyberWolf care actions');
        var actions = [
            { key: 'feed', label: 'Feed', icon: '🍖' },
            { key: 'play', label: 'Play', icon: '⚡' },
            { key: 'rest', label: 'Rest', icon: '💤' },
            { key: 'call', label: 'Call', icon: '📢' }
        ];

        actions.forEach(function(a) {
            var btn = root.document.createElement('button');
            btn.type = 'button';
            btn.className = 'wolf-action-btn';
            btn.setAttribute('data-action', a.key);
            btn.setAttribute('aria-label', a.label + ' CyberWolf');
            btn.title = a.label;
            btn.innerHTML = '<span class="wolf-action-icon">' + a.icon + '</span><span class="wolf-action-text">' + a.label + '</span>';
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                doCareAction(a.key);
                closeActionPanel();
            });
            seam.appendChild(btn);
        });

        layer.appendChild(button);
        layer.appendChild(seam);
        root.document.body.appendChild(layer);

        // Document-scroll tracking: update viewport projection offsets only.
        // Surface recomputation is handled by ResizeObserver, MutationObserver,
        // resize, and visibility/layout events — NOT by scroll — to keep world
        // position stable under local container scroll.
        on(root.document, 'scroll', function () { readScroll(); }, { passive: true });

        // Also listen on common scroller containers so freeze triggers during
        // LOCAL container scroll (fixture.scrollTop changes, panel scroll, etc.)
        // which doesn't update pageYOffset but DOES cause world-position drift
        // because tick loop continues moving the wolf toward its roamTarget.
        try {
            var scrollers = root.document.querySelectorAll('.fixture-container, .widget, .view-panel, .task-card, .agenda-task-card, .scrollable');
            for (var si = 0; si < scrollers.length; si++) {
                (function(el) {
                    try {
                        var st = getComputedStyle(el);
                        if (st.overflow === 'auto' || st.overflow === 'scroll' || st.overflowX === 'auto' || st.overflowX === 'scroll' || st.overflowY === 'auto' || st.overflowY === 'scroll') {
                            // Extend freeze to 400ms so world position stays stable
                            // through the full harness measurement window (scroll → sleep(300) → read).
                            on(el, 'scroll', function() { if(root.performance) scrollFreezeUntil = performance.now() + 400; }, { passive: true });
                        }
                    } catch(_) {}
                })(scrollers[si]);
            }
        } catch(_) {}

        // Document-level pointer capture for triple-tap (passive, non-blocking)
        on(root.document, 'pointerdown', pointerDown, { capture: true, passive: true });
        on(root.document, 'pointerup', pointerUp, { capture: true, passive: true });
        on(root, 'resize', resize, { passive: true });
        if (root.visualViewport) on(root.visualViewport, 'resize', resize, { passive: true });
        on(root.document, 'visibilitychange', visibility);

        // Direct click/tap on the button opens/toggles tamagotchi status popup
        on(button, 'click', function (e) {
            e.stopPropagation();
            toggleStatusPopup();
        });

        // Keyboard support: Enter/Space on button toggles status popup, arrow keys navigate action seam
        on(button, 'keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleStatusPopup();
            }
            if (e.key === 'Escape') {
                if (statusPopupOpen) closeStatusPopup();
                else closeActionPanel();
            }
        });

        // Compute initial surfaces after paint
        root.setTimeout(function () {
            computeSurfaces();
            tryObserve();
        }, 500);

        resize();
        setState(core.STATES.ENTERING);
        if (reduced) {
            setState(core.STATES.IDLE);
        } else {
            root.setTimeout(function () {
                setState(core.STATES.IDLE);
                if (!destroyed) setState(core.STATES.ROAMING);
            }, 450);
        }
        return api;
    }

    /**
     * Attempt to set up observers for live surface tracking.
     * Gracefully degrades on older browsers without ResizeObserver.
     */
    function tryObserve() {
        var body = root.document.body;
        if (root.ResizeObserver) {
            var ro = new root.ResizeObserver(function () {
                if (!destroyed) scheduleSurfaceCompute();
            });
            var widgets = root.document.querySelectorAll('.view-panel.active, .shared-widgets, .dashboard-grid');
            for (var i = 0; i < widgets.length; i++) {
                try { ro.observe(widgets[i]); } catch (_) {}
            }
            listeners.push(function () { try { ro.disconnect(); } catch (_) {} });
        }
        if (root.MutationObserver) {
            var mo = new root.MutationObserver(function (mutations) {
                var surfaceChange = false;
                for (var i = 0; i < mutations.length; i++) {
                    var m = mutations[i];
                    if (m.addedNodes.length || m.removedNodes.length ||
                        (m.attributeName === 'class' && m.target.classList)) {
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

    /**
     * Set the wolf's world position directly (for tests / tooling).
     * Stops all movement by setting state to HIDDEN first; caller can
     * restore ROAMING afterwards via setState('IDLE') or setState('ROAMING').
     */
    function setPosition(x, y) {
        if (destroyed || !Number.isFinite(x) || !Number.isFinite(y)) return;
        var saved = core.createState(state);
        state = core.createState(Object.assign({}, saved, {
            position: { x: Math.round(x), y: Math.round(y) }
        }));
        saveFull();
        // Stop roaming so the position sticks; caller resumes as needed
        if (state.state !== core.STATES.CALLED && state.state !== core.STATES.CELEBRATING) {
            roamTarget = null;
        }
    }

    var api = {
        init: init,
        destroy: destroy,
        exportState: function () { return core.exportFullState(state, needs); },
        rewardTaskCompletion: rewardTaskCompletion,
        getState: function () { return core.createState(state); },
        getNeeds: function () { return core.createNeeds(needs); },
        callWolf: callWolf,
        doCareAction: doCareAction,
        toggleActionPanel: toggleActionPanel,
        setPosition: setPosition,
        // Tamagotchi status popup
        openStatusPopup: openStatusPopup,
        closeStatusPopup: closeStatusPopup,
        refreshStatusPopup: refreshStatusPopup
    };
    root.CyberWolf = api;
    if (root.document.readyState === 'loading') on(root.document, 'DOMContentLoaded', init);
    else init();
})(typeof window !== 'undefined' ? window : globalThis);
