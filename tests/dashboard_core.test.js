const assert = require('node:assert/strict');
const {
  dedupeTasksById,
  computeTodayTasks,
  healthScore,
} = require('../dashboard_core.js');

const today = new Date('2026-08-04T12:00:00Z');

assert.deepEqual(
  dedupeTasksById([
    { id: 'a', _version: 1, title: 'old' },
    { id: 'a', _version: 3, title: 'new' },
    { id: 'a', _version: 2, title: 'middle' },
    { id: '', title: 'ignored' },
  ]).map(task => task.title),
  ['new']
);

const todayTasks = computeTodayTasks([
  { id: 'dated', due: '2026-08-04', _version: 1 },
  { id: 'recurring', due: 'daily' },
  { id: 'legacy-today', time_block: '09:00', sourceView: 'today' },
  { id: 'dated', due: '2026-08-04', _version: 2, title: 'latest' },
  { id: 'tomorrow', due: '2026-08-05' },
], today);
assert.deepEqual(todayTasks.map(task => task.id), ['dated', 'recurring', 'legacy-today']);
assert.equal(todayTasks.find(task => task.id === 'dated').title, 'latest');

assert.equal(healthScore({ priority: 'p0', due: '2026-08-01', last_updated: '2026-07-20' }, today), 15);
assert.equal(healthScore({ completed: true, priority: 'p0', due: '2026-07-01' }, today), 100);
for (const task of todayTasks) {
  const score = healthScore(task, today);
  assert.ok(score >= 0 && score <= 100);
}

console.log('dashboard_core.test.js: all assertions passed');
