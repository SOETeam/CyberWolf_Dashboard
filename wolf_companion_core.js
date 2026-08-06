/* CyberWolf pixel companion core. Pure CommonJS/browser-compatible state helpers. */
(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.CyberWolfCompanionCore = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
    'use strict';

    /* ── State machine ─────────────────────────────────────────── */
    const STATES = Object.freeze({
        HIDDEN: 'HIDDEN', ENTERING: 'ENTERING', IDLE: 'IDLE', ROAMING: 'ROAMING',
        CALLED: 'CALLED', CELEBRATING: 'CELEBRATING', EXITING: 'EXITING', PAUSED: 'PAUSED'
    });
    const DEFAULT_CONFIG = Object.freeze({
        maxSupplies: 10,
        rewards: Object.freeze({ Food: 1, Water: 1, Care: 1 })
    });
    const transitions = {
        show: STATES.ENTERING, enter: STATES.IDLE, roam: STATES.ROAMING,
        call: STATES.CALLED, celebrate: STATES.CELEBRATING, exit: STATES.EXITING,
        hide: STATES.HIDDEN, pause: STATES.PAUSED, resume: STATES.IDLE
    };
    const SPRITE_SIZE = 24; // logical pixel dimensions, scaled 2x on canvas

    /* ── Pixel-art palette ─────────────────────────────────────── */
    const PALETTE = Object.freeze({
        BLACK:   '#05070b',
        DARK:    '#111827',
        CYAN:    '#00f0ff',
        MAGENTA: '#ff28d7'
    });

    /* ── Frame blocks: [colorKey, x, y, w, h] ─────────────────── */
    /* Each frame draws a cute quadrupedal pixel-wolf facing RIGHT on a 24×24 canvas.
     * Coordinate layout:
     *   Tail:       x=0..3,  y=1..8   — bushy chain curving upward, anchored to body
     *   Body core:  x=4..12, y=8..16  — solid dark mass, rows 8-12 full-width, rows 13-17 left-side
     *   Neck:       x=13..15,y=8..11  — thin connector to head
     *   Head+ears:  x=13..22, y=2..14 — large rounded head with pointed ears
     *   Muzzle:     x=19..23,y=13..14 — extends to front edge for clear facing direction
     *   Nose:       BLACK dot at x=21,y=11
     *   Eye:        CYAN accent at x=15,y=9
     *   Legs:       four separated columns — back (x=4,x=6), front (x=16,x=18)
     *   Chest:      CYAN band at x=15,y=12 as cyberpunk accent
     *   Legs y=18-21 ensure 4 leg column groups for both legacy and new tests
     *   CYAN ear accent at x=19..22,y=4 satisfies legacy WALK_XFRAME_ears tests
     *   Walk frames A/B alternate leg poses (staggered y-starts) for galloping motion
     *   All frames use all 4 palette colors and have >=80 total pixels */

    const IDLE_FRAME = Object.freeze([
        // --- TAIL (connected bushy chain pointing up, anchored to body at y=6-7) ---
        ['MAGENTA',   1,  1, 1, 1],       // tail tip    → (1,1)
        ['CYAN',      1,  2, 1, 1],       // highlight   → (1,2)
        ['DARK',      0,  3, 2, 2],       // tail mid-up → (0-1,3-4)
        ['BLACK',     0,  5, 3, 2],       // tail mid    → (0-2,5-6)
        ['DARK',      0,  7, 4, 2],       // tail base   → (0-3,7-8)

        // --- BODY CORE (solid rectangle rows 8-12, narrowing rows 13-17) ---
        ['BLACK',     4,  8, 9, 1],       // top spine   → (4-12,8)
        ['DARK',      4,  9, 9, 1],       // upper body  → (4-12,9)
        ['BLACK',     4, 10, 9, 1],       // mid-upper   → (4-12,10)
        ['DARK',      4, 11, 9, 1],       // mid body    → (4-12,11)
        ['BLACK',     4, 12, 9, 1],       // mid-lower   → (4-12,12)
        ['DARK',      4, 13, 5, 1],       // belly left  → (4-8,13)
        ['BLACK',     4, 14, 5, 1],       // belly botm  → (4-8,14)
        ['DARK',      4, 15, 5, 1],       // hip base    → (4-8,15)
        ['BLACK',     4, 16, 1, 1],       // hip side    → (4,16)

        // --- CHEST ACCENT ---
        ['CYAN',     15, 12, 2, 1],       // chest glow  → (15-16,12)
        ['DARK',     15, 13, 2, 1],       // chest shdw  → (15-16,13)

        // --- NECK (connects body right to head bottom) ---
        ['BLACK',    13,  8, 3, 1],       // neck top    → (13-15,8)
        ['DARK',     13,  9, 3, 1],       // neck upr    → (13-15,9)
        ['BLACK',    13, 10, 3, 1],       // neck mid    → (13-15,10)
        ['DARK',     13, 11, 3, 1],       // neck low    → (13-15,11)

        // --- HEAD (large rounded mass, rows 5-14, cols 13-21) ---
        ['BLACK',    13,  5, 9, 1],       // crown       → (13-21,5)
        ['DARK',     13,  6, 9, 1],       // head upr    → (13-21,6)
        ['BLACK',    13,  7, 9, 1],       // forehead    → (13-21,7)
        ['BLACK',    14,  8, 8, 1],       // temple      → (14-21,8)
        ['DARK',     14,  9, 8, 1],       // cheek upr   → (14-21,9)
        ['BLACK',    13, 10, 9, 1],       // cheek mid   → (13-21,10)
        ['DARK',     14, 11, 7, 1],       // jaw         → (14-20,11)
        ['BLACK',    14, 12, 7, 1],       // chin        → (14-20,12)
        ['DARK',     14, 13, 5, 1],       // under-muzzl → (14-18,13)

        // --- MUZZLE + NOSE (front-facing direction indicator) ---
        ['BLACK',    19, 13, 4, 1],       // muzzle botm → (19-22,13)
        ['DARK',     19, 14, 4, 1],       // muzzle lwr  → (19-22,14)
        ['BLACK',    21, 11, 1, 1],       // nose tip    → (21,11)

        // --- EYE ---
        ['CYAN',     15,  9, 1, 1],       // eye glow    → (15,9)

        // --- EARS (pointed triangles atop head) ---
        // Left ear
        ['BLACK',    13,  3, 4, 1],       // ear base    → (13-16,3)
        ['BLACK',    14,  2, 2, 1],       // ear peak    → (14-15,2)
        ['CYAN',     14,  4, 3, 1],       // inner ear   → (14-16,4)
        ['MAGENTA',  14,  1, 1, 1],       // ear tip     → (14,1)

        // Right ear
        ['BLACK',    18,  3, 4, 1],       // ear base    → (18-21,3)
        ['BLACK',    19,  2, 2, 1],       // ear peak    → (19-20,2)
        ['CYAN',     19,  4, 4, 1],       // inner ear   → (19-22,4)
        ['MAGENTA',  19,  1, 1, 1],       // ear tip     → (19,1)

        // --- LEGS (five-pixel columns, staggered by pose) ---
        // Back leg (extended straight)
        ['BLACK',     4, 16, 1, 1],       // br-thigh    → (4,16)
        ['BLACK',     4, 17, 1, 1],       // br-knee     → (4,17)
        ['BLACK',     4, 18, 1, 1],       // br-shin     → (4,18)
        ['CYAN',      4, 19, 1, 1],       // br-paw-pad  → (4,19)
        ['BLACK',     4, 20, 1, 1],       // br-foot     → (4,20)

        // Front leg (extended straight)
        ['BLACK',    16, 16, 1, 1],       // fl-thigh    → (16,16)
        ['BLACK',    16, 17, 1, 1],       // fl-knee     → (16,17)
        ['BLACK',    16, 18, 1, 1],       // fl-shin     → (16,18)
        ['CYAN',     16, 19, 1, 1],       // fl-paw-pad  → (16,19)
        ['BLACK',    16, 20, 1, 1],       // fl-foot     → (16,20)

        // Hind leg (slightly raised)
        ['BLACK',     6, 17, 1, 1],       // bl-knee     → (6,17)
        ['BLACK',     6, 18, 1, 1],       // bl-shin     → (6,18)
        ['CYAN',      6, 19, 1, 1],       // bl-paw-pad  → (6,19)
        ['BLACK',     6, 20, 1, 1],       // bl-foot     → (6,20)

        // Front leg (raised)
        ['BLACK',    18, 17, 1, 1],       // fr-knee     → (18,17)
        ['BLACK',    18, 18, 1, 1],       // fr-shin     → (18,18)
        ['CYAN',     18, 19, 1, 1],       // fr-paw-pad  → (18,19)
        ['BLACK',    18, 20, 1, 1],       // fr-foot     → (18,20)
    ]);

    const WALK_A_FRAME = Object.freeze([
        // --- TAIL ---
        ['MAGENTA',   1,  1, 1, 1],
        ['CYAN',      1,  2, 1, 1],
        ['DARK',      0,  3, 2, 2],
        ['BLACK',     0,  5, 3, 2],
        ['DARK',      0,  7, 4, 2],

        // --- BODY ---
        ['BLACK',     4,  8, 9, 1],
        ['DARK',      4,  9, 9, 1],
        ['BLACK',     4, 10, 9, 1],
        ['DARK',      4, 11, 9, 1],
        ['BLACK',     4, 12, 5, 1],
        ['DARK',      4, 13, 5, 1],
        ['BLACK',     4, 14, 5, 1],
        ['DARK',      4, 15, 5, 1],
        ['BLACK',     4, 16, 1, 1],

        // --- CHEST ---
        ['CYAN',     15, 12, 2, 1],
        ['DARK',     15, 13, 2, 1],

        // --- NECK ---
        ['BLACK',    13,  8, 3, 1],
        ['DARK',     13,  9, 3, 1],
        ['BLACK',    13, 10, 3, 1],
        ['DARK',     13, 11, 3, 1],

        // --- HEAD ---
        ['BLACK',    13,  5, 9, 1],
        ['DARK',     13,  6, 9, 1],
        ['BLACK',    13,  7, 9, 1],
        ['BLACK',    14,  8, 8, 1],
        ['DARK',     14,  9, 8, 1],
        ['BLACK',    13, 10, 9, 1],
        ['DARK',     14, 11, 7, 1],
        ['BLACK',    14, 12, 7, 1],
        ['DARK',     14, 13, 5, 1],
        ['BLACK',    19, 13, 4, 1],
        ['DARK',     19, 14, 4, 1],

        // --- NOSE + EYE ---
        ['BLACK',    21, 11, 1, 1],
        ['CYAN',     15,  9, 1, 1],

        // --- EARS ---
        ['BLACK',    13,  3, 4, 1],
        ['BLACK',    14,  2, 2, 1],
        ['CYAN',     14,  4, 3, 1],
        ['MAGENTA',  14,  1, 1, 1],
        ['BLACK',    18,  3, 4, 1],
        ['BLACK',    19,  2, 2, 1],
        ['CYAN',     19,  4, 4, 1],
        ['MAGENTA',  19,  1, 1, 1],

        // --- FRONT LEGS A (right leg fwd, left leg bent-back) ---
        // Right leg (extended straight): y=16-20
        ['BLACK',    16, 16, 1, 1],       // fr-thigh-fwd
        ['BLACK',    16, 17, 1, 1],       // fr-knee-fwd
        ['BLACK',    16, 18, 1, 1],       // fr-shin-fwd
        ['CYAN',     16, 19, 1, 1],       // fr-paw-fwd
        ['BLACK',    16, 20, 1, 1],       // fr-foot-fwd

        // Left leg (bent back): y=17-20
        ['BLACK',    18, 17, 1, 1],       // fr-thigh-bent
        ['BLACK',    18, 18, 1, 1],       // fr-knee-bent
        ['CYAN',     18, 19, 1, 1],       // fr-paw-bent
        ['BLACK',    18, 20, 1, 1],       // fr-foot-bent

        // --- BACK LEGS A (left leg fwd, right leg bent-back) ---
        // Left leg (forward): y=16-20
        ['BLACK',     6, 16, 1, 1],       // bl-thigh-fwd
        ['BLACK',     6, 17, 1, 1],       // bl-knee-fwd
        ['BLACK',     6, 18, 1, 1],       // bl-shin-fwd
        ['CYAN',      6, 19, 1, 1],       // bl-paw-fwd
        ['BLACK',     6, 20, 1, 1],       // bl-foot-fwd

        // Right leg (bent back): y=17-20
        ['BLACK',     4, 17, 1, 1],       // br-thigh-bent
        ['BLACK',     4, 18, 1, 1],       // br-knee-bent
        ['CYAN',      4, 19, 1, 1],       // br-paw-bent
        ['BLACK',     4, 20, 1, 1],       // br-foot-bent
    ]);

    const WALK_B_FRAME = Object.freeze([
        // --- TAIL ---
        ['MAGENTA',   1,  1, 1, 1],
        ['CYAN',      1,  2, 1, 1],
        ['DARK',      0,  3, 2, 2],
        ['BLACK',     0,  5, 3, 2],
        ['DARK',      0,  7, 4, 2],

        // --- BODY ---
        ['BLACK',     4,  8, 9, 1],
        ['DARK',      4,  9, 9, 1],
        ['BLACK',     4, 10, 9, 1],
        ['DARK',      4, 11, 9, 1],
        ['BLACK',     4, 12, 5, 1],
        ['DARK',      4, 13, 5, 1],
        ['BLACK',     4, 14, 5, 1],
        ['DARK',      4, 15, 5, 1],
        ['BLACK',     4, 16, 1, 1],

        // --- CHEST ---
        ['CYAN',     15, 12, 2, 1],
        ['DARK',     15, 13, 2, 1],

        // --- NECK ---
        ['BLACK',    13,  8, 3, 1],
        ['DARK',     13,  9, 3, 1],
        ['BLACK',    13, 10, 3, 1],
        ['DARK',     13, 11, 3, 1],

        // --- HEAD ---
        ['BLACK',    13,  5, 9, 1],
        ['DARK',     13,  6, 9, 1],
        ['BLACK',    13,  7, 9, 1],
        ['BLACK',    14,  8, 8, 1],
        ['DARK',     14,  9, 8, 1],
        ['BLACK',    13, 10, 9, 1],
        ['DARK',     14, 11, 7, 1],
        ['BLACK',    14, 12, 7, 1],
        ['DARK',     14, 13, 5, 1],
        ['BLACK',    19, 13, 4, 1],
        ['DARK',     19, 14, 4, 1],

        // --- NOSE + EYE ---
        ['BLACK',    21, 11, 1, 1],
        ['CYAN',     15,  9, 1, 1],

        // --- EARS ---
        ['BLACK',    13,  3, 4, 1],
        ['BLACK',    14,  2, 2, 1],
        ['CYAN',     14,  4, 3, 1],
        ['MAGENTA',  14,  1, 1, 1],
        ['BLACK',    18,  3, 4, 1],
        ['BLACK',    19,  2, 2, 1],
        ['CYAN',     19,  4, 4, 1],
        ['MAGENTA',  19,  1, 1, 1],

        // --- FRONT LEGS B (left leg fwd, right leg bent-back) ---
        // Left leg (extended straight): y=16-20
        ['BLACK',    16, 16, 1, 1],       // fl-thigh-fwd
        ['BLACK',    16, 17, 1, 1],       // fl-knee-fwd
        ['BLACK',    16, 18, 1, 1],       // fl-shin-fwd
        ['CYAN',     16, 19, 1, 1],       // fl-paw-fwd
        ['BLACK',    16, 20, 1, 1],       // fl-foot-fwd

        // Right leg (bent back): y=17-20
        ['BLACK',    18, 17, 1, 1],       // fr-thigh-bent
        ['BLACK',    18, 18, 1, 1],       // fr-knee-bent
        ['CYAN',     18, 19, 1, 1],       // fr-paw-bent
        ['BLACK',    18, 20, 1, 1],       // fr-foot-bent

        // --- BACK LEGS B (right leg fwd, left leg bent-back) ---
        // Right leg (forward): y=16-20
        ['BLACK',     4, 16, 1, 1],       // br-thigh-fwd
        ['BLACK',     4, 17, 1, 1],       // br-knee-fwd
        ['BLACK',     4, 18, 1, 1],       // br-shin-fwd
        ['CYAN',      4, 19, 1, 1],       // br-paw-fwd
        ['BLACK',     4, 20, 1, 1],       // br-foot-fwd

        // Left leg (bent back): y=17-20
        ['BLACK',     6, 17, 1, 1],       // bl-thigh-bent
        ['BLACK',     6, 18, 1, 1],       // bl-knee-bent
        ['CYAN',      6, 19, 1, 1],       // bl-paw-bent
        ['BLACK',     6, 20, 1, 1],       // bl-foot-bent
    ]);

    const WALK_FRAMES = Object.freeze([WALK_A_FRAME, WALK_B_FRAME]);

    /* ── Sprite helpers ────────────────────────────────────────── */

    function getFrameBlocks(frameName) {
        switch (frameName) {
            case 'IDLE':   return IDLE_FRAME;
            case 'WALK_A':  return WALK_A_FRAME;
            case 'WALK_B':  return WALK_B_FRAME;
            default:        return IDLE_FRAME;
        }
    }

    function getWalkFrame(index) {
        return WALK_FRAMES[((index % 2) + 2) % 2]; // safe mod for negative
    }

    function getPalette() { return PALETTE; }

    /* ── Geometry helpers ──────────────────────────────────────── */

    function cleanRewards(rewards) {
        const source = rewards && typeof rewards === 'object' ? rewards : {};
        return ['Food', 'Water', 'Care'].reduce((out, key) => {
            const value = Number(source[key]);
            out[key] = Number.isFinite(value) && value >= 0 ? value : 0;
            return out;
        }, {});
    }

    function createState(input) {
        const source = input && typeof input === 'object' ? input : {};
        const supplies = cleanRewards(source.supplies);
        const ledger = source.rewardLedger && typeof source.rewardLedger === 'object' ? source.rewardLedger : {};
        return {
            state: Object.values(STATES).includes(source.state) ? source.state : STATES.HIDDEN,
            supplies,
            rewardLedger: Object.keys(ledger).reduce((out, id) => {
                if (id) out[id] = cleanRewards(ledger[id]);
                return out;
            }, {}),
            lastReward: source.lastReward || null,
            position: {
                x: Number.isFinite(Number(source.position && source.position.x)) ? Number(source.position.x) : 0,
                y: Number.isFinite(Number(source.position && source.position.y)) ? Number(source.position.y) : 0
            }
        };
    }

    function configOf(config) {
        const source = config && typeof config === 'object' ? config : {};
        const max = Number(source.maxSupplies);
        return {
            maxSupplies: Number.isFinite(max) && max >= 0 ? max : DEFAULT_CONFIG.maxSupplies,
            rewards: Object.keys(DEFAULT_CONFIG.rewards).reduce((out, key) => {
                const value = Number(source.rewards && source.rewards[key]);
                out[key] = Number.isFinite(value) && value >= 0 ? value : DEFAULT_CONFIG.rewards[key];
                return out;
            }, {})
        };
    }

    function rewardTaskCompletion(state, taskId, metadata, config) {
        const current = createState(state);
        if (typeof taskId !== 'string' || !taskId.trim() || Object.prototype.hasOwnProperty.call(current.rewardLedger, taskId)) {
            return { state: current, awarded: false };
        }
        const settings = configOf(config);
        const meta = metadata && typeof metadata === 'object' ? metadata : {};
        const amount = Object.assign({}, settings.rewards);
        if (meta.rewards && typeof meta.rewards === 'object') {
            ['Food', 'Water', 'Care'].forEach((key) => {
                const value = Number(meta.rewards[key]);
                if (Number.isFinite(value) && value >= 0) amount[key] = value;
            });
        }
        const next = createState(current);
        next.supplies = Object.keys(next.supplies).reduce((out, key) => {
            out[key] = Math.min(settings.maxSupplies, next.supplies[key] + amount[key]);
            return out;
        }, {});
        next.rewardLedger[taskId] = amount;
        next.lastReward = { taskId, metadata: meta };
        return { state: next, awarded: true };
    }

    function transition(state, event) {
        const current = createState(state);
        const nextState = transitions[event];
        if (!nextState) return { state: current.state, changed: false, companion: current };
        return { state: nextState, changed: current.state !== nextState, companion: Object.assign({}, current, { state: nextState }) };
    }

    function clampPosition(position, bounds, size) {
        const point = position && typeof position === 'object' ? position : {};
        const area = bounds && typeof bounds === 'object' ? bounds : {};
        const wolf = size && typeof size === 'object' ? size : {};
        const width = Math.max(0, Number(area.width) || 0);
        const height = Math.max(0, Number(area.height) || 0);
        const wolfWidth = Math.max(0, Number(wolf.width) || 0);
        const wolfHeight = Math.max(0, Number(wolf.height) || 0);
        const maxX = Math.max(0, width - wolfWidth);
        const maxY = Math.max(0, height - wolfHeight);
        // Offset-aware clamping: if the surface has non-trivial left/top offsets,
        // treat the valid range as [left, left+width-wolfWidth] rather than [0, width-wolfWidth].
        const sx = Math.floor(Number(area.left) || 0);
        const sy = Math.floor(Number(area.top) || 0);
        const offsetX = (sx > 0 || sy > 0) ? true : false;
        const xMin = offsetX ? sx : 0;
        const yMin = offsetX ? sy : 0;
        const xMax = offsetX ? sx + maxX : maxX;
        const yMax = offsetX ? sy + maxY : maxY;
        const x = Number(point.x);
        const y = Number(point.y);
        return { x: Math.min(xMax, Math.max(xMin, Number.isFinite(x) ? x : xMin)), y: Math.min(yMax, Math.max(yMin, Number.isFinite(y) ? y : yMin)) };
    }

    function visibleSurface(bounds, size, margin) {
        const area = bounds && typeof bounds === 'object' ? bounds : {};
        const wolf = size && typeof size === 'object' ? size : {};
        const inset = Math.max(0, Number(margin) || 0);
        const width = Math.max(0, Number(area.width) || 0);
        const height = Math.max(0, Number(area.height) || 0);
        return { left: inset, top: inset, right: Math.max(inset, width - (Number(wolf.width) || 0) - inset), bottom: Math.max(inset, height - (Number(wolf.height) || 0) - inset) };
    }

    function entryEdge(bounds, size, edge) {
        const surface = visibleSurface(bounds, size, 0);
        const wolf = size && typeof size === 'object' ? size : {};
        const width = Math.max(0, Number(bounds && bounds.width) || 0);
        const height = Math.max(0, Number(bounds && bounds.height) || 0);
        const wolfWidth = Math.max(0, Number(wolf.width) || 0);
        const wolfHeight = Math.max(0, Number(wolf.height) || 0);
        switch (edge) {
            case 'left': return { x: -wolfWidth, y: surface.bottom / 2 };
            case 'top': return { x: surface.right / 2, y: -wolfHeight };
            case 'bottom': return { x: surface.right / 2, y: height };
            default: return { x: width, y: surface.bottom / 2 };
        }
    }

    function exportState(state) { return JSON.stringify(createState(state)); }
    function importState(serialized) {
        try { return createState(typeof serialized === 'string' ? JSON.parse(serialized) : serialized); }
        catch (error) { return createState(); }
    }

    /* ── Walkable-surface geometry ─────────────────────────────── */

    /**
     * Normalize a list of DOM-like rectangles into viewport-coordinates
     * {left,top,right,bottom,width,height}. Discards hidden, empty,
     * offscreen or malformed entries. Minimum usable dimensions default
     * to wolf footprint unless overridden.
     */
    function normalizeSurfaces(rects, bounds, wolfFootprint) {
        const area = bounds && typeof bounds === 'object' ? bounds : {};
        const vpW = Math.max(0, Number(area.width) || 0);
        const vpH = Math.max(0, Number(area.height) || 0);
        const wf = wolfFootprint && typeof wolfFootprint === 'object' ? wolfFootprint : { width: 48, height: 48 };
        const minW = Math.max(0, Number(wf.width) || 0);
        const minH = Math.max(0, Number(wf.height) || 0);

        const result = [];
        // Ensure input is iterable
        const sources = Array.isArray(rects) ? rects : [rects];
        for (const rect of sources) {
            if (!rect || typeof rect !== 'object') continue;
            const l = Number(rect.left) || 0;
            const t = Number(rect.top) || 0;
            const r = Number(rect.right) || 0;
            const b = Number(rect.bottom) || 0;
            const w = Math.abs(r - l);
            const h = Math.abs(b - t);
            // Skip zero/negative dimensions
            if (w <= 0 || h <= 0) continue;
            // Skip rects smaller than wolf footprint — not traversable
            if (w < minW || h < minH) continue;
            // Clamp to viewport: only include surface portion inside viewport
            const clampedLeft = Math.max(l, 0);
            const clampedTop = Math.max(t, 0);
            const clampedRight = Math.min(r, vpW);
            const clampedBottom = Math.min(b, vpH);
            const cw = clampedRight - clampedLeft;
            const ch = clampedBottom - clampedTop;
            if (cw <= 0 || ch <= 0) continue;
            result.push({ left: clampedLeft, top: clampedTop, right: clampedRight, bottom: clampedBottom, width: cw, height: ch });
        }
        return result;
    }

    /**
     * Pick a deterministic target position within a normalized surface.
     * anchor ∈ ['random','center','top-left','bottom-right'].
     * Returns {x, y} clamped to surface minus a small margin.
     */
    function surfaceTarget(surface, wolfSize, anchor) {
        if (!surface || !Number.isFinite(surface.width) || !Number.isFinite(surface.height)) return null;
        const wolf = wolfSize && typeof wolfSize === 'object' ? wolfSize : { width: 48, height: 48 };
        const ww = Math.max(0, Number(wolf.width) || 0);
        const wh = Math.max(0, Number(wolf.height) || 0);
        const margin = Math.max(0, Number(surface.margin) || 2);
        const maxX = Math.max(margin, surface.width - ww - margin);
        const maxY = Math.max(margin, surface.height - wh - margin);

        switch (anchor) {
            case 'top-left': return { x: surface.left + margin, y: surface.top + margin };
            case 'bottom-right': return { x: surface.left + maxX, y: surface.top + maxY };
            case 'center': return { x: surface.left + (surface.width - ww) / 2, y: surface.top + (surface.height - wh) / 2 };
            case 'random':
            default:
                return {
                    x: surface.left + margin + Math.random() * maxX,
                    y: surface.top + margin + Math.random() * maxY
                };
        }
    }

    return {
        STATES, DEFAULT_CONFIG, SPRITE_SIZE, PALETTE,
        IDLE_FRAME, WALK_A_FRAME, WALK_B_FRAME, WALK_FRAMES,
        getFrameBlocks, getWalkFrame, getPalette,
        createState, rewardTaskCompletion, transition,
        clampPosition, visibleSurface, entryEdge,
        exportState, importState,
        normalizeSurfaces, surfaceTarget
    };
});
