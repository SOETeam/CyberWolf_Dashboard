const assert = require('node:assert/strict');
const {
  calculateProgress,
  calculateStreak,
  awardBadges,
  campaignProgress,
  normalizeMissionTask,
  localDateKey,
  occurrenceKey,
  calculateDailyProgress,
  calculateProjectProgress,
  migrateMissionState,
  completeMission,
} = require('../gamification.js');

assert.deepEqual(
  calculateProgress([{ id: 'a' }, { id: 'b' }, { id: 'c' }], new Set(['a', 'missing'])),
  { total: 3, completed: 1, percent: 33 },
);
assert.deepEqual(calculateProgress([], ['a']), { total: 0, completed: 0, percent: 0 });
assert.deepEqual(calculateProgress([{ id: 'a' }], ['a', 'a']), { total: 1, completed: 1, percent: 100 });
assert.deepEqual(calculateProgress([{ id: 'a' }, { id: 'b' }], ['a', 'b', 'c']), { total: 2, completed: 2, percent: 100 });

assert.equal(
  calculateStreak(
    ['2026-08-01', '2026-08-02', '2026-08-02', 'bad-date', '2026-08-04'],
    '2026-08-04',
  ),
  1,
);
assert.equal(calculateStreak(['2026-08-02', '2026-08-03', '2026-08-04'], '2026-08-04'), 3);
assert.equal(calculateStreak(['2026-08-02', '2026-08-03'], '2026-08-04'), 0);
assert.equal(calculateStreak(['2026-02-30', '2026-08-04'], '2026-08-04'), 1);

assert.deepEqual(
  awardBadges({ progress: { total: 10, completed: 10, percent: 100 }, streak: 7, completedCount: 10 }),
  [
    { id: 'first_task', label: 'FIRST TASK' },
    { id: 'half_way', label: 'HALF WAY' },
    { id: 'daily_complete', label: 'DAILY COMPLETE' },
    { id: 'streak_3', label: '3-DAY STREAK' },
    { id: 'streak_7', label: '7-DAY STREAK' },
  ],
);
assert.deepEqual(awardBadges({ progress: { total: 0, completed: 0, percent: 0 }, streak: 0, completedCount: 0 }), []);

assert.equal(campaignProgress(5, 10), 50);
assert.equal(campaignProgress(20, 10), 100);
assert.equal(campaignProgress(-1, 10), 0);
assert.equal(campaignProgress(5, 0), 0);
assert.equal(campaignProgress(5, 'nope'), 0);

assert.deepEqual(normalizeMissionTask({ title: 'Ship', vector: 'project', project_id: 'p1', subtasks: [{ id: 's1', completed: true }] }), {
  id: 'mission-1', title: 'Ship', vector: 'project', classification: 'unclassified', project_id: 'p1', completed: false,
  project_progress: 0, progress_source: 'manual', subtasks: [{ id: 's1', completed: true }], source: { type: 'local' }, _version: 1,
  priority: 'p1', sourceView: 'today',
});
assert.equal(localDateKey('2026-03-08T04:30:00Z', 'America/Detroit'), '2026-03-07');
assert.equal(localDateKey('2026-03-08T05:30:00Z', 'America/Detroit'), '2026-03-08');
assert.equal(occurrenceKey({ id: 'daily-1' }, '2026-08-05'), 'daily-1@2026-08-05');

const missionTasks = [
  { id: 'd1', title: 'Daily', classification: 'daily_time_sensitive', vector: 'health' },
  { id: 'h1', title: 'Hybrid', classification: 'hybrid', vector: 'project', project_id: 'p1', project_progress: 0.5 },
  { id: 'p1-task', title: 'Project', classification: 'project_sensitive', vector: 'work', project_id: 'p1', project_progress: 0.25 },
  { id: 'u1', title: 'Unclassified', classification: 'unclassified', vector: 'home' },
];
assert.deepEqual(calculateDailyProgress(missionTasks, { completedOccurrences: ['d1@2026-08-05'] }, '2026-08-05'), { total: 2, completed: 1, missed: 0, percent: 50, date: '2026-08-05', history: { completed: [], missed: [] } });
assert.deepEqual(calculateDailyProgress([], {}, '2026-08-05'), { total: 0, completed: 0, missed: 0, percent: 0, date: '2026-08-05', history: { completed: [], missed: [] } });
assert.deepEqual(calculateProjectProgress(missionTasks, { completedOccurrences: ['p1-task@2026-08-05'] }, '2026-08-05'), { total: 2, completed: 0.625, percent: 31, metadata: [{ id: 'h1', progress_source: 'manual', conflict: false, derived: 0, manual: 0.5 }, { id: 'p1-task', progress_source: 'manual', conflict: false, derived: 0, manual: 0.25 }] });
assert.deepEqual(calculateProjectProgress([{ id: 's', classification: 'project_sensitive', project_id: 'p', project_progress: 0, progress_source: 'subtasks', subtasks: [{ completed: true }, { completed: false }] }], {}, '2026-08-05'), { total: 1, completed: 0.5, percent: 50, metadata: [{ id: 's', progress_source: 'subtasks', conflict: false, derived: 0.5, manual: 0 }] });
assert.deepEqual(migrateMissionState(['d1', 'd2'], { completedOccurrences: [] }, '2026-08-05').completedOccurrences, ['d1@2026-08-05', 'd2@2026-08-05']);
const completed = completeMission({ id: 'd1', title: 'Daily', completed: false }, {}, '2026-08-05', 'manual');
assert.equal(completed.task.completed, true);
assert.equal(completed.state.completedOccurrences[0], 'd1@2026-08-05');
assert.equal(completed.state.completions[0].source, 'manual');

console.log('gamification.test.js: all assertions passed');
