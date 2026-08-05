/* CyberWolf pixel companion core. Pure CommonJS/browser-compatible state helpers. */
(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.CyberWolfCompanionCore = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
    'use strict';

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
        const x = Number(point.x);
        const y = Number(point.y);
        return { x: Math.min(maxX, Math.max(0, Number.isFinite(x) ? x : 0)), y: Math.min(maxY, Math.max(0, Number.isFinite(y) ? y : 0)) };
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

    return { STATES, DEFAULT_CONFIG, createState, rewardTaskCompletion, transition, clampPosition, visibleSurface, entryEdge, exportState, importState };
});
