const assert = require('node:assert/strict');
const {
  STATES,
  DEFAULT_CONFIG,
  createState,
  rewardTaskCompletion,
  exportState,
  importState,
  transition,
} = require('../wolf_companion_core.js');

assert.equal(STATES.IDLE, 'IDLE');
assert.equal(DEFAULT_CONFIG.maxSupplies, 10);

let state = createState();
assert.equal(state.state, STATES.HIDDEN);
assert.deepEqual(state.supplies, { Food: 0, Water: 0, Care: 0 });

let result = rewardTaskCompletion(state, 'task-1', { source: 'test' });
assert.equal(result.awarded, true);
assert.deepEqual(result.state.supplies, { Food: 1, Water: 1, Care: 1 });
assert.deepEqual(result.state.rewardLedger, { 'task-1': { Food: 1, Water: 1, Care: 1 } });

result = rewardTaskCompletion(result.state, 'task-1');
assert.equal(result.awarded, false);
assert.deepEqual(result.state.supplies, { Food: 1, Water: 1, Care: 1 });

result = rewardTaskCompletion(result.state, 'task-2', { rewards: { Food: 99, Water: 2, Care: 0 } }, { maxSupplies: 3 });
assert.equal(result.awarded, true);
assert.deepEqual(result.state.supplies, { Food: 3, Water: 3, Care: 1 });

const restored = importState(exportState(result.state));
assert.deepEqual(restored, result.state);
assert.equal(rewardTaskCompletion(result.state, '').awarded, false);
assert.equal(transition(result.state, 'call').state, STATES.CALLED);
assert.equal(transition(result.state, 'pause').state, STATES.PAUSED);

console.log('wolf_companion_core.test.js: all assertions passed');
