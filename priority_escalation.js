/* CyberWolf Phase 4: pure, deterministic priority escalation helpers. */
(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.CyberWolfPriorityEscalation = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
    'use strict';

    const DAY_MS = 86400000;
    const PRIORITY_RANK = { p0: 0, p1: 1, p2: 2, p3: 3 };
    const URGENCY_RANK = { critical: 0, urgent: 1, watch: 2, normal: 3 };

    function parseIsoLocalDate(value) {
        if (typeof value !== 'string') return null;
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
        if (!match) return null;
        const year = Number(match[1]);
        const month = Number(match[2]);
        const day = Number(match[3]);
        const date = new Date(Date.UTC(year, month - 1, day));
        if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
        return date;
    }

    function daysBetweenDates(start, end) {
        const startDate = parseIsoLocalDate(start);
        const endDate = parseIsoLocalDate(end);
        if (!startDate || !endDate) return null;
        return Math.round((endDate - startDate) / DAY_MS);
    }

    function isCompleted(task) {
        return !!task && (task.completed === true || ['completed', 'done'].includes(String(task.status || '').toLowerCase()));
    }

    function taskDate(task, names) {
        if (!task || typeof task !== 'object') return null;
        for (const name of names) {
            const parsed = parseIsoLocalDate(task[name]);
            if (parsed) return task[name].trim();
        }
        return null;
    }

    function urgencyLevel(task, referenceDate) {
        if (!task || typeof task !== 'object' || isCompleted(task)) return 'normal';
        const reference = parseIsoLocalDate(referenceDate);
        if (!reference) return 'normal';

        const due = taskDate(task, ['due', 'date', 'scheduled_date']);
        const dueDelta = due ? daysBetweenDates(referenceDate, due) : null;
        const priority = String(task.priority || '').toLowerCase();
        if (dueDelta !== null && dueDelta <= -3) return 'critical';
        if (dueDelta === 0 && (priority === 'p0' || priority === 'p1')) return 'critical';
        if (dueDelta !== null && (dueDelta >= -2 && dueDelta <= -1)) return 'urgent';
        if (dueDelta !== null && dueDelta >= 0 && dueDelta <= 2) return 'urgent';

        const updated = taskDate(task, ['last_updated', 'updated_at', 'lastActivity']);
        const inactivityDays = updated === null ? null : daysBetweenDates(updated, referenceDate);
        if (dueDelta !== null && dueDelta >= 0 && dueDelta <= 7) return 'watch';
        if (inactivityDays !== null && inactivityDays >= 3) return 'watch';
        return 'normal';
    }

    function escalatedPriority(basePriority, urgency) {
        const base = PRIORITY_RANK[basePriority] === undefined ? 'p3' : basePriority;
        const target = urgency === 'critical' ? 'p0' : urgency === 'urgent' ? 'p1' : urgency === 'watch' ? 'p2' : base;
        return PRIORITY_RANK[target] < PRIORITY_RANK[base] ? target : base;
    }

    function escalatePriority(task, referenceDate) {
        const source = task && typeof task === 'object' && !Array.isArray(task) ? task : {};
        const copy = { ...source };
        const basePriority = String(source.priority || 'p3').toLowerCase();
        const urgency = urgencyLevel(source, referenceDate);
        copy.basePriority = PRIORITY_RANK[basePriority] === undefined ? 'p3' : basePriority;
        copy.urgency = urgency;
        copy.priority = escalatedPriority(copy.basePriority, urgency);
        return copy;
    }

    function sortByEscalatedUrgency(tasks, referenceDate) {
        const seen = new Set();
        const candidates = (Array.isArray(tasks) ? tasks : []).reduce((result, task, originalIndex) => {
            if (!task || typeof task !== 'object' || Array.isArray(task)) return result;
            const id = task.id == null ? null : String(task.id).trim();
            if (id && seen.has(id)) return result;
            if (id) seen.add(id);
            result.push({ task: escalatePriority(task, referenceDate), originalIndex });
            return result;
        }, []);
        return candidates.sort((left, right) => {
            const urgencyDiff = URGENCY_RANK[left.task.urgency] - URGENCY_RANK[right.task.urgency];
            if (urgencyDiff) return urgencyDiff;
            const leftDue = taskDate(left.task, ['due', 'date', 'scheduled_date']);
            const rightDue = taskDate(right.task, ['due', 'date', 'scheduled_date']);
            if (leftDue === null && rightDue !== null) return 1;
            if (leftDue !== null && rightDue === null) return -1;
            if (leftDue !== null && rightDue !== null) {
                const dueDiff = daysBetweenDates(rightDue, leftDue);
                if (dueDiff) return dueDiff;
            }
            return left.originalIndex - right.originalIndex;
        }).map(entry => entry.task);
    }

    return { daysBetweenDates, urgencyLevel, escalatePriority, sortByEscalatedUrgency };
});
