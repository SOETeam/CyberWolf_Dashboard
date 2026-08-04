const assert = require('node:assert/strict');
const {
  parseRefreshArtifact,
  mergeRefreshArtifact,
} = require('../dashboard_core.js');

const baseTask = {
  id: 'calendar-1',
  title: 'Calendar task',
  local_date: '2026-08-04',
  time_block: '09:30',
};

const accepted = parseRefreshArtifact({
  external_sync: false,
  tasks: [baseTask],
  today_tasks: [{ ...baseTask, _version: 2 }],
});
assert.deepEqual(accepted.tasks.map(task => task.id), ['calendar-1']);
assert.equal(accepted.todayTasks[0].sourceView, 'today');
assert.equal(accepted.tasks[0].priority, 'p1');

assert.equal(parseRefreshArtifact('{not json}'), null);
assert.equal(parseRefreshArtifact({ external_sync: true, tasks: [], today_tasks: [] }), null);
assert.equal(parseRefreshArtifact({ external_sync: false, tasks: [{ id: '' }], today_tasks: [] }), null);
assert.equal(parseRefreshArtifact({ external_sync: false, tasks: [], today_tasks: [{ title: 'missing id' }] }), null);

const merged = mergeRefreshArtifact(
  [
    { id: 'same', title: 'embedded old', _version: 1 },
    { id: 'keep', title: 'embedded' },
  ],
  {
    tasks: [{ id: 'same', title: 'artifact new', _version: 2 }, { id: 'added', title: 'artifact added' }],
    todayTasks: [{ id: 'added', title: 'artifact today', _version: 1 }],
  },
  [],
);
assert.deepEqual(merged.allTasks.map(task => task.id), ['same', 'keep', 'added']);
assert.equal(merged.allTasks.find(task => task.id === 'same').title, 'artifact new');
assert.equal(merged.todayTasks.filter(task => task.id === 'added').length, 1);

console.log('dashboard_refresh_artifact.test.js: all assertions passed');
