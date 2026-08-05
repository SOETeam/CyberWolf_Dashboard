/* CyberWolf Phase 1 browser-compatible core.
 * Pure helpers: no DOM, storage, network, or relay behavior.
 */
(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.CyberWolfCore = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
    'use strict';

    function asDate(value) {
        if (!value) return null;
        if (value instanceof Date && !Number.isNaN(value.getTime())) {
            return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
        }
        const text = String(value).trim();
        const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
        if (!match) return null;
        const parsed = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    function dayKey(value) {
        const parsed = asDate(value);
        return parsed ? parsed.toISOString().slice(0, 10) : null;
    }

    function version(task) {
        const parsed = Number.parseInt(task && task._version, 10);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    function dedupeTasksById(tasks) {
        const selected = new Map();
        (Array.isArray(tasks) ? tasks : []).forEach(source => {
            if (!source || source.id == null || String(source.id).trim() === '') return;
            const id = String(source.id).trim();
            const candidate = { ...source, id };
            const identity = source.source_key ? String(source.source_key) : id;
            const current = selected.get(identity);
            if (!current || version(candidate) > version(current)) selected.set(identity, candidate);
        });
        return Array.from(selected.values());
    }

    function computeTodayTasks(tasks, today) {
        const target = dayKey(today || new Date());
        const recurring = new Set(['daily', 'recurring', 'every day']);
        const selected = new Map();
        (Array.isArray(tasks) ? tasks : []).forEach(source => {
            if (!source || source.id == null || String(source.id).trim() === '') return;
            const id = String(source.id).trim();
            const dueValue = source.due != null ? source.due : (source.date != null ? source.date : source.scheduled_date);
            const dueText = dueValue == null ? '' : String(dueValue).trim().toLowerCase();
            const belongsToday = dayKey(dueValue) === target || recurring.has(dueText) || source.sourceView === 'today';
            if (!belongsToday) return;
            const candidate = { ...source, id };
            const current = selected.get(id);
            if (!current || version(candidate) > version(current)) selected.set(id, candidate);
        });
        return Array.from(selected.values());
    }

    function getAgendaTasksForDate(tasks, selectedDate, today) {
        const target = dayKey(selectedDate);
        const todayKey = dayKey(today || new Date());
        if (!target) return [];
        const recurring = new Set(['daily', 'recurring', 'every day']);
        return dedupeTasksById((Array.isArray(tasks) ? tasks : []).filter(task => {
            if (!task || task.id == null) return false;
            const dueValue = task.due != null ? task.due : (task.date != null ? task.date : task.scheduled_date);
            const dueText = dueValue == null ? '' : String(dueValue).trim().toLowerCase();
            return dayKey(dueValue) === target || recurring.has(dueText) ||
                (task.sourceView === 'today' && target === todayKey);
        }));
    }

    function getMonthGrid(value) {
        const parsed = asDate(value || new Date());
        if (!parsed) return [];
        const year = parsed.getUTCFullYear();
        const month = parsed.getUTCMonth();
        const first = new Date(Date.UTC(year, month, 1));
        const start = new Date(Date.UTC(year, month, 1 - first.getUTCDay()));
        return Array.from({ length: 42 }, (_, index) => {
            const date = new Date(start.getTime() + index * 86400000);
            return {
                date: date.toISOString().slice(0, 10),
                day: date.getUTCDate(),
                weekday: date.getUTCDay(),
                isCurrentMonth: date.getUTCMonth() === month,
            };
        });
    }

    function getCalendarViewState(view, agendaDate, calendarMonth) {
        const safeView = ['today', 'agenda', 'calendar'].includes(view) ? view : 'today';
        const safeDate = dayKey(agendaDate) || dayKey(new Date());
        const safeMonth = /^\d{4}-\d{2}$/.test(String(calendarMonth || ''))
            ? String(calendarMonth)
            : safeDate.slice(0, 7);
        return { view: safeView, agendaDate: safeDate, calendarMonth: safeMonth };
    }

    function normalizeRefreshTask(source, sourceView) {
        if (!source || typeof source !== 'object' || Array.isArray(source)) return null;
        const id = source.id == null ? '' : String(source.id).trim();
        const title = source.title == null ? '' : String(source.title).trim();
        if (!id || !title) return null;
        const task = {
            ...source,
            id,
            title,
            vector: source.vector ? String(source.vector) : 'schedule',
            priority: source.priority ? String(source.priority) : 'p1',
            status: source.status ? String(source.status) : 'active',
            details: source.details ? String(source.details) : title,
        };
        if (!task.due && task.local_date) task.due = task.local_date;
        if (sourceView) task.sourceView = sourceView;
        if (!task.source_key) {
            const sourceType = task.source && task.source.type ? String(task.source.type) : 'local';
            task.source_key = `${sourceType}:${id}`;
        }
        return task;
    }

    function parseRefreshArtifact(payload) {
        if (typeof payload === 'string') {
            try {
                payload = JSON.parse(payload);
            } catch (error) {
                return null;
            }
        }
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
        if (payload.external_sync !== false) return null;
        if (!Array.isArray(payload.tasks) || !Array.isArray(payload.today_tasks)) return null;
        const tasks = payload.tasks.map(task => normalizeRefreshTask(task, null));
        const todayTasks = payload.today_tasks.map(task => normalizeRefreshTask(task, 'today'));
        if (tasks.some(task => !task) || todayTasks.some(task => !task)) return null;
        return {
            tasks: dedupeTasksById(tasks),
            todayTasks: dedupeTasksById(todayTasks),
            localTasks: Array.isArray(payload.local_tasks)
                ? payload.local_tasks.map(task => normalizeRefreshTask(task, null)).filter(Boolean)
                : [],
            calendarEvents: Array.isArray(payload.calendar_events)
                ? payload.calendar_events.map(task => normalizeRefreshTask(task, null)).filter(Boolean)
                : [],
            sourceStatus: payload.source_status && typeof payload.source_status === 'object'
                ? { ...payload.source_status } : {},
            syncStatus: payload.sync_status && typeof payload.sync_status === 'object'
                ? { ...payload.sync_status } : {},
            sourceContracts: payload.source_contracts && typeof payload.source_contracts === 'object'
                ? { ...payload.source_contracts } : {},
        };
    }

    function mergeRefreshArtifact(baseTasks, artifact, baseTodayTasks) {
        const safeArtifact = artifact && Array.isArray(artifact.tasks) && Array.isArray(artifact.todayTasks)
            ? artifact
            : { tasks: [], todayTasks: [] };
        return {
            allTasks: dedupeTasksById([...(Array.isArray(baseTasks) ? baseTasks : []), ...safeArtifact.tasks]),
            todayTasks: dedupeTasksById([...(Array.isArray(baseTodayTasks) ? baseTodayTasks : []), ...safeArtifact.todayTasks]),
        };
    }

    function healthScore(task, now) {
        if (!task) return 0;
        if (task.completed === true || ['completed', 'done'].includes(String(task.status || '').toLowerCase())) return 100;
        const priorityPenalty = { p0: 20, p1: 12, p2: 6, p3: 0 }[String(task.priority || '').toLowerCase()] || 0;
        const today = asDate(now || new Date()) || asDate(new Date());
        const due = asDate(task.due != null ? task.due : task.date);
        let duePenalty = 0;
        if (due && today) {
            const daysUntilDue = Math.round((due - today) / 86400000);
            if (daysUntilDue < 0) duePenalty = Math.min(45, 25 + Math.abs(daysUntilDue) * 5);
            else if (daysUntilDue === 0) duePenalty = 20;
            else if (daysUntilDue <= 2) duePenalty = 10;
        }
        const updated = asDate(task.last_updated != null ? task.last_updated : task.updated_at);
        const inactivityPenalty = updated && today
            ? Math.min(25, Math.max(0, Math.round((today - updated) / 86400000)) * 3)
            : 0;
        return Math.max(0, Math.min(100, 100 - priorityPenalty - duePenalty - inactivityPenalty));
    }

    return {
        dedupeTasksById,
        computeTodayTasks,
        getAgendaTasksForDate,
        getMonthGrid,
        getCalendarViewState,
        healthScore,
        parseRefreshArtifact,
        mergeRefreshArtifact,
    };
});

/* istanbul ignore next */
if (typeof module !== 'undefined' && module.exports) {
    // CommonJS export is assigned by the wrapper above.
}
