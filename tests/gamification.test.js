const assert = require('node:assert/strict');
const {
  calculateProgress,
  calculateStreak,
  awardBadges,
  campaignProgress,
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

console.log('gamification.test.js: all assertions passed');
