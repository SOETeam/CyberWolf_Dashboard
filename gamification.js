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

    return { calculateProgress, calculateStreak, awardBadges, campaignProgress };
});

/* istanbul ignore next */
if (typeof module !== 'undefined' && module.exports) {
    // CommonJS export is assigned by the wrapper above.
}
