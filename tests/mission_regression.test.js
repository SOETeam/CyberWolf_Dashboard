const assert = require('node:assert/strict');
const core = require('../dashboard_core.js');
const api = require('../gamification.js');

// RED: local missions must have render-safe defaults and appear in computed Today.
const created = api.normalizeMissionTask({ id: 'new-1', title: 'New mission', classification: 'unclassified' });
assert.equal(created.priority, 'p1');
assert.equal(created.sourceView, 'today');
assert.equal(core.computeTodayTasks([created], '2026-08-05').length, 1);

// RED: hybrid metrics use explicit default weights and normalize invalid explicit weights.
const weighted = [
  { id: 'h', classification: 'hybrid', daily_progress: 0.4, project_progress: 0.8 },
  { id: 'bad', classification: 'hybrid', daily_progress: 1, project_progress: 0, daily_weight: 2, project_weight: 2 },
];
const project = api.calculateProjectProgress(weighted, {}, '2026-08-05');
assert.equal(project.completed, 0.7 + 0.5);
assert.equal(project.percent, 60);

// RED: Detroit date and occurrence are timezone-safe, including DST transitions.
assert.equal(api.occurrenceKey({ id: 'd' }, '2026-03-08T04:30:00Z'), 'd@2026-03-07');
assert.equal(api.occurrenceKey({ id: 'd' }, '2026-03-08T05:30:00Z'), 'd@2026-03-08');

// RED: future occurrences are excluded; missed occurrences remain in the denominator and history.
const dailyTasks = [
  { id: 'past', classification: 'daily_time_sensitive', due: '2026-08-04' },
  { id: 'today', classification: 'daily_time_sensitive', scheduled_date: '2026-08-05', due: '2026-08-05' },
  { id: 'future', classification: 'daily_time_sensitive', scheduled_date: '2026-08-06' },
  { id: 'expired', classification: 'daily_time_sensitive', expires_on: '2026-08-04' },
];
assert.deepEqual(api.calculateDailyProgress(dailyTasks, { completedOccurrences: ['today@2026-08-05'] }, { now: '2026-08-05T15:00:00Z', date: '2026-08-05' }), {
  total: 3, completed: 1, missed: 2, percent: 33, date: '2026-08-05', history: { completed: [], missed: ['past@2026-08-05', 'expired@2026-08-05'] }
});
assert.deepEqual(api.calculateDailyProgress(dailyTasks, { completedOccurrences: ['past@2026-08-04'] }, { now: '2026-08-05T15:00:00Z', date: '2026-08-05' }).history.completed, ['past@2026-08-04']);

// GREEN RED: expired incomplete tasks remain in daily denominator and count as missed.
const expiredResult = api.calculateDailyProgress([
  { id: 'exp1', classification: 'daily_time_sensitive', expires_on: '2026-08-04' },
], { completedOccurrences: [] }, { now: '2026-08-05T15:00:00Z', date: '2026-08-05' });
assert.equal(expiredResult.total, 1, 'expired task should be in total denominator');
assert.equal(expiredResult.missed, 1, 'expired incomplete task should be missed');
assert.equal(expiredResult.percent, 0, 'zero percent when only expired tasks remain');
assert.deepEqual(expiredResult.history.missed, ['exp1@2026-08-05']);

// RED: legacy base IDs never complete future recurring occurrences.
const migrated = api.migrateMissionState(['daily'], {}, '2026-08-05');
assert.deepEqual(migrated.completedOccurrences, ['daily@2026-08-05']);
assert.equal(api.calculateDailyProgress([{ id: 'daily', classification: 'daily_time_sensitive', recurring: true }], migrated, '2026-08-06').completed, 0);

// RED: manual/subtask/manual_override precedence and conflict metadata are deterministic.
const conflict = api.calculateProjectProgress([{ id: 'p', classification: 'project_sensitive', project_progress: 0.8, progress_source: 'manual', subtasks: [{ completed: true }, { completed: false }] }], {}, '2026-08-05');
assert.equal(conflict.completed, 0.8);
assert.equal(conflict.metadata[0].progress_source, 'manual');
assert.equal(conflict.metadata[0].conflict, true);
assert.equal(api.calculateProjectProgress([{ id: 'p', classification: 'project_sensitive', project_progress: 0.8, progress_source: 'manual_override', subtasks: [{ completed: false }] }], {}, '2026-08-05').completed, 0.8);
assert.equal(api.calculateProjectProgress([{ id: 'p', classification: 'project_sensitive', project_progress: 0.8, progress_source: 'subtasks', subtasks: [{ completed: true }, { completed: false }] }], {}, '2026-08-05').completed, 0.5);

// RED: completion records are timestamped, sourced, and occurrence-idempotent.
const once = api.completeMission({ id: 'x', classification: 'daily_time_sensitive' }, {}, '2026-08-05', 'manual');
const twice = api.completeMission({ id: 'x', classification: 'daily_time_sensitive' }, once.state, '2026-08-05', 'manual');
assert.equal(twice.state.completions.length, 1);
assert.match(twice.state.completions[0].timestamp, /^\d{4}-\d{2}-\d{2}T/);
assert.equal(twice.state.completions[0].source, 'manual');

console.log('mission_regression.test.js: RED contract complete');
