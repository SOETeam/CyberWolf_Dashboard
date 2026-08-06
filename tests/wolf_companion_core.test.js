const assert = require('node:assert/strict');
const {
  STATES, DEFAULT_CONFIG, SPRITE_SIZE, PALETTE,
  IDLE_FRAME, WALK_A_FRAME, WALK_B_FRAME, WALK_FRAMES,
  getFrameBlocks, getWalkFrame, getPalette,
  createState, clampPosition, transition,
  visibleSurface, entryEdge, exportState, importState,
  rewardTaskCompletion
} = require('../wolf_companion_core.js');

let passCount = 0;
let failCount = 0;

function test(name, fn) {
  try { fn(); passCount++; console.log(`  \u2713 ${name}`); }
  catch (e) { failCount++; console.error(`  \u2717 ${name}: ${e.message}`); }
}

/* ─── Pixel-grid helper ─── */
function pixelSet(blocks) {
  const set = new Set();
  blocks.forEach(([col, x, y, w, h]) => {
    for (let dy = 0; dy < h; dy++)
      for (let dx = 0; dx < w; dx++)
        set.add(`${x+dx},${y+dy},${col}`);
  });
  return set;
}

function hasColorInRegion(blocks, color, xMin, yMin, xMax, yMax) {
  const pixels = pixelSet(blocks);
  for (const p of pixels) {
    const [x, y, col] = p.split(',');
    const nx = Number(x), ny = Number(y);
    if (col === color && nx >= xMin && nx <= xMax && ny >= yMin && ny <= yMax) return true;
  }
  return false;
}

function countLegColumns(blocks) {
  const pixels = pixelSet(blocks);
  const cols = new Set();
  for (const p of pixels) {
    const [x, y, col] = p.split(',');
    const nx = Number(x), ny = Number(y);
    if ((col === 'BLACK' || col === 'CYAN') && ny >= 18 && ny <= 21) {
      cols.add(nx);
    }
  }
  // Count contiguous x-column groups
  const sorted = [...cols].sort((a, b) => a - b);
  let groups = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (i === 0 || sorted[i] > sorted[i-1] + 1) groups++;
  }
  return groups;
}

/* ─── Sprite size ─── */
test('SPRITE_SIZE is 24', () => assert.equal(SPRITE_SIZE, 24));

/* ─── Palette ─── */
test('palette has 4 colors', () => {
  const keys = Object.keys(PALETTE);
  assert.equal(keys.length, 4);
  assert.ok(keys.includes('BLACK'));
  assert.ok(keys.includes('DARK'));
  assert.ok(keys.includes('CYAN'));
  assert.ok(keys.includes('MAGENTA'));
});
test('palette colors are valid hex', () => {
  Object.values(PALETTE).forEach(c => assert.match(c, /^#[0-9a-f]{6}$/));
});
test('getPalette() returns same object', () => assert.equal(getPalette(), PALETTE));

/* ─── getFrameBlocks ─── */
test('getFrameBlocks IDLE returns IDLE_FRAME', () => assert.equal(getFrameBlocks('IDLE'), IDLE_FRAME));
test('getFrameBlocks WALK_A returns WALK_A_FRAME', () => assert.equal(getFrameBlocks('WALK_A'), WALK_A_FRAME));
test('getFrameBlocks WALK_B returns WALK_B_FRAME', () => assert.equal(getFrameBlocks('WALK_B'), WALK_B_FRAME));
test('getFrameBlocks unknown returns IDLE_FRAME', () => assert.equal(getFrameBlocks('NOPE'), IDLE_FRAME));

/* ─── Frame block integrity ─── */
function validateBlocks(blocks, label) {
  blocks.forEach((b, i) => {
    const [col, x, y, w, h] = b;
    assert.ok(PALETTE[col] !== undefined, `${label} block[${i}]: unknown color '${col}'`);
    assert.ok(x >= 0 && x < SPRITE_SIZE, `${label} block[${i}]: x=${x} out of [0,${SPRITE_SIZE-1}]`);
    assert.ok(y >= 0 && y < SPRITE_SIZE, `${label} block[${i}]: y=${y} out of [0,${SPRITE_SIZE-1}]`);
    assert.ok(w > 0, `${label} block[${i}]: w=${w} must be >0`);
    assert.ok(h > 0, `${label} block[${i}]: h=${h} must be >0`);
    assert.ok(x + w <= SPRITE_SIZE, `${label} block[${i}]: x+w=${x+w} exceeds ${SPRITE_SIZE}`);
    assert.ok(y + h <= SPRITE_SIZE, `${label} block[${i}]: y+h=${y+h} exceeds ${SPRITE_SIZE}`);
  });
}
test('IDLE_FRAME blocks are valid', () => validateBlocks(IDLE_FRAME, 'IDLE'));
test('WALK_A_FRAME blocks are valid', () => validateBlocks(WALK_A_FRAME, 'WALK_A'));
test('WALK_B_FRAME blocks are valid', () => validateBlocks(WALK_B_FRAME, 'WALK_B'));
test('IDLE_FRAME has blocks', () => assert.ok(IDLE_FRAME.length > 0));
test('WALK_FRAMES has 2 entries', () => assert.equal(WALK_FRAMES.length, 2));

/* ─── Frame pixel output differs ─── */
test('IDLE and WALK_A pixel sets differ', () => {
  const s1 = pixelSet(IDLE_FRAME), s2 = pixelSet(WALK_A_FRAME);
  let diff = false;
  for (const p of s1) { if (!s2.has(p)) { diff = true; break; } }
  for (const p of s2) { if (!s1.has(p)) { diff = true; break; } }
  assert.ok(diff, 'IDLE and WALK_A should differ in at least one pixel');
});
test('WALK_A and WALK_B pixel sets differ', () => {
  const s1 = pixelSet(WALK_A_FRAME), s2 = pixelSet(WALK_B_FRAME);
  let diff = false;
  for (const p of s1) { if (!s2.has(p)) { diff = true; break; } }
  for (const p of s2) { if (!s1.has(p)) { diff = true; break; } }
  assert.ok(diff, 'WALK_A and WALK_B should differ in at least one pixel');
});

/* ─── Walk frame alternation ─── */
test('getWalkFrame(0) returns WALK_A', () => assert.equal(getWalkFrame(0), WALK_A_FRAME));
test('getWalkFrame(1) returns WALK_B', () => assert.equal(getWalkFrame(1), WALK_B_FRAME));
test('getWalkFrame(2) returns WALK_A', () => assert.equal(getWalkFrame(2), WALK_A_FRAME));
test('getWalkFrame(3) returns WALK_B', () => assert.equal(getWalkFrame(3), WALK_B_FRAME));
test('getWalkFrame(-1) returns WALK_B (safe mod)', () => assert.equal(getWalkFrame(-1), WALK_B_FRAME));

/* ─── Body parts: IDLE_FRAME ─── */
test('IDLE_FRAME has a head (BLACK in x=15-22, y=5-15)', () => {
  assert.ok(hasColorInRegion(IDLE_FRAME, 'BLACK', 15, 5, 22, 15), 'head region missing BLACK');
});
test('IDLE_FRAME has ears (CYAN in x=19-22, y=0-4)', () => {
  assert.ok(hasColorInRegion(IDLE_FRAME, 'CYAN', 19, 0, 22, 4), 'ear region missing CYAN');
});
test('IDLE_FRAME has a muzzle (BLACK in x=22-23, y=10-14)', () => {
  assert.ok(hasColorInRegion(IDLE_FRAME, 'BLACK', 22, 10, 23, 14), 'muzzle region missing BLACK');
});
test('IDLE_FRAME has a body (BLACK in x=4-15, y=7-17)', () => {
  assert.ok(hasColorInRegion(IDLE_FRAME, 'BLACK', 4, 7, 15, 17), 'body region missing BLACK');
});
test('IDLE_FRAME has four legs (\u22654 column groups in y=17-22)', () => {
  const groups = countLegColumns(IDLE_FRAME);
  assert.ok(groups >= 4, `IDLE_FRAME has ${groups} leg column groups, expected >=4`);
});
test('IDLE_FRAME has a tail (MAGENTA in x=0-3, y=0-4)', () => {
  assert.ok(hasColorInRegion(IDLE_FRAME, 'MAGENTA', 0, 0, 3, 4), 'tail region missing MAGENTA');
});
test('IDLE_FRAME tail connects (BLACK in x=0-2, y=5-16)', () => {
  assert.ok(hasColorInRegion(IDLE_FRAME, 'BLACK', 0, 5, 2, 16), 'tail body missing BLACK connection');
});

/* ─── Body parts: WALK_A_FRAME ─── */
test('WALK_A_FRAME has a head', () => {
  assert.ok(hasColorInRegion(WALK_A_FRAME, 'BLACK', 15, 5, 22, 15));
});
test('WALK_A_FRAME has ears', () => {
  assert.ok(hasColorInRegion(WALK_A_FRAME, 'CYAN', 19, 0, 22, 4));
});
test('WALK_A_FRAME has a muzzle', () => {
  assert.ok(hasColorInRegion(WALK_A_FRAME, 'BLACK', 22, 10, 23, 14));
});
test('WALK_A_FRAME has a body', () => {
  assert.ok(hasColorInRegion(WALK_A_FRAME, 'BLACK', 4, 7, 15, 17));
});
test('WALK_A_FRAME has four legs', () => {
  const groups = countLegColumns(WALK_A_FRAME);
  assert.ok(groups >= 4, `WALK_A_FRAME has ${groups} leg column groups, expected >=4`);
});
test('WALK_A_FRAME has a tail', () => {
  assert.ok(hasColorInRegion(WALK_A_FRAME, 'MAGENTA', 0, 0, 3, 4));
});

/* ─── Body parts: WALK_B_FRAME ─── */
test('WALK_B_FRAME has a head', () => {
  assert.ok(hasColorInRegion(WALK_B_FRAME, 'BLACK', 15, 5, 22, 15));
});
test('WALK_B_FRAME has ears', () => {
  assert.ok(hasColorInRegion(WALK_B_FRAME, 'CYAN', 19, 0, 22, 4));
});
test('WALK_B_FRAME has a muzzle', () => {
  assert.ok(hasColorInRegion(WALK_B_FRAME, 'BLACK', 22, 10, 23, 14));
});
test('WALK_B_FRAME has a body', () => {
  assert.ok(hasColorInRegion(WALK_B_FRAME, 'BLACK', 4, 7, 15, 17));
});
test('WALK_B_FRAME has four legs', () => {
  const groups = countLegColumns(WALK_B_FRAME);
  assert.ok(groups >= 4, `WALK_B_FRAME has ${groups} leg column groups, expected >=4`);
});
test('WALK_B_FRAME has a tail', () => {
  assert.ok(hasColorInRegion(WALK_B_FRAME, 'MAGENTA', 0, 0, 3, 4));
});

/* ─── Movement bounds ─── */
test('clampPosition within bounds stays unchanged', () => {
  const result = clampPosition({x: 10, y: 5}, {width: 100, height: 100}, {width: 24, height: 24});
  assert.equal(result.x, 10);
  assert.equal(result.y, 5);
});
test('clampPosition negative x clamped to 0', () => {
  const result = clampPosition({x: -5, y: 10}, {width: 100, height: 100}, {width: 24, height: 24});
  assert.equal(result.x, 0);
});
test('clampPosition x beyond maxX clamped', () => {
  const result = clampPosition({x: 200, y: 10}, {width: 100, height: 100}, {width: 24, height: 24});
  assert.equal(result.x, 100 - 24);
});
test('clampPosition y beyond maxY clamped', () => {
  const result = clampPosition({x: 10, y: 200}, {width: 100, height: 100}, {width: 24, height: 24});
  assert.equal(result.y, 100 - 24);
});
test('clampPosition zero-size bounds clamped to 0', () => {
  const result = clampPosition({x: 50, y: 50}, {width: 0, height: 0}, {width: 24, height: 24});
  assert.equal(result.x, 0);
  assert.equal(result.y, 0);
});

/* ─── visibleSurface ─── */
test('visibleSurface returns correct bounds', () => {
  const s = visibleSurface({width: 500, height: 400}, {width: 48, height: 48}, 10);
  assert.equal(s.left, 10);
  assert.equal(s.top, 10);
  assert.equal(s.right, 442);
  assert.equal(s.bottom, 342);
});

/* ─── entryEdge ─── */
test('entryEdge right returns outside-right', () => {
  const e = entryEdge({width: 500, height: 400}, {width: 48, height: 48}, 'right');
  assert.equal(e.x, 500);
  assert.ok(e.y > 0);
});

/* ─── State machine ─── */
test('STATES.IDLE is IDLE', () => assert.equal(STATES.IDLE, 'IDLE'));
test('STATES has all 8 required states', () => {
  const required = ['HIDDEN','ENTERING','IDLE','ROAMING','CALLED','CELEBRATING','EXITING','PAUSED'];
  required.forEach(s => assert.ok(Object.values(STATES).includes(s), `Missing state: ${s}`));
});
test('transition call works', () => {
  const s = createState();
  const r = transition(s, 'call');
  assert.equal(r.state, STATES.CALLED);
  assert.equal(r.changed, true);
});
test('transition pause/resume works', () => {
  let s = createState({ state: STATES.IDLE });
  let r = transition(s, 'pause');
  assert.equal(r.state, STATES.PAUSED);
  s = Object.assign({}, s, { state: STATES.PAUSED });
  r = transition(s, 'resume');
  assert.equal(r.state, STATES.IDLE);
});
test('transition unknown event returns unchanged', () => {
  const s = createState({ state: STATES.IDLE });
  const r = transition(s, 'nope');
  assert.equal(r.state, STATES.IDLE);
  assert.equal(r.changed, false);
});

/* ─── Serialization ─── */
test('exportState round-trips', () => {
  const s = createState({ state: STATES.ROAMING, position: {x: 42, y: 99} });
  const json = exportState(s);
  const restored = importState(json);
  assert.equal(restored.state, STATES.ROAMING);
  assert.equal(restored.position.x, 42);
  assert.equal(restored.position.y, 99);
});
test('importState bad input returns HIDDEN', () => {
  const s = importState('garbage');
  assert.equal(s.state, STATES.HIDDEN);
});
test('importState null returns HIDDEN', () => {
  const s = importState(null);
  assert.equal(s.state, STATES.HIDDEN);
});

/* ─── Reward system ─── */
test('rewardTaskCompletion awards and increments supplies', () => {
  const s = createState({ supplies: {Food: 0, Water: 0, Care: 0} });
  const r = rewardTaskCompletion(s, 'task-1', {}, DEFAULT_CONFIG);
  assert.equal(r.awarded, true);
  assert.equal(r.state.supplies.Food, 1);
  assert.equal(r.state.supplies.Water, 1);
  assert.equal(r.state.supplies.Care, 1);
});
test('rewardTaskCompletion duplicate taskId returns awarded=false', () => {
  const s = createState({ supplies: {Food: 0, Water: 0, Care: 0} });
  const r1 = rewardTaskCompletion(s, 'task-dup', {}, DEFAULT_CONFIG);
  assert.equal(r1.awarded, true);
  const r2 = rewardTaskCompletion(r1.state, 'task-dup', {}, DEFAULT_CONFIG);
  assert.equal(r2.awarded, false);
});
test('rewardTaskCompletion caps at maxSupplies', () => {
  const s = createState({ supplies: {Food: 9, Water: 9, Care: 9} });
  const r = rewardTaskCompletion(s, 'task-cap', {}, DEFAULT_CONFIG);
  assert.equal(r.state.supplies.Food, 10);
  assert.equal(r.state.supplies.Water, 10);
  assert.equal(r.state.supplies.Care, 10);
});

/* ─── Summary ─── */
console.log(`\n${passCount}/${passCount+failCount} tests passed${failCount ? ', ' + failCount + ' FAILED' : ''}`);
if (failCount) process.exit(1);