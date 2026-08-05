const assert = require('node:assert/strict');
const {
  dedupeTasksById,
  computeTodayTasks,
  healthScore,
  getAgendaTasksForDate,
  getMonthGrid,
  getCalendarViewState,
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

const agendaTasks = getAgendaTasksForDate([
  { id: 'today', sourceView: 'today', time_block: '09:00' },
  { id: 'dated', due: '2026-08-05', time_block: '10:00' },
  { id: 'other', due: '2026-08-06', time_block: '11:00' },
  { id: 'daily', due: 'daily', time_block: '12:00' },
], '2026-08-05', '2026-08-04');
assert.deepEqual(agendaTasks.map(task => task.id), ['dated', 'daily']);
assert.deepEqual(getAgendaTasksForDate([
  { id: 'today', sourceView: 'today', time_block: '09:00' },
], '2026-08-04', '2026-08-04').map(task => task.id), ['today']);

const monthGrid = getMonthGrid('2026-08-05');
assert.equal(monthGrid.length, 42);
assert.equal(monthGrid.find(cell => cell.date === '2026-08-05').isCurrentMonth, true);
assert.equal(monthGrid[0].weekday, 0);

assert.deepEqual(getCalendarViewState('agenda', '2026-08-05', '2026-08'), {
  view: 'agenda', agendaDate: '2026-08-05', calendarMonth: '2026-08'
});
assert.deepEqual(getCalendarViewState('calendar', '2026-08-05', '2026-08'), {
  view: 'calendar', agendaDate: '2026-08-05', calendarMonth: '2026-08'
});

console.log('dashboard_core.test.js: all assertions passed');
