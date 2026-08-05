const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const dashboard = fs.readFileSync(path.join(root, 'dashboard.js'), 'utf8');
const expectedScripts = [
  'dashboard_core.js',
  'gamification.js',
  'priority_escalation.js',
  'agent_communication.js',
  'dashboard.js',
  'wolf_companion_core.js',
  'wolf_companion.js',
];

const scriptSources = [...index.matchAll(/<script\s+src="([^"]+)"\s*>/g)].map(match => match[1]);
const localSources = scriptSources.filter(source => !/^[a-z][a-z0-9+.-]*:/i.test(source) && !source.startsWith('//'));
assert.deepEqual(
  localSources.map(source => source.split('?')[0]),
  expectedScripts,
  'index.html must load all dashboard scripts in order',
);

const versions = localSources.map(source => new URL(source, 'https://example.test/').searchParams.get('v'));
assert.ok(versions.every(Boolean), 'every local dashboard script URL must have a version query parameter');
assert.equal(new Set(versions).size, 1, 'all dashboard scripts must share one deterministic asset version');

assert.match(
  dashboard,
  /function renderAgenda\(\)\s*\{[\s\S]*?if\s*\(!container\)[\s\S]*?console\.(?:error|warn)\(/,
  'renderAgenda must diagnose a missing agenda container instead of silently returning',
);

assert.match(index, /id="mission-create-form"/);
assert.match(index, /id="daily-progress-bar"/);
assert.match(index, /id="project-progress-bar"/);
assert.match(dashboard, /cyberwolf_mission_state_v1/);
assert.match(dashboard, /normalizeMissionTask/);

console.log('cache_regression.test.js: all assertions passed');
