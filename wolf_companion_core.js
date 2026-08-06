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

    /* ── Tamagotchi-style bounded needs model ──────────────────── */

    /** Default needs values (0–100 scale). Higher is better. */
    const DEFAULT_NEEDS = Object.freeze({
        hunger:     30,   // food satisfaction; low → seeks forage/feed
        happiness:  60,   // joy level; low → lingers, droops
        energy:     70,   // stamina; low → prefers rest
        health:     90    // condition; low → fragile, slow
    });

    /** Max elapsed seconds before decay cap kicks in. (~4 hours) */
    const NEEDS_DECAY_MAX_SECS = 4 * 60 * 60;

    /** Decay rate per second for each need. Negative means it goes down. */
    const NEEDS_DECAY_RATE = Object.freeze({
        hunger:     -0.008,   // ~3/hour; never empties quickly
        happiness:  -0.006,   // ~2/min over long period
        energy:     -0.004,   // slowly drains
        health:     -0.001    // very slow drain
    });

    /** Maximum decay when loading after offline time (bounded at -30 points max). */
    const NEEDS_OFFLINE_CAP = -30;

    /** Create a fresh needs object; overrides replace defaults field-by-field. */
    function createNeeds(overrides) {
        const src = overrides && typeof overrides === 'object' ? overrides : {};
        function val(key, fallback) {
            const v = Number(src[key]);
            if (!Number.isFinite(v)) return fallback !== undefined ? fallback : 50;
            return clamp(v, 0, 100);
        }
        return {
            version:   Number(src.version) || 1,
            hunger:    val('hunger', DEFAULT_NEEDS.hunger),
            happiness: val('happiness', DEFAULT_NEEDS.happiness),
            energy:    val('energy', DEFAULT_NEEDS.energy),
            health:    val('health', DEFAULT_NEEDS.health),
            lastUpdate: src.lastUpdate || null       // ISO timestamp string
        };
    }

    /** Advance needs by elapsed seconds. Deterministic — no randomness. */
    function advanceNeeds(needs, nowIso) {
        const n = createNeeds(needs);
        if (!nowIso) { n.lastUpdate = new Date().toISOString(); return n; }
        // Null/missing lastUpdate means no prior time → no decay, just record now
        if (!n.lastUpdate) { n.lastUpdate = nowIso; return n; }

        const last = new Date(n.lastUpdate);
        if (!Number.isFinite(last.getTime())) { n.lastUpdate = nowIso; return n; }

        const now = new Date(nowIso);
        if (!Number.isFinite(now.getTime())) { n.lastUpdate = nowIso; return n; }

        let elapsed = (now.getTime() - last.getTime()) / 1000; // seconds
        if (elapsed <= 0) { n.lastUpdate = nowIso; return n; }
        // Cap offline decay so a weekend doesn't starve the wolf
        if (elapsed > NEEDS_DECAY_MAX_SECS) {
            elapsed = NEEDS_DECAY_MAX_SECS;
        }

        ['hunger','happiness','energy','health'].forEach(key => {
            const rate = NEEDS_DECAY_RATE[key] || 0;
            const raw = n[key] + rate * elapsed;
            n[key] = Math.max(0, Math.min(100, raw));
        });

        // Apply offline hard cap per-need
        n.hunger    = Math.max(0, n.hunger    + Math.min(NEEDS_OFFLINE_CAP, (NEEDS_DECAY_RATE.hunger)    * Math.max(0, elapsed - NEEDS_DECAY_MAX_SECS)));
        n.happiness = Math.max(0, n.happiness + Math.min(NEEDS_OFFLINE_CAP, (NEEDS_DECAY_RATE.happiness) * Math.max(0, elapsed - NEEDS_DECAY_MAX_SECS)));
        n.energy    = Math.max(0, n.energy    + Math.min(NEEDS_OFFLINE_CAP, (NEEDS_DECAY_RATE.energy)    * Math.max(0, elapsed - NEEDS_DECAY_MAX_SECS)));
        n.health    = Math.max(0, n.health    + Math.min(NEEDS_OFFLINE_CAP, (NEEDS_DECAY_RATE.health)    * Math.max(0, elapsed - NEEDS_DECAY_MAX_SECS)));

        n.lastUpdate = nowIso;
        return n;
    }

    /** Care-action effects — bounded, deterministic delta maps. */
    const CARE_ACTIONS = Object.freeze({
        feed: { hunger: 20, happiness: 5,  energy: -5,  health: 0 },
        play: { hunger: -5, happiness: 25, energy: -15, health: 0 },
        rest: { hunger: 0,  happiness: 5,  energy: 30,  health: 10 },
        call: { hunger: 0,  happiness: 15, energy: 0,   health: 0 }
    });

    /** Safe value clamped to [0,100]. NaN/Inf treated as lo. */
    function clamp(v, lo, hi) { return isNaN(v) || !isFinite(v) ? lo : Math.min(hi, Math.max(lo, v)); }

    /**
     * Apply a named care action. Returns { state, changed, action, feedback }.
     * state contains updated needs only (no mutation of caller's object).
     */
    function applyCareAction(needs, action) {
        const n = createNeeds(needs);
        const deltas = CARE_ACTIONS[action];
        if (!deltas) {
            // Unknown action → no change
            n.lastUpdate = new Date().toISOString();
            return { state: n, changed: false, action: action, feedback: 'unrecognized action' };
        }
        let changed = false;
        ['hunger','happiness','energy','health'].forEach(key => {
            if (deltas[key]) {
                const old = n[key];
                n[key] = clamp(n[key] + deltas[key], 0, 100);
                if (n[key] !== old) changed = true;
            }
        });
        n.lastUpdate = new Date().toISOString();

        // Build human-readable feedback
        let parts = [];
        if (action === 'feed')      parts.push('Nom nom… hunger↑');
        else if (action === 'play') parts.push('*happy bark* happiness↑');
        else if (action === 'rest') parts.push('ZZZ… energy restored');
        else if (action === 'call') parts.push('🐺 WOOF! heard you!');
        const feedback = changed ? parts.join(', ') : 'Already good';
        return { state: n, changed: changed, action: action, feedback: feedback };
    }

    /** Derive a mood label from current needs. Checks in priority order. */
    function deriveMood(needs) {
        // Critical distress: any need collapsed (checked first — broad safety net)
        const min = Math.min(needs.hunger, needs.happiness, needs.energy, needs.health);
        if (min <= 10) return 'distressed';
        // Single-critical-low: one vital sign weak but others stable → specific mood
        // Uses ≥ 15 for companion needs so that a lone near-critical stat yields the named mood
        if (needs.energy < 25 && needs.happiness >= 15 && needs.health >= 15 && needs.hunger >= 15) return 'sleepy';
        if (needs.hunger < 25 && needs.happiness >= 15 && needs.energy >= 15 && needs.health >= 15) return 'hungry';
        // Generalized distress: multiple needs declining together
        const stressedCount = [
            needs.hunger < 25,
            needs.happiness < 25,
            needs.energy < 25,
            needs.health < 25
        ].filter(Boolean).length;
        if (stressedCount >= 2 && min < 15) return 'distressed';
        // Positive states
        if (needs.happiness >= 70 && needs.energy >= 30) return 'playful';
        return 'content';
    }

    /**
     * Choose a behavioral mode based on mood and current task-completion state.
     * The result is one of: 'idle', 'walk', 'rest', 'forage'.
     */
    function chooseBehaviorV2(needs, currentState) {
        const mood = deriveMood(needs);
        switch (mood) {
            case 'distressed':
                return (needs.hunger < 30) ? 'forage' : 'walk';
            case 'hungry':
                return 'forage';
            case 'sleepy':
                return 'rest';
            default:
                return currentState === 'IDLE' ? 'idle' : 'walk';
        }
    }

    /**
     * Compute one step toward a roaming target. Deterministic — given same inputs, same output.
     * Returns new { x, y } clamped into the surface bounds.
     */
    function stepRoaming(position, target, wolfSize, bounds, speed) {
        const pos = position && typeof position === 'object' ? position : {x:0,y:0};
        const tgt = target && typeof target === 'object' ? target : {x:0,y:0};
        const sz  = wolfSize && typeof wolfSize === 'object' ? wolfSize : {width:48,height:48};
        const bnd = bounds && typeof bounds === 'object' ? bounds : {};
        const spd = Number(speed) || 3;

        const dx = tgt.x - pos.x;
        const dy = tgt.y - pos.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 2) {
            return { x: tgt.x, y: tgt.y, arrived: true, frameIndex: 0 };
        }

        const step = Math.min(spd, dist * 0.12 + 1);
        const nx = pos.x + (dx / dist) * step;
        const ny = pos.y + (dy / dist) * step;

        // Clamp to surface using offset-aware logic like clampPosition
        const sx = Math.floor(Number(bnd.left) || 0);
        const sy = Math.floor(Number(bnd.top) || 0);
        const offsetX = (sx > 0 || sy > 0) ? true : false;
        const width = Math.max(0, Number(bnd.width) || 0);
        const height = Math.max(0, Number(bnd.height) || 0);
        const ww = Math.max(0, Number(sz.width) || 0);
        const wh = Math.max(0, Number(sz.height) || 0);
        const maxX = offsetX ? sx + Math.max(0, width - ww) : Math.max(0, width - ww);
        const maxY = offsetX ? sy + Math.max(0, height - wh) : Math.max(0, height - wh);
        const xMin = offsetX ? sx : 0;
        const yMin = offsetX ? sy : 0;

        return {
            x: clamp(Math.round(nx), xMin, Math.ceil(maxX)),
            y: clamp(Math.round(ny), yMin, Math.ceil(maxY)),
            arrived: false,
            frameIndex: 0 // set by caller based on animTick
        };
    }

    /* ── Serialization extensions for needs persistence ──────── */

    /** Export complete companion state (includes both legacy + needs fields). */
    function exportFullState(state, needs) {
        const base = createState(state);
        return JSON.stringify(Object.assign({}, base, {
            needsVersion: needs ? Number(needs.version) : 1,
            needsHunger:    needs ? Math.round(needs.hunger * 10) / 10 : DEFAULT_NEEDS.hunger,
            needsHappiness: needs ? Math.round(needs.happiness * 10) / 10 : DEFAULT_NEEDS.happiness,
            needsEnergy:    needs ? Math.round(needs.energy * 10) / 10 : DEFAULT_NEEDS.energy,
            needsHealth:    needs ? Math.round(needs.health * 10) / 10 : DEFAULT_NEEDS.health,
            needsLastUpdate: needs ? needs.lastUpdate : null
        }));
    }

    /** Import full companion state with backward-compatible fallback. */
    function importFullState(serialized) {
        try {
            const raw = typeof serialized === 'string' ? JSON.parse(serialized) : serialized;
            if (!raw || typeof raw !== 'object') return { state: createState(), needs: createNeeds() };

            const base = createState(raw);
            const needsSrc = {
                version:   Number(raw.needsVersion) || 1,
                hunger:    safeNeed(raw.needsHunger),
                happiness: safeNeed(raw.needsHappiness),
                energy:    safeNeed(raw.needsEnergy),
                health:    safeNeed(raw.needsHealth),
                lastUpdate: raw.needsLastUpdate || null
            };
            return { state: base, needs: createNeeds(needsSrc) };
        } catch (_) {
            return { state: createState(), needs: createNeeds() };
        }
    }

    /** Convert a serialized need value back to 0–100 range. */
    function safeNeed(v) {
        const n = Number(v);
        if (!Number.isFinite(n)) return DEFAULT_NEEDS.hunger;
        // Support both scaled (e.g. 300 → 30) and plain (e.g. 30 → stays) formats
        return clamp(n >= 100 ? n / 10 : n, 0, 100);
    }

    /* ── World-coordinate helpers (application-space terrain) ──────────── */

    /**
     * Convert a DOM rect (from getBoundingClientRect()) into document/world
     * coordinates.  The rect's left/top are relative to the current viewport
     * origin; adding scrollX/scrollY (or visualViewport offset) yields
     * absolute document coordinates.
     *
     * @param {{left:number,top:number,right:number,bottom:number,width:number,height:number}} rect
     * @param {{x:number,y:number}} scroll  Document scroll offsets ({scrollLeft, scrollTop})
     * @param {{left?:number,top?:number}|undefined} viewport  VisualViewport object or undefined
     * @returns {{left:number,top:number,right:number,bottom:number,width:number,height:number}}
     */
    function rectToWorldRect(rect, scroll, viewport) {
        const r = rect && typeof rect === 'object' ? rect : {};
        const sc = scroll && typeof scroll === 'object' ? scroll : { x: 0, y: 0 };
        const vpW = Math.max(0, Number(r.width) || 0);
        const vpH = Math.max(0, Number(r.height) || 0);
        let sx = 0, sy = 0;
        if (viewport && Number.isFinite(viewport.top)) {
            // visualViewport offsetTop is the vertical distance between the
            // viewport top and the document origin.
            sy = Math.floor(Number(viewport.top) || 0);
            sx = Math.floor(Number(viewport.left) || 0);
        } else {
            sx = Math.floor(Number(sc.x) || 0);
            sy = Math.floor(Number(sc.y) || 0);
        }
        return {
            left:   Math.round((Number(r.left) || 0) + sx),
            top:    Math.round((Number(r.top) || 0) + sy),
            right:  Math.round((Number(r.right) || 0) + sx),
            bottom: Math.round((Number(r.bottom) || 0) + sy),
            width:  vpW,
            height: vpH
        };
    }

    /**
     * Produce the currently-visible portion of the document as a world-
     * coordinate rectangle.
     */
    function visibleWorldRect(scroll, viewport) {
        const sc = scroll && typeof scroll === 'object' ? scroll : { x: 0, y: 0 };
        let sx = 0, sy = 0;
        if (viewport && Number.isFinite(viewport.top)) {
            sy = Math.floor(Number(viewport.top) || 0);
            sx = Math.floor(Number(viewport.left) || 0);
        } else {
            sx = Math.floor(Number(sc.x) || 0);
            sy = Math.floor(Number(sc.y) || 0);
        }
        // Try window/document metrics; fall back to safe defaults for Node tests
        let sw = 800, sh = 600;
        try {
            sw = root && root.innerWidth ? root.innerWidth : (typeof window !== 'undefined' ? window.innerWidth : 800);
            sh = root && root.innerHeight ? root.innerHeight : (typeof window !== 'undefined' ? window.innerHeight : 600);
        } catch (_) {}
        return { left: sx, top: sy, right: sx + sw, bottom: sy + sh, width: sw, height: sh };
    }

    /**
     * Check whether a world-positioned wolf (top-left corner + size) has
     * any overlap with the visible world rect.  Returns true for any partial
     * intersection.
     */
    function isWorldPositionVisible(position, visibleRect, wolfSize) {
        const p = position && typeof position === 'object' ? position : { x: 0, y: 0 };
        const v = visibleRect && typeof visibleRect === 'object' ? visibleRect : {};
        const w = wolfSize && typeof wolfSize === 'object' ? wolfSize : { width: 48, height: 48 };
        const wx = Number(p.x) || 0;
        const wy = Number(p.y) || 0;
        const ww = Math.max(0, Number(w.width) || 0);
        const wh = Math.max(0, Number(w.height) || 0);
        return !(wx + ww <= v.left || wx >= v.right || wy + wh <= v.top || wy >= v.bottom);
    }

    /**
     * Choose a non-top-left entry point on the named visible edge of the
     * viewport, projected into world coordinates and clamped to the nearest
     * valid terrain surface.
     *
     * Edge names: 'left', 'right', 'top', 'bottom'.
     */
    function entryPointForVisibleEdge(edge, visibleRect, terrain, wolfSize) {
        const v = visibleRect && typeof visibleRect === 'object' ? visibleRect : {};
        const w = wolfSize && typeof wolfSize === 'object' ? wolfSize : { width: 48, height: 48 };
        const ww = Math.max(0, Number(w.width) || 0);
        const wh = Math.max(0, Number(w.height) || 0);
        // Pick a centre-ish position on the edge (avoids corners)
        const midX = v.left + ((v.right || v.left + 800) - (v.left) - ww) / 2;
        const midY = v.top + ((v.bottom || v.top + 600) - (v.top) - wh) / 2;
        let px, py;
        switch (edge) {
            case 'left':
                px = v.left - ww;         // just outside
                py = midY;
                break;
            case 'right':
                px = v.right;             // just outside
                py = midY;
                break;
            case 'top':
                px = midX;
                py = v.top - wh;
                break;
            case 'bottom':
                px = midX;
                py = v.bottom;
                break;
            default:
                px = midX;
                py = midY;
        }
        // Normalise terrain entries so they all carry width/height for clampToTerrainWorld
        if (terrain && Array.isArray(terrain)) {
            terrain = terrain.map(function(t) {
                return t && typeof t === 'object' && !t.width ? {
                    left:   Number(t.left) || 0,
                    top:    Number(t.top) || 0,
                    right:  Number(t.right) || (Number(t.left) + 800),
                    bottom: Number(t.bottom) || (Number(t.top) + 600),
                    width:  (Number(t.right) || (Number(t.left) + 800)) - (Number(t.left) || 0),
                    height: (Number(t.bottom) || (Number(t.top) + 600)) - (Number(t.top) || 0)
                } : t;
            });
        }
        // Clamp onto nearest terrain surface so the wolf appears on something walkable
        return clampToTerrainWorld({ x: px, y: py }, terrain || [], w);
    }

    /**
     * Clamp a world position to a set of terrain surfaces, preferring the
     * closest surface.  If already inside a surface, returns the position
     * unchanged.  Falls back to the global union of all surfaces if no hit.
     */
    function clampToTerrainWorld(position, terrain, wolfSize) {
        const p = position && typeof position === 'object' ? position : { x: 0, y: 0 };
        const w = wolfSize && typeof wolfSize === 'object' ? wolfSize : { width: 48, height: 48 };
        const sources = Array.isArray(terrain) ? terrain : [terrain];
        const pts = [];
        for (const t of sources) {
            if (!t || typeof t !== 'object') continue;
            const tl = Math.floor(Number(t.left) || 0);
            const tt = Math.floor(Number(t.top) || 0);
            const tw = Math.max(0, Number(t.width) || 0);
            const th = Math.max(0, Number(t.height) || 0);
            const maxX = tl + Math.max(0, tw - (Number(w.width) || 0));
            const maxY = tt + Math.max(0, th - (Number(w.height) || 0));
            let cx = Math.min(maxX, Math.max(tl, Number(p.x)));
            let cy = Math.min(maxY, Math.max(tt, Number(p.y)));
            // Distance from point to this surface (zero if inside)
            const dx = Math.abs(cx - Number(p.x));
            const dy = Math.abs(cy - Number(p.y));
            pts.push({ x: cx, y: cy, dist: dx + dy });
        }
        if (pts.length === 0) return { ...p };
        pts.sort((a, b) => a.dist - b.dist);
        return { x: pts[0].x, y: pts[0].y };
    }

    /**
     * Determine which viewport edge to re-enter from given a previous
     * world position.  Prefers the nearest side; deterministic for
     * identical inputs.
     */
    function chooseReentryEdge(previousPosition, visibleRect) {
        const p = previousPosition && typeof previousPosition === 'object' ? previousPosition : { x: 0, y: 0 };
        const v = visibleRect && typeof visibleRect === 'object' ? visibleRect : {};
        // Signed offset from centre of the visible viewport
        const cx = Math.round((Number(v.left) + Number(v.right)) / 2);
        const cy = Math.round((Number(v.top) + Number(v.bottom)) / 2);
        const ox = Number(p.x) + 24 - cx;   // +wolfWidth/2
        const oy = Number(p.y) + 24 - cy;   // +wolfHeight/2
        if (Math.abs(ox) > Math.abs(oy)) {
            return ox > 0 ? 'right' : 'left';
        }
        return oy > 0 ? 'bottom' : 'top';
    }

    return {
        STATES, DEFAULT_CONFIG, SPRITE_SIZE, PALETTE,
        IDLE_FRAME, WALK_A_FRAME, WALK_B_FRAME, WALK_FRAMES,
        getFrameBlocks, getWalkFrame, getPalette,
        createState, rewardTaskCompletion, transition,
        clampPosition, visibleSurface, entryEdge,
        exportState, importState,
        normalizeSurfaces, surfaceTarget,

        /* ── Tamagotchi API ─────────────────────────────────────── */
        DEFAULT_NEEDS,
        NEEDS_DECAY_MAX_SECS,
        NEEDS_DECAY_RATE,
        CARE_ACTIONS,
        createNeeds,
        advanceNeeds,
        applyCareAction,
        deriveMood,
        chooseBehavior: chooseBehaviorV2,
        stepRoaming,
        exportFullState,
        importFullState,

        /* ── World-coordinate helpers ───────────────────────────── */
        rectToWorldRect,
        visibleWorldRect,
        isWorldPositionVisible,
        entryPointForVisibleEdge,
        clampToTerrainWorld,
        chooseReentryEdge
    };
});
