/* CyberWolf Phase 3 gamification.
 * Dependency-free pure helpers: no DOM, storage, network, or relay behavior.
 */
(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.CyberWolfGamification = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
    'use strict';

    const DAY_MS = 86400000;

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function dateKey(value) {
        if (value instanceof Date) {
            if (Number.isNaN(value.getTime())) return null;
            const year = value.getFullYear();
            const month = String(value.getMonth() + 1).padStart(2, '0');
            const day = String(value.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
        if (typeof value !== 'string') return null;
        const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|T|\s)/.exec(value.trim());
        if (!match) return null;
        const year = Number(match[1]);
        const month = Number(match[2]);
        const day = Number(match[3]);
        const parsed = new Date(Date.UTC(year, month - 1, day));
        if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return null;
        return match.slice(1).join('-');
    }

    function keyToDayNumber(key) {
        const parts = key.split('-').map(Number);
        return Math.floor(Date.UTC(parts[0], parts[1] - 1, parts[2]) / DAY_MS);
    }

    function calculateProgress(tasks, completedIds) {
        const safeTasks = Array.isArray(tasks) ? tasks : [];
        const completed = completedIds instanceof Set
            ? completedIds
            : new Set(Array.isArray(completedIds) ? completedIds : []);
        const total = safeTasks.length;
        const count = safeTasks.reduce((sum, task) => {
            return sum + (task && completed.has(task.id) ? 1 : 0);
        }, 0);
        const percent = total === 0 ? 0 : Math.round(clamp((count / total) * 100, 0, 100));
        return { total, completed: count, percent };
    }

    function calculateStreak(completionDates, referenceDate) {
        const referenceKey = dateKey(referenceDate);
        if (!referenceKey) return 0;
        const days = new Set((Array.isArray(completionDates) ? completionDates : [])
            .map(dateKey)
            .filter(Boolean)
            .map(keyToDayNumber));
        let streak = 0;
        let cursor = keyToDayNumber(referenceKey);
        while (days.has(cursor)) {
            streak += 1;
            cursor -= 1;
        }
        return streak;
    }

    function awardBadges(input) {
        const data = input && typeof input === 'object' ? input : {};
        const progress = data.progress && typeof data.progress === 'object' ? data.progress : {};
        const completedCount = Number.isFinite(Number(data.completedCount)) ? Number(data.completedCount) : 0;
        const streak = Number.isFinite(Number(data.streak)) ? Number(data.streak) : 0;
        const badges = [];
        if (completedCount >= 1) badges.push({ id: 'first_task', label: 'FIRST TASK' });
        if (Number(progress.percent) >= 50) badges.push({ id: 'half_way', label: 'HALF WAY' });
        if (Number(progress.total) > 0 && Number(progress.completed) >= Number(progress.total)) {
            badges.push({ id: 'daily_complete', label: 'DAILY COMPLETE' });
        }
        if (streak >= 3) badges.push({ id: 'streak_3', label: '3-DAY STREAK' });
        if (streak >= 7) badges.push({ id: 'streak_7', label: '7-DAY STREAK' });
        return badges;
    }

    function campaignProgress(completedCount, campaignTarget) {
        const completed = Number(completedCount);
        const target = Number(campaignTarget);
        if (!Number.isFinite(completed) || !Number.isFinite(target) || target <= 0) return 0;
        return Math.round(clamp((completed / target) * 100, 0, 100));
    }

    const MISSION_TIMEZONE = 'America/Detroit';
    const VALID_CLASSIFICATIONS = new Set(['daily_time_sensitive', 'project_sensitive', 'hybrid', 'unclassified']);
    const VALID_PROGRESS_SOURCES = new Set(['manual', 'subtasks', 'manual_override']);

    function localDateKey(value, timeZone) {
        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime())) return null;
        try {
            const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timeZone || MISSION_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
            const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
            return `${values.year}-${values.month}-${values.day}`;
        } catch (error) { return null; }
    }

    function occurrenceKey(task, date) {
        const day = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
            ? date : localDateKey(date, MISSION_TIMEZONE);
        return task && task.id != null && day ? `${String(task.id)}@${day}` : null;
    }

    function normalizeMissionTask(source, idFactory) {
        const input = source && typeof source === 'object' ? source : {};
        const id = input.id != null && String(input.id).trim() ? String(input.id).trim() : (idFactory ? idFactory(input) : 'mission-1');
        const subtasks = Array.isArray(input.subtasks) ? input.subtasks.map(item => ({ ...item })) : [];
        return { ...input, id, title: String(input.title || '').trim(), vector: String(input.vector || 'work'), priority: input.priority ? String(input.priority) : 'p1', sourceView: input.sourceView || 'today', classification: VALID_CLASSIFICATIONS.has(input.classification) ? input.classification : 'unclassified', project_id: input.project_id == null ? undefined : String(input.project_id), completed: input.completed === true, project_progress: clamp(Number.isFinite(Number(input.project_progress)) ? Number(input.project_progress) : 0, 0, 1), progress_source: VALID_PROGRESS_SOURCES.has(input.progress_source) ? input.progress_source : 'manual', subtasks, source: input.source && typeof input.source === 'object' ? { ...input.source } : { type: 'local' }, _version: Number.isFinite(Number(input._version)) ? Number(input._version) : 1 };
    }

    function stateShape(state) {
        const input = state && typeof state === 'object' ? state : {};
        return { ...input, completedOccurrences: Array.isArray(input.completedOccurrences) ? [...new Set(input.completedOccurrences.map(String))] : [], completions: Array.isArray(input.completions) ? input.completions.map(item => ({ ...item })) : [], legacyCompletedIds: Array.isArray(input.legacyCompletedIds) ? [...new Set(input.legacyCompletedIds.map(String))] : [] };
    }

    function migrateMissionState(legacyIds, state, date) {
        const result = stateShape(state);
        const day = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : localDateKey(date, MISSION_TIMEZONE);
        (Array.isArray(legacyIds) ? legacyIds : []).forEach(id => { const key = `${String(id)}@${day}`; if (day && !result.completedOccurrences.includes(key)) result.completedOccurrences.push(key); if (!result.legacyCompletedIds.includes(String(id))) result.legacyCompletedIds.push(String(id)); });
        return result;
    }

    function normalizedWeights(task) {
        const classification = task.classification;
        const defaults = classification === 'hybrid' ? { daily: 0.25, project: 0.75 } : classification === 'daily_time_sensitive' ? { daily: 1, project: 0 } : { daily: 0, project: 1 };
        const daily = Number(task.daily_weight); const project = Number(task.project_weight);
        if (Number.isFinite(daily) && Number.isFinite(project) && daily >= 0 && project >= 0 && daily + project > 0) {
            const total = daily + project; return { daily: daily / total, project: project / total };
        }
        return defaults;
    }

    function progressValue(task, state, day) {
        const occurrence = occurrenceKey(task, day);
        const explicitDaily = Number(task.daily_progress);
        const daily = Number.isFinite(explicitDaily) ? clamp(explicitDaily, 0, 1) : (state.completedOccurrences.includes(occurrence) || (task.completed === true && !task.recurring) ? 1 : 0);
        const subtasks = Array.isArray(task.subtasks) ? task.subtasks : [];
        const derived = subtasks.length ? subtasks.filter(item => item && item.completed === true).length / subtasks.length : 0;
        const manual = clamp(Number(task.project_progress) || 0, 0, 1);
        const source = VALID_PROGRESS_SOURCES.has(task.progress_source) ? task.progress_source : 'manual';
        const project = source === 'subtasks' ? derived : manual;
        return { value: clamp(normalizedWeights(task).daily * daily + normalizedWeights(task).project * project, 0, 1), source, derived, manual, conflict: source !== 'subtasks' && subtasks.length > 0 && Math.abs(derived - manual) > 0.000001 };
    }

    function calculateDailyProgress(tasks, state, day) {
        const options = day && typeof day === 'object' ? day : { date: day };
        const target = options.date || localDateKey(options.now || new Date(), MISSION_TIMEZONE);
        const safe = stateShape(state); const items = (Array.isArray(tasks) ? tasks : []).filter(task => task && ['daily_time_sensitive', 'hybrid'].includes(task.classification) && eligibleOnDate(task, target));
        const completed = items.filter(task => safe.completedOccurrences.includes(occurrenceKey(task, target))).length;
        const missed = items.filter(task => {
            const occ = occurrenceKey(task, target);
            if (safe.completedOccurrences.includes(occ)) return false;
            const due = dateOnly(task.due || task.due_date);
            const expiry = dateOnly(task.expires_on || task.expiry_date || task.expiry);
            return (due && due < target) || (expiry && expiry <= target);
        }).map(task => occurrenceKey(task, target));
        const historical = safe.completedOccurrences.filter(key => key.endsWith(`@${target}`) === false && key.split('@')[1] < target);
        return { total: items.length, completed, missed: missed.length, percent: items.length ? Math.round((completed / items.length) * 100) : 0, date: target, history: { completed: historical, missed } };
    }

    function calculateProjectProgress(tasks, state, day) {
        const items = (Array.isArray(tasks) ? tasks : []).filter(task => task && ['project_sensitive', 'hybrid'].includes(task.classification));
        const safe = stateShape(state); const values = items.map(task => progressValue(task, safe, day)); const raw = values.reduce((sum, item) => sum + item.value, 0); const completed = Number((Math.round(raw * 1e10) / 1e10).toFixed(10));
        return { total: items.length, completed, percent: items.length ? Math.round((completed / items.length) * 100) : 0, metadata: values.map((item, index) => ({ id: items[index].id, progress_source: item.source, conflict: item.conflict, derived: item.derived, manual: item.manual })) };
    }

    function completeMission(task, state, day, source) {
        const normalized = normalizeMissionTask(task); const result = stateShape(state); const occurrence = occurrenceKey(normalized, day); const timestamp = new Date().toISOString();
        normalized.completed = true;
        if (occurrence && !result.completedOccurrences.includes(occurrence)) result.completedOccurrences.push(occurrence);
        if (!result.completions.some(item => item.occurrence === occurrence)) result.completions.push({ id: normalized.id, occurrence, timestamp, source: VALID_PROGRESS_SOURCES.has(source) ? source : 'manual' });
        result.legacyCompletedIds = [...new Set([...result.legacyCompletedIds, normalized.id])];
        return { task: normalized, state: result };
    }

    function dateOnly(value) { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : localDateKey(value, MISSION_TIMEZONE); }
    function eligibleOnDate(task, target) {
        const scheduled = dateOnly(task.scheduled_date || task.scheduled || task.start_date);
        const due = dateOnly(task.due || task.due_date);
        const expiry = dateOnly(task.expires_on || task.expiry_date || task.expiry);
        if (scheduled && scheduled > target) return false;
        return true;
    }

    return { calculateProgress, calculateStreak, awardBadges, campaignProgress, normalizeMissionTask, localDateKey, occurrenceKey, calculateDailyProgress, calculateProjectProgress, migrateMissionState, completeMission };
});

/* istanbul ignore next */
if (typeof module !== 'undefined' && module.exports) {
    // CommonJS export is assigned by the wrapper above.
}
