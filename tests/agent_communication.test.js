const assert = require('node:assert/strict');
const {
  normalizeAgentEvent,
  createHandoffRecord,
  sortAgentEvents,
  renderAgentEventText,
} = require('../agent_communication.js');

const normalized = normalizeAgentEvent({
  id: ' evt-7 ',
  source: '  Athena  ',
  type: 'HANDOFF_READY',
  severity: 'HIGH',
  timestamp: '2026-08-04T10:30:00-04:00',
  title: '  Deliverable ready  ',
  message: '<script>alert("x")</script>',
});
assert.deepEqual(normalized, {
  id: 'evt-7',
  agent: 'athena',
  type: 'handoff_ready',
  severity: 'high',
  timestamp: '2026-08-04T14:30:00.000Z',
  message: '<script>alert("x")</script>',
  title: 'Deliverable ready',
});
assert.equal(normalizeAgentEvent(null), null);
assert.equal(normalizeAgentEvent({ id: 'x', agent: 'Nyx', type: 'status', timestamp: 'bad', message: 'nope' }), null);
assert.equal(normalizeAgentEvent({ id: 'x', source: 'Nyx', type: 'status', timestamp: '2026-08-04T10:00:00Z', title: 'ok' }).agent, 'nyx');
assert.equal(normalizeAgentEvent({ id: 'x', source: 'Nyx', type: 'status', timestamp: '2026-08-04T10:00:00Z', message: 'ok', severity: 'BOGUS' }).severity, 'info');

const handoffInput = {
  from: ' Athena ',
  to: 'ALICE',
  taskId: ' TQ-42 ',
  summary: ' Verify the lead dossier ',
  artifacts: [' dossier.md ', null, 'brief.txt '],
  status: 'ACCEPTED',
  createdAt: '2026-08-04T10:30:00-04:00',
};
const handoff = createHandoffRecord(handoffInput);
assert.deepEqual(handoff, {
  id: 'handoff:athena:alice:TQ-42',
  from: 'athena',
  to: 'alice',
  taskId: 'TQ-42',
  summary: 'Verify the lead dossier',
  artifacts: ['dossier.md', 'brief.txt'],
  status: 'accepted',
  createdAt: '2026-08-04T14:30:00.000Z',
});
assert.deepEqual(createHandoffRecord({ from: 'a', to: 'b', taskId: 't', summary: 's' }).artifacts, []);
for (const missing of ['from', 'to', 'taskId', 'summary']) {
  const input = { from: 'a', to: 'b', taskId: 't', summary: 's' };
  delete input[missing];
  assert.equal(createHandoffRecord(input), null);
}
assert.equal(createHandoffRecord({ from: 'a', to: 'b', taskId: 't', summary: 's', status: 'sent' }), null);
assert.deepEqual(createHandoffRecord({ from: 'a', to: 'b', taskId: 't', summary: 's', artifacts: 'not-array' }).artifacts, []);

const sorted = sortAgentEvents([
  { id: 'old', agent: 'a', type: 'status', timestamp: '2026-08-04T09:00:00Z', message: 'old' },
  { id: 'same-first', agent: 'a', type: 'status', timestamp: '2026-08-04T10:00:00Z', message: 'first' },
  { id: 'invalid', message: 'bad' },
  { id: 'new', agent: 'b', type: 'status', timestamp: '2026-08-04T11:00:00Z', message: 'new' },
  { id: 'same-second', agent: 'a', type: 'status', timestamp: '2026-08-04T10:00:00Z', message: 'second' },
]);
assert.deepEqual(sorted.map(event => event.id), ['new', 'same-first', 'same-second', 'old']);

const rendered = renderAgentEventText(normalized);
assert.equal(rendered, '[2026-08-04T14:30:00.000Z] ATHENA / HANDOFF_READY / HIGH — Deliverable ready: <script>alert("x")</script>');
assert.equal(typeof rendered, 'string');

console.log('agent_communication.test.js: all assertions passed');
