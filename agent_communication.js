/* Phase 5 Agent Communication — pure, dependency-free browser/CommonJS module. */
(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.CyberWolfAgentCommunication = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
    'use strict';

    const SEVERITIES = new Set(['critical', 'high', 'warning', 'medium', 'low', 'info']);
    const HANDOFF_STATUSES = new Set(['pending', 'accepted', 'blocked', 'completed']);

    function text(value) {
        return value == null ? '' : String(value).trim();
    }

    function token(value, fallback) {
        const normalized = text(value).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
        return normalized || fallback;
    }

    function isoTimestamp(value) {
        if (value instanceof Date) {
            return Number.isNaN(value.getTime()) ? null : value.toISOString();
        }
        if (typeof value !== 'string' && typeof value !== 'number') return null;
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
    }

    function normalizeAgentEvent(event) {
        if (!event || typeof event !== 'object' || Array.isArray(event)) return null;
        const id = text(event.id != null ? event.id : event.eventId);
        const agent = token(event.agent != null ? event.agent : event.source, '');
        const type = token(event.type != null ? event.type : event.eventType, '');
        const timestamp = isoTimestamp(event.timestamp != null ? event.timestamp : event.createdAt);
        const message = text(event.message != null ? event.message : event.title);
        const title = text(event.title != null ? event.title : event.message);
        if (!id || !agent || !type || !timestamp || !message) return null;
        const severityToken = token(event.severity, 'info');
        return {
            id,
            agent,
            type,
            severity: SEVERITIES.has(severityToken) ? severityToken : 'info',
            timestamp,
            message,
            title,
        };
    }

    function createHandoffRecord(input) {
        if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
        const from = token(input.from, '');
        const to = token(input.to, '');
        const taskId = text(input.taskId);
        const summary = text(input.summary);
        if (!from || !to || !taskId || !summary) return null;
        const status = token(input.status, 'pending');
        if (!HANDOFF_STATUSES.has(status)) return null;
        const artifacts = Array.isArray(input.artifacts)
            ? input.artifacts.map(text).filter(Boolean)
            : [];
        const createdAt = input.createdAt == null ? null : isoTimestamp(input.createdAt);
        if (input.createdAt != null && !createdAt) return null;
        return {
            id: `handoff:${from}:${to}:${taskId}`,
            from,
            to,
            taskId,
            summary,
            artifacts,
            status,
            createdAt,
        };
    }

    function sortAgentEvents(events) {
        return (Array.isArray(events) ? events : [])
            .map((event, index) => ({ event: normalizeAgentEvent(event), index }))
            .filter(item => item.event)
            .sort((left, right) => {
                const timeDifference = right.event.timestamp.localeCompare(left.event.timestamp);
                return timeDifference || left.index - right.index;
            })
            .map(item => item.event);
    }

    function renderAgentEventText(event) {
        const normalized = normalizeAgentEvent(event);
        if (!normalized) return '';
        const agent = normalized.agent.toUpperCase();
        const type = normalized.type.toUpperCase();
        const severity = normalized.severity.toUpperCase();
        return `[${normalized.timestamp}] ${agent} / ${type} / ${severity} — ${normalized.title}: ${normalized.message}`;
    }

    return { normalizeAgentEvent, createHandoffRecord, sortAgentEvents, renderAgentEventText };
});

/* No external delivery, voice, Discord, storage, or network behavior belongs here. */
