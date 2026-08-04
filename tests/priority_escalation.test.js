const assert = require('node:assert/strict');
const {
  daysBetweenDates,
  urgencyLevel,
  escalatePriority,
  sortByEscalatedUrgency,
} = require('../priority_escalation.js');

const reference = '2026-08-04';

assert.equal(daysBetweenDates('2026-08-01', reference), 3);
assert.equal(daysBetweenDates(reference, '2026-08-01'), -3);
assert.equal(daysBetweenDates('2026-02-30', reference), null);
assert.equal(daysBetweenDates('2026-08-04T12:00:00Z', reference), null);

assert.equal(urgencyLevel({ id: 'overdue-critical', due: '2026-08-01', priority: 'p3' }, reference), 'critical');
assert.equal(urgencyLevel({ id: 'overdue-urgent', due: '2026-08-02', priority: 'p3' }, reference), 'urgent');
assert.equal(urgencyLevel({ id: 'today-p0', due: reference, priority: 'p0' }, reference), 'critical');
assert.equal(urgencyLevel({ id: 'today-p2', due: reference, priority: 'p2' }, reference), 'urgent');
assert.equal(urgencyLevel({ id: 'soon', due: '2026-08-06', priority: 'p3' }, reference), 'urgent');
assert.equal(urgencyLevel({ id: 'watch', due: '2026-08-11', priority: 'p3' }, reference), 'watch');
assert.equal(urgencyLevel({ id: 'inactive', priority: 'p3', last_updated: '2026-08-01' }, reference), 'watch');
assert.equal(urgencyLevel({ id: 'normal', due: '2026-08-20', priority: 'p3' }, reference), 'normal');
assert.equal(urgencyLevel({ id: 'done', due: '2026-08-01', status: 'completed' }, reference), 'normal');
assert.equal(urgencyLevel({ id: 'bad', due: 'not-a-date', last_updated: 'also-bad' }, reference), 'normal');

const original = { id: 'a', due: '2026-08-02', priority: 'p3', title: 'keep' };
const escalated = escalatePriority(original, reference);
assert.notEqual(escalated, original);
assert.deepEqual(original, { id: 'a', due: '2026-08-02', priority: 'p3', title: 'keep' });
assert.equal(escalated.basePriority, 'p3');
assert.equal(escalated.priority, 'p1');
assert.equal(escalated.urgency, 'urgent');
assert.equal(escalatePriority({ id: 'p0', due: '2026-08-20', priority: 'p0' }, reference).priority, 'p0');
assert.equal(escalatePriority({ id: 'done', due: '2026-08-01', priority: 'p0', completed: true }, reference).priority, 'p0');
assert.equal(escalatePriority({ id: 'bad' }, reference).priority, 'p3');

const sorted = sortByEscalatedUrgency([
  { id: 'watch-late', due: '2026-08-11', priority: 'p3' },
  { id: 'urgent-late', due: '2026-08-06', priority: 'p3' },
  { id: 'urgent-early', due: '2026-08-05', priority: 'p3' },
  { id: 'critical', due: '2026-08-01', priority: 'p3' },
  { id: 'same-1', due: '2026-08-20', priority: 'p3' },
  { id: 'same-2', due: '2026-08-20', priority: 'p3' },
], reference);
assert.deepEqual(sorted.map(task => task.id), ['critical', 'urgent-early', 'urgent-late', 'watch-late', 'same-1', 'same-2']);
assert.equal(new Set(sorted.map(task => task.id)).size, sorted.length);

console.log('priority_escalation.test.js: all assertions passed');
