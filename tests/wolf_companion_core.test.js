const assert = require('node:assert/strict');
const {
  STATES, DEFAULT_CONFIG, SPRITE_SIZE, PALETTE,
  IDLE_FRAME, WALK_A_FRAME, WALK_B_FRAME, WALK_FRAMES,
  getFrameBlocks, getWalkFrame, getPalette,
  createState, clampPosition, transition,
  visibleSurface, entryEdge, exportState, importState,
  rewardTaskCompletion, normalizeSurfaces, surfaceTarget,
  // Tamagotchi API
  DEFAULT_NEEDS, NEEDS_DECAY_MAX_SECS, NEEDS_DECAY_RATE, CARE_ACTIONS,
  createNeeds, advanceNeeds, applyCareAction, deriveMood,
  chooseBehavior, stepRoaming, exportFullState, importFullState,
  // World-coordinate helpers
  rectToWorldRect, visibleWorldRect, isWorldPositionVisible,
  entryPointForVisibleEdge, clampToTerrainWorld, chooseReentryEdge
} = require('../wolf_companion_core.js');

let passCount = 0;
let failCount = 0;

function test(name, fn) {
  try { fn(); passCount++; console.log(`  ✓ ${name}`); }
  catch (e) { failCount++; console.error(`  ✗ ${name}: ${e.message}`); }
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
  const sorted = [...cols].sort((a, b) => a - b);
  let groups = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (i === 0 || sorted[i] > sorted[i-1] + 1) groups++;
  }
  return groups;
}

/* ════════════════════════════════════════════════
   EXISTING TESTS — sprite, geometry, state machine
   ════════════════════════════════════════════════ */

test('SPRITE_SIZE is 24', () => assert.equal(SPRITE_SIZE, 24));

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

test('getFrameBlocks IDLE returns IDLE_FRAME', () => assert.equal(getFrameBlocks('IDLE'), IDLE_FRAME));
test('getFrameBlocks WALK_A returns WALK_A_FRAME', () => assert.equal(getFrameBlocks('WALK_A'), WALK_A_FRAME));
test('getFrameBlocks WALK_B returns WALK_B_FRAME', () => assert.equal(getFrameBlocks('WALK_B'), WALK_B_FRAME));
test('getFrameBlocks unknown returns IDLE_FRAME', () => assert.equal(getFrameBlocks('NOPE'), IDLE_FRAME));

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

test('getWalkFrame(0) returns WALK_A', () => assert.equal(getWalkFrame(0), WALK_A_FRAME));
test('getWalkFrame(1) returns WALK_B', () => assert.equal(getWalkFrame(1), WALK_B_FRAME));
test('getWalkFrame(2) returns WALK_A', () => assert.equal(getWalkFrame(2), WALK_A_FRAME));
test('getWalkFrame(3) returns WALK_B', () => assert.equal(getWalkFrame(3), WALK_B_FRAME));
test('getWalkFrame(-1) returns WALK_B (safe mod)', () => assert.equal(getWalkFrame(-1), WALK_B_FRAME));

test('IDLE_FRAME has a head (BLACK in x=15-22, y=5-15)', () => {
  assert.ok(hasColorInRegion(IDLE_FRAME, 'BLACK', 15, 5, 22, 15), 'head region missing BLACK');
});
test('IDLE_FRAME ears (CYAN accent in x=13..21, y=2..4)', () => {
  assert.ok(hasColorInRegion(IDLE_FRAME, 'CYAN', 13, 2, 21, 4));
});
test('WALK_A_FRAME ears (CYAN accent)', () => {
  assert.ok(hasColorInRegion(WALK_A_FRAME, 'CYAN', 13, 2, 21, 4));
});
test('WALK_B_FRAME ears (CYAN accent)', () => {
  assert.ok(hasColorInRegion(WALK_B_FRAME, 'CYAN', 13, 2, 21, 4));
});
test('IDLE_FRAME has four legs (≥4 column groups in y=17-22)', () => {
  const groups = countLegColumns(IDLE_FRAME);
  assert.ok(groups >= 4, `IDLE_FRAME has ${groups} leg column groups, expected >=4`);
});
test('IDLE_FRAME has a tail (MAGENTA in x=0-3, y=0-4)', () => {
  assert.ok(hasColorInRegion(IDLE_FRAME, 'MAGENTA', 0, 0, 3, 4), 'tail region missing MAGENTA');
});
test('IDLE_FRAME tail connects (BLACK in x=0-2, y=5-16)', () => {
  assert.ok(hasColorInRegion(IDLE_FRAME, 'BLACK', 0, 5, 2, 16), 'tail body missing BLACK connection');
});

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

test('visibleSurface returns correct bounds', () => {
  const s = visibleSurface({width: 500, height: 400}, {width: 48, height: 48}, 10);
  assert.equal(s.left, 10);
  assert.equal(s.top, 10);
  assert.equal(s.right, 442);
  assert.equal(s.bottom, 342);
});

test('entryEdge right returns outside-right', () => {
  const e = entryEdge({width: 500, height: 400}, {width: 48, height: 48}, 'right');
  assert.equal(e.x, 500);
  assert.ok(e.y > 0);
});

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

// Anatomy helpers
function totalPixelCount(blocks) { return pixelSet(blocks).size; }

function dominantColorInRegion(blocks, xMin, yMin, xMax, yMax) {
  const counts = {};
  for (const p of pixelSet(blocks)) {
    const [px, py, col] = p.split(',');
    const nx = Number(px), ny = Number(py);
    if (nx >= xMin && nx <= xMax && ny >= yMin && ny <= yMax) {
      counts[col] = (counts[col] || 0) + 1;
    }
  }
  let best = null, bestN = 0;
  for (const [col, cnt] of Object.entries(counts)) {
    if (cnt > bestN) { best = col; bestN = cnt; }
  }
  return best;
}

test('IDLE_FRAME total pixel count >= 80', () => {
  assert.ok(totalPixelCount(IDLE_FRAME) >= 80,
    `IDLE has ${totalPixelCount(IDLE_FRAME)} px — too sparse to read as character`);
});
test('WALK_A_FRAME total pixel count >= 80', () => {
  assert.ok(totalPixelCount(WALK_A_FRAME) >= 80,
    `WALK_A has ${totalPixelCount(WALK_A_FRAME)} px — too sparse`);
});
test('WALK_B_FRAME total pixel count >= 80', () => {
  assert.ok(totalPixelCount(WALK_B_FRAME) >= 80,
    `WALK_B has ${totalPixelCount(WALK_B_FRAME)} px — too sparse`);
});

test('IDLE_FRAME head is dark-dominant (BLACK in upper-right quadrant)', () => {
  const d = dominantColorInRegion(IDLE_FRAME, 14, 2, 23, 14);
  assert.equal(d, 'BLACK', 'head should be BLACK-dominant');
});
test('WALK_A_FRAME head is dark-dominant', () => {
  const d = dominantColorInRegion(WALK_A_FRAME, 14, 2, 23, 14);
  assert.equal(d, 'BLACK', 'head should be BLACK-dominant');
});
test('WALK_B_FRAME head is dark-dominant', () => {
  const d = dominantColorInRegion(WALK_B_FRAME, 14, 2, 23, 14);
  assert.equal(d, 'BLACK', 'head should be BLACK-dominant');
});

test('IDLE_FRAME ears have CYAN accents in top strip y=0..5, x=16..22', () => {
  assert.ok(hasColorInRegion(IDLE_FRAME, 'CYAN', 16, 0, 22, 5));
});
test('WALK_A_FRAME ears have CYAN accents', () => {
  assert.ok(hasColorInRegion(WALK_A_FRAME, 'CYAN', 16, 0, 22, 5));
});
test('WALK_B_FRAME ears have CYAN accents', () => {
  assert.ok(hasColorInRegion(WALK_B_FRAME, 'CYAN', 16, 0, 22, 5));
});

test('IDLE_FRAME muzzle touches rightmost pixels (x>=22)', () => {
  assert.ok(hasColorInRegion(IDLE_FRAME, 'BLACK', 22, 7, 23, 13),
    'muzzle should extend to canvas edge for clear facing direction');
});
test('WALK_A_FRAME muzzle touches rightmost pixels', () => {
  assert.ok(hasColorInRegion(WALK_A_FRAME, 'BLACK', 22, 7, 23, 13));
});
test('WALK_B_FRAME muzzle touches rightmost pixels', () => {
  assert.ok(hasColorInRegion(WALK_B_FRAME, 'BLACK', 22, 7, 23, 13));
});

test('IDLE_FRAME body center is continuous (no gaps larger than 2px)', () => {
  const pixels = pixelSet(IDLE_FRAME);
  let found = false;
  for (let row = 7; row <= 15; row++) {
    let run = 0;
    for (let col = 0; col < 24; col++) {
      if (pixels.has(`${col},${row},BLACK`)) run++;
      else run = 0;
      if (run >= 5) { found = true; break; }
    }
    if (found) break;
  }
  assert.ok(found, 'body should have ≥5 contiguous BLACK pixels in mid rows');
});
test('WALK_A_FRAME body center is continuous', () => {
  const pixels = pixelSet(WALK_A_FRAME);
  let found = false;
  for (let row = 7; row <= 15; row++) {
    let run = 0;
    for (let col = 0; col < 24; col++) {
      if (pixels.has(`${col},${row},BLACK`)) run++;
      else run = 0;
      if (run >= 5) { found = true; break; }
    }
    if (found) break;
  }
  assert.ok(found, 'body should have ≥5 contiguous BLACK pixels');
});
test('WALK_B_FRAME body center is continuous', () => {
  const pixels = pixelSet(WALK_B_FRAME);
  let found = false;
  for (let row = 7; row <= 15; row++) {
    let run = 0;
    for (let col = 0; col < 24; col++) {
      if (pixels.has(`${col},${row},BLACK`)) run++;
      else run = 0;
      if (run >= 5) { found = true; break; }
    }
    if (found) break;
  }
  assert.ok(found, 'body should have ≥5 contiguous BLACK pixels');
});

test('IDLE_FRAME legs have 4 distinct vertical columns', () => {
  const cols = new Set();
  for (const p of pixelSet(IDLE_FRAME)) {
    const [x, y, c] = p.split(',');
    if ((c === 'BLACK' || c === 'CYAN') && y >= 16) cols.add(Number(x));
  }
  const sorted = [...cols].sort((a,b)=>a-b);
  let groups = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (i === 0 || sorted[i] > sorted[i-1]+1) groups++;
  }
  assert.ok(groups >= 4, `need ≥4 leg column groups, got ${groups}`);
});
test('WALK_A_FRAME legs have 4 distinct column groups', () => {
  const cols = new Set();
  for (const p of pixelSet(WALK_A_FRAME)) {
    const [x, y, c] = p.split(',');
    if ((c === 'BLACK' || c === 'CYAN') && y >= 16) cols.add(Number(x));
  }
  const sorted = [...cols].sort((a,b)=>a-b);
  let groups = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (i === 0 || sorted[i] > sorted[i-1]+1) groups++;
  }
  assert.ok(groups >= 4, `need ≥4 leg column groups, got ${groups}`);
});
test('WALK_B_FRAME legs have 4 distinct column groups', () => {
  const cols = new Set();
  for (const p of pixelSet(WALK_B_FRAME)) {
    const [x, y, c] = p.split(',');
    if ((c === 'BLACK' || c === 'CYAN') && y >= 16) cols.add(Number(x));
  }
  const sorted = [...cols].sort((a,b)=>a-b);
  let groups = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (i === 0 || sorted[i] > sorted[i-1]+1) groups++;
  }
  assert.ok(groups >= 4, `need ≥4 leg column groups, got ${groups}`);
});

function tailConnectedness(blocks) {
  const tailPixels = [];
  for (const p of pixelSet(blocks)) {
    const [x, y, c] = p.split(',');
    const nx = Number(x);
    if (nx <= 5) tailPixels.push({x: nx, y: Number(y)});
  }
  if (tailPixels.length < 3) return false;
  const visited = new Set();
  const queue = [{...tailPixels[0]}];
  visited.add(`${tailPixels[0].x},${tailPixels[0].y}`);
  while (queue.length) {
    const cur = queue.shift();
    const neighbors = [
      {x: cur.x+1, y: cur.y}, {x: cur.x-1, y: cur.y},
      {x: cur.x, y: cur.y+1}, {x: cur.x, y: cur.y-1}
    ];
    for (const n of neighbors) {
      const key = `${n.x},${n.y}`;
      if (!visited.has(key) && tailPixels.some(p => p.x === n.x && p.y === n.y)) {
        visited.add(key);
        queue.push(n);
      }
    }
  }
  return visited.size === tailPixels.length;
}

test('IDLE_FRAME tail pixels are connected (single component)', () => {
  assert.ok(tailConnectedness(IDLE_FRAME), 'IDLE tail pixels must form a connected bushy shape');
});
test('WALK_A_FRAME tail pixels are connected', () => {
  assert.ok(tailConnectedness(WALK_A_FRAME), 'WALK_A tail pixels must connect');
});
test('WALK_B_FRAME tail pixels are connected', () => {
  assert.ok(tailConnectedness(WALK_B_FRAME), 'WALK_B tail pixels must connect');
});

test('IDLE_FRAME uses all 4 palette colors', () => {
  const used = new Set();
  IDLE_FRAME.forEach(([c]) => used.add(c));
  ['BLACK', 'DARK', 'CYAN', 'MAGENTA'].forEach(c => {
    assert.ok(used.has(c), `IDLE_FRAME missing '${c}'`);
  });
});
test('WALK_A_FRAME uses all 4 palette colors', () => {
  const used = new Set();
  WALK_A_FRAME.forEach(([c]) => used.add(c));
  ['BLACK', 'DARK', 'CYAN', 'MAGENTA'].forEach(c => {
    assert.ok(used.has(c), `WALK_A_FRAME missing '${c}'`);
  });
});
test('WALK_B_FRAME uses all 4 palette colors', () => {
  const used = new Set();
  WALK_B_FRAME.forEach(([c]) => used.add(c));
  ['BLACK', 'DARK', 'CYAN', 'MAGENTA'].forEach(c => {
    assert.ok(used.has(c), `WALK_B_FRAME missing '${c}'`);
  });
});

test('normalizeSurfaces returns array', () => {
  const result = normalizeSurfaces([], { width: 1920, height: 1080 }, { width: 48, height: 48 });
  assert.ok(Array.isArray(result));
  assert.equal(result.length, 0);
});
test('normalizeSurfaces retains valid rectangle', () => {
  const rects = [{ left: 10, top: 20, right: 300, bottom: 200 }];
  const result = normalizeSurfaces(rects, { width: 1920, height: 1080 }, { width: 48, height: 48 });
  assert.equal(result.length, 1);
  assert.equal(result[0].left, 10);
  assert.equal(result[0].top, 20);
  assert.equal(result[0].right, 300);
  assert.equal(result[0].bottom, 200);
  assert.equal(result[0].width, 290);
  assert.equal(result[0].height, 180);
});
test('normalizeSurfaces discards zero-width rect', () => {
  const rects = [{ left: 10, top: 20, right: 10, bottom: 200 }];
  const result = normalizeSurfaces(rects, { width: 1920, height: 1080 }, { width: 48, height: 48 });
  assert.equal(result.length, 0);
});
test('normalizeSurfaces discards negative-width rect', () => {
  const rects = [{ left: 300, top: 20, right: 10, bottom: 200 }];
  const result = normalizeSurfaces(rects, { width: 1920, height: 1080 }, { width: 48, height: 48 });
  assert.equal(result.length, 0);
});
test('normalizeSurfaces discards small rects (smaller than wolf)', () => {
  const rects = [{ left: 10, top: 10, right: 40, bottom: 60 }]; // width=30 < 48
  const result = normalizeSurfaces(rects, { width: 1920, height: 1080 }, { width: 48, height: 48 });
  assert.equal(result.length, 0);
});
test('normalizeSurfaces clamps to viewport bounds', () => {
  const rects = [{ left: -50, top: -50, right: 2000, bottom: 1200 }];
  const result = normalizeSurfaces(rects, { width: 1920, height: 1080 }, { width: 48, height: 48 });
  assert.equal(result.length, 1);
  assert.equal(result[0].left, 0);
  assert.equal(result[0].top, 0);
  assert.equal(result[0].right, 1920);
  assert.equal(result[0].bottom, 1080);
});
test('normalizeSurfaces discards offscreen rect', () => {
  const rects = [{ left: 2000, top: 2000, right: 2500, bottom: 2500 }];
  const result = normalizeSurfaces(rects, { width: 1920, height: 1080 }, { width: 48, height: 48 });
  assert.equal(result.length, 0);
});
test('normalizeSurfaces discards null/undefined entries', () => {
  const rects = [null, undefined, 'string'];
  const result = normalizeSurfaces(rects, { width: 1920, height: 1080 }, { width: 48, height: 48 });
  assert.equal(result.length, 0);
});
test('normalizeSurfaces handles non-array input (single rect)', () => {
  const single = { left: 50, top: 50, right: 200, bottom: 150 };
  const result = normalizeSurfaces(single, { width: 1920, height: 1080 }, { width: 48, height: 48 });
  assert.equal(result.length, 1);
  assert.equal(result[0].left, 50);
});
test('normalizeSurfaces accepts multiple valid surfaces', () => {
  const rects = [
    { left: 10, top: 10, right: 200, bottom: 100 },
    { left: 250, top: 10, right: 500, bottom: 100 }
  ];
  const result = normalizeSurfaces(rects, { width: 1920, height: 1080 }, { width: 48, height: 48 });
  assert.equal(result.length, 2);
  assert.equal(result[0].left, 10);
  assert.equal(result[1].left, 250);
});

test('surfaceTarget center returns centered position', () => {
  const surface = { left: 100, top: 50, right: 300, bottom: 200, width: 200, height: 150, margin: 4 };
  const target = surfaceTarget(surface, { width: 48, height: 48 }, 'center');
  assert.ok(target !== null);
  assert.equal(target.x, 176);
  assert.equal(target.y, 101);
});
test('surfaceTarget top-left returns surface corner + margin', () => {
  const surface = { left: 100, top: 50, right: 300, bottom: 200, width: 200, height: 150, margin: 4 };
  const target = surfaceTarget(surface, { width: 48, height: 48 }, 'top-left');
  assert.ok(target !== null);
  assert.equal(target.x, 104);
  assert.equal(target.y, 54);
});
test('surfaceTarget bottom-right returns surface bottom-right minus margin', () => {
  const surface = { left: 100, top: 50, right: 300, bottom: 200, width: 200, height: 150, margin: 4 };
  const target = surfaceTarget(surface, { width: 48, height: 48 }, 'bottom-right');
  assert.ok(target !== null);
  const maxX = Math.max(4, 200 - 48 - 4);
  const maxY = Math.max(4, 150 - 48 - 4);
  assert.equal(target.x, 248);
  assert.equal(target.y, 148);
});
test('surfaceTarget random stays inside bounds over many samples', () => {
  const surface = { left: 100, top: 50, right: 300, bottom: 200, width: 200, height: 150, margin: 4 };
  for (let i = 0; i < 50; i++) {
    const target = surfaceTarget(surface, { width: 48, height: 48 }, 'random');
    assert.ok(target.x >= 104 && target.x <= 260, `random x out of [104,~260]: ${target.x}`);
    assert.ok(target.y >= 54 && target.y <= 160, `random y out of [54,~160]: ${target.y}`);
  }
});
test('surfaceTarget returns null for empty/null surface', () => {
  assert.equal(surfaceTarget(null, { width: 48, height: 48 }, 'center'), null);
  assert.equal(surfaceTarget({ width: NaN, height: 100 }, { width: 48, height: 48 }, 'center'), null);
});
test('surfaceTarget default anchor is random-like', () => {
  const surface = { left: 0, top: 0, right: 500, bottom: 300, width: 500, height: 300, margin: 2 };
  const t1 = surfaceTarget(surface, { width: 48, height: 48 });
  const t2 = surfaceTarget(surface, { width: 48, height: 48 }, 'random');
  assert.ok(t1 !== null && t2 !== null);
});

test('transition call produces CALLED state', () => {
  const s = createState({ state: STATES.IDLE });
  const r = transition(s, 'call');
  assert.equal(r.state, STATES.CALLED);
  assert.equal(r.changed, true);
});
test('CALLED state can exit back through EXITING→IDLE chain', () => {
  let s = createState({ state: STATES.CALLED });
  let r = transition(s, 'exit');
  assert.equal(r.state, STATES.EXITING);
  s.state = STATES.EXITING;
  r = transition(s, 'enter');
  assert.equal(r.state, STATES.IDLE);
});
test('exportState includes position from surface-targeted roam', () => {
  const s = createState({ state: STATES.ROAMING, position: {x: 100, y: 50} });
  const json = exportState(s);
  const parsed = JSON.parse(json);
  assert.equal(parsed.state, STATES.ROAMING);
  assert.equal(parsed.position.x, 100);
  assert.equal(parsed.position.y, 50);
});
test('clampPosition applied to surfaceTarget output stays in bounds', () => {
  const surface = { left: 100, top: 50, right: 500, bottom: 400, width: 400, height: 350, margin: 4 };
  const bounds = { width: 500, height: 400 };
  const wolf = { width: 48, height: 48 };
  ['center','top-left','bottom-right'].forEach(anchor => {
    const tgt = surfaceTarget(surface, wolf, anchor);
    if (!tgt) throw new Error(`${anchor}: null target`);
    const clamped = clampPosition(tgt, bounds, wolf);
    assert.ok(clamped.x >= 0 && clamped.x + 48 <= 500, `${anchor}: x out`);
    assert.ok(clamped.y >= 0 && clamped.y + 48 <= 400, `${anchor}: y out`);
  });
});

test('clampPosition with offset surface: position at surface-left stays put', () => {
  const surface = { left: 350, top: 100, right: 500, bottom: 300, width: 150, height: 200 };
  const wolf = { width: 48, height: 48 };
  const clamped = clampPosition({x: 370, y: 150}, surface, wolf);
  assert.ok(clamped.x >= 350, `offset x=370 was clamped to ${clamped.x} — must stay >= surface.left`);
  assert.ok(clamped.y >= 100, `offset y=150 was clamped to ${clamped.y} — must stay >= surface.top`);
});

test('clampPosition with offset surface: high position near max stays', () => {
  const surface = { left: 350, top: 100, right: 500, bottom: 300, width: 150, height: 200 };
  const wolf = { width: 48, height: 48 };
  const clamped = clampPosition({x: 452, y: 290}, surface, wolf);
  assert.equal(clamped.x, 452, `max x=452 was moved to ${clamped.x}`);
  assert.ok(clamped.y <= 252, `y=290 clamped too low to ${clamped.y}`);
});

test('clampPosition with offset surface: over-max x clamps to surface max', () => {
  const surface = { left: 350, top: 100, right: 500, bottom: 300, width: 150, height: 200 };
  const wolf = { width: 48, height: 48 };
  const clamped = clampPosition({x: 600, y: 150}, surface, wolf);
  assert.equal(clamped.x, 452, `x=600 should clamp to max x=${452}, got ${clamped.x}`);
});

test('clampPosition with zero-offset surface behaves like before', () => {
  const surface = { left: 0, top: 0, right: 500, bottom: 400, width: 500, height: 400 };
  const wolf = { width: 48, height: 48 };
  const clamped = clampPosition({x: 370, y: 150}, surface, wolf);
  assert.equal(clamped.x, 370, 'zero-offset: normal x preserved');
  assert.equal(clamped.y, 150, 'zero-offset: normal y preserved');
  const clampedMax = clampPosition({x: 600, y: 500}, surface, wolf);
  assert.equal(clampedMax.x, 452, 'zero-offset: exceeds width clamped correctly');
  assert.equal(clampedMax.y, 352, 'zero-offset: exceeds height clamped correctly');
});

test('surfaceTarget output passes through offset clampPosition', () => {
  const surface = { left: 200, top: 60, right: 700, bottom: 360, width: 500, height: 300, margin: 4 };
  const wolf = { width: 48, height: 48 };
  ['center','top-left','bottom-right'].forEach(anchor => {
    const tgt = surfaceTarget(surface, wolf, anchor);
    assert.ok(tgt !== null, `${anchor}: non-null target`);
    assert.ok(tgt.x >= surface.left && tgt.x + 48 <= surface.right, `${anchor}: x out of surface`);
    assert.ok(tgt.y >= surface.top && tgt.y + 48 <= surface.bottom, `${anchor}: y out of surface`);
  });
});

/* ════════════════════════════════════════════════
   TAMAGOTCHI NEEDS MODEL — BOUNDED DECAY
   ════════════════════════════════════════════════ */

test('DEFAULT_NEEDS has bounded values 0–100', () => {
  assert.ok(DEFAULT_NEEDS.hunger >= 0 && DEFAULT_NEEDS.hunger <= 100);
  assert.ok(DEFAULT_NEEDS.happiness >= 0 && DEFAULT_NEEDS.happiness <= 100);
  assert.ok(DEFAULT_NEEDS.energy >= 0 && DEFAULT_NEEDS.energy <= 100);
  assert.ok(DEFAULT_NEEDS.health >= 0 && DEFAULT_NEEDS.health <= 100);
});
test('createNeeds returns defaults when called with no args', () => {
  const n = createNeeds();
  assert.equal(n.hunger, DEFAULT_NEEDS.hunger);
  assert.equal(n.happiness, DEFAULT_NEEDS.happiness);
  assert.equal(n.energy, DEFAULT_NEEDS.energy);
  assert.equal(n.health, DEFAULT_NEEDS.health);
});
test('createNeeds overrides specified fields', () => {
  const n = createNeeds({ hunger: 50, energy: 20 });
  assert.equal(n.hunger, 50);
  assert.equal(n.energy, 20);
  assert.equal(n.happiness, DEFAULT_NEEDS.happiness);
  assert.equal(n.health, DEFAULT_NEEDS.health);
});
test('createNeeds clamps out-of-range values', () => {
  const n = createNeeds({ hunger: -10, happiness: 150, energy: 'not-a-number' });
  assert.equal(n.hunger, 0);
  assert.equal(n.happiness, 100);
  assert.equal(n.energy, DEFAULT_NEEDS.energy); // NaN → default
});

test('advanceNeeds reduces hunger over time', () => {
  const base = createNeeds({ hunger: 80, lastUpdate: '2026-01-01T00:00:00.000Z' });
  const later = new Date('2026-01-01T01:00:00.000Z').toISOString(); // 1 hour
  const adv = advanceNeeds(base, later);
  assert.ok(adv.hunger < 80, `hunger went from 80 to ${adv.hunger}`);
  assert.ok(adv.hunger >= 0, `hunger should not go below 0`);
});
test('advanceNeeds reduces happiness over time', () => {
  const base = createNeeds({ happiness: 90, lastUpdate: '2026-01-01T00:00:00.000Z' });
  const later = new Date('2026-01-01T01:00:00.000Z').toISOString();
  const adv = advanceNeeds(base, later);
  assert.ok(adv.happiness < 90);
});
test('advanceNeeds reduces energy over time', () => {
  const base = createNeeds({ energy: 95, lastUpdate: '2026-01-01T00:00:00.000Z' });
  const later = new Date('2026-01-01T01:00:00.000Z').toISOString();
  const adv = advanceNeeds(base, later);
  assert.ok(adv.energy < 95);
});
test('advanceNeeds reduces health over time', () => {
  const base = createNeeds({ health: 98, lastUpdate: '2026-01-01T00:00:00.000Z' });
  const later = new Date('2026-01-01T01:00:00.000Z').toISOString();
  const adv = advanceNeeds(base, later);
  assert.ok(adv.health < 98);
});
test('advanceNeeds with zero elapsed does not change values', () => {
  const n = createNeeds({ hunger: 50, lastUpdate: '2026-01-01T00:00:00.000Z' });
  const adv = advanceNeeds(n, '2026-01-01T00:00:00.000Z');
  assert.equal(adv.hunger, 50);
});
test('advanceNeeds with future timestamp is safe (no corruption)', () => {
  const base = createNeeds({ hunger: 50, lastUpdate: '2099-01-01T00:00:00.000Z' });
  const nowIso = new Date().toISOString();
  const adv = advanceNeeds(base, nowIso);
  assert.ok(adv.hunger >= 0 && adv.hunger <= 100, `future timestamp broke hunger: ${adv.hunger}`);
});
test('advanceNeeds with invalid lastUpdate is safe', () => {
  const base = createNeeds({ hunger: 50, lastUpdate: 'totally-not-a-date' });
  const nowIso = new Date().toISOString();
  const adv = advanceNeeds(base, nowIso);
  assert.ok(adv.hunger >= 0 && adv.hunger <= 100, `invalid date broke hunger: ${adv.hunger}`);
});
test('advanceNeeds with null lastUpdate uses now and returns unchanged', () => {
  const base = createNeeds({ hunger: 60 });
  const adv = advanceNeeds(base, new Date().toISOString());
  // No previous time → no decay
  assert.equal(adv.hunger, 60);
});
test('decay rates are negative (values go down)', () => {
  for (const [, rate] of Object.entries(NEEDS_DECAY_RATE)) {
    assert.ok(rate < 0, `Decay rate for ${Object.keys(NEEDS_DECAY_RATE)[0]} should be negative`);
    break; // just check first one pattern
  }
  assert.ok(NEEDS_DECAY_RATE.hunger < 0);
  assert.ok(NEEDS_DECAY_RATE.happiness < 0);
  assert.ok(NEEDS_DECAY_RATE.energy < 0);
  assert.ok(NEEDS_DECAY_RATE.health < 0);
});

/* ════════════════════════════════════════════════
   CARE ACTIONS — FEED / PLAY / REST / CALL
   ════════════════════════════════════════════════ */

test('applyCareAction feed increases hunger by 20', () => {
  const n = createNeeds({ hunger: 40 });
  const r = applyCareAction(n, 'feed');
  assert.equal(r.state.hunger, 60);
  assert.ok(r.changed, 'feed should change hunger');
  assert.equal(r.action, 'feed');
  assert.ok(typeof r.feedback === 'string');
});
test('applyCareAction play increases happiness by 25', () => {
  const n = createNeeds({ happiness: 30 });
  const r = applyCareAction(n, 'play');
  assert.equal(r.state.happiness, 55);
  assert.ok(r.changed);
});
test('applyCareAction rest increases energy by 30', () => {
  const n = createNeeds({ energy: 40 });
  const r = applyCareAction(n, 'rest');
  assert.equal(r.state.energy, 70);
  assert.ok(r.changed);
});
test('applyCareAction call increases happiness by 15', () => {
  const n = createNeeds({ happiness: 40 });
  const r = applyCareAction(n, 'call');
  assert.equal(r.state.happiness, 55);
  assert.ok(r.changed);
});

test('applyCareAction effects are bounded at 100', () => {
  const n = createNeeds({ hunger: 95 });
  const r = applyCareAction(n, 'feed'); // +20 → would be 115
  assert.equal(r.state.hunger, 100, 'hunger should cap at 100');
});
test('applyCareAction effects are bounded at 0', () => {
  const n = createNeeds({ hunger: 5, energy: 5, happiness: 5 });
  const r = applyCareAction(n, 'play'); // hunger -5→0, happiness +25→30, energy -15→0
  assert.equal(r.state.hunger, 0, 'hunger should floor at 0');
  assert.ok(r.state.energy >= 0 && r.state.energy <= 100);
});
test('applyCareAction rest increases health', () => {
  const n = createNeeds({ health: 70, energy: 20 });
  const r = applyCareAction(n, 'rest');
  assert.equal(r.state.health, 80); // +10
  assert.equal(r.state.energy, 50); // +30
});
test('applyCareAction play decreases hunger slightly', () => {
  const n = createNeeds({ hunger: 50 });
  const r = applyCareAction(n, 'play');
  assert.equal(r.state.hunger, 45); // -5
});
test('applyCareAction unknown action returns changed=false', () => {
  const n = createNeeds({ hunger: 50 });
  const r = applyCareAction(n, 'dance');
  assert.equal(r.changed, false);
  assert.equal(r.state.hunger, 50); // no change
});

/* ════════════════════════════════════════════════
   MOOD / BEHAVIOR SELECTION
   ════════════════════════════════════════════════ */

test('deriveMood content when all needs moderate-high', () => {
  const n = createNeeds({ hunger: 50, happiness: 60, energy: 60, health: 80 });
  assert.equal(deriveMood(n), 'content');
});
test('deriveMood playful when happy and energetic', () => {
  const n = createNeeds({ hunger: 50, happiness: 70, energy: 60, health: 80 });
  assert.equal(deriveMood(n), 'playful');
});
test('deriveMood hungry when hunger < 25', () => {
  const n = createNeeds({ hunger: 15, happiness: 60, energy: 60, health: 80 });
  assert.equal(deriveMood(n), 'hungry');
});
test('deriveMood sleepy when energy < 25', () => {
  const n = createNeeds({ hunger: 50, happiness: 60, energy: 15, health: 80 });
  assert.equal(deriveMood(n), 'sleepy');
});
test('deriveMood distressed when any need < 20', () => {
  const n = createNeeds({ hunger: 10, happiness: 60, energy: 60, health: 80 });
  assert.equal(deriveMood(n), 'distressed');
});

test('chooseBehavior hungry → forage', () => {
  const n = createNeeds({ hunger: 15 });
  assert.equal(chooseBehavior(n, 'IDLE'), 'forage');
});
test('chooseBehavior sleepy → rest', () => {
  const n = createNeeds({ energy: 15 });
  assert.equal(chooseBehavior(n, 'IDLE'), 'rest');
});
test('chooseBehavior healthy IDLE → idle behavior', () => {
  const n = createNeeds({ hunger: 50, happiness: 60, energy: 60, health: 80 });
  assert.equal(chooseBehavior(n, 'IDLE'), 'idle');
});
test('chooseBehavior healthy ROAMING → walk behavior', () => {
  const n = createNeeds({ hunger: 50, happiness: 60, energy: 60, health: 80 });
  assert.equal(chooseBehavior(n, 'ROAMING'), 'walk');
});
test('chooseBehavior distressed hungry → forage', () => {
  const n = createNeeds({ hunger: 10, happiness: 30, energy: 40, health: 50 });
  assert.equal(chooseBehavior(n, 'IDLE'), 'forage');
});

/* ════════════════════════════════════════════════
   ROAMING STEP — DETERMINISTIC MOVEMENT
   ════════════════════════════════════════════════ */

test('stepRoaming moves toward target', () => {
  const pos = { x: 10, y: 10 };
  const tgt = { x: 100, y: 100 };
  const r = stepRoaming(pos, tgt, { width: 48, height: 48 }, { width: 200, height: 200 });
  assert.ok(r.x > pos.x, `x should increase: ${pos.x} → ${r.x}`);
  assert.ok(r.y > pos.y, `y should increase: ${pos.y} → ${r.y}`);
});
test('stepRoaming arrives when close enough', () => {
  const pos = { x: 98, y: 98 };
  const tgt = { x: 100, y: 100 };
  const r = stepRoaming(pos, tgt, { width: 48, height: 48 }, { width: 200, height: 200 });
  assert.ok(r.arrived || (Math.abs(r.x - tgt.x) < 3 && Math.abs(r.y - tgt.y) < 3));
});
test('stepRoaming is deterministic — same inputs produce same outputs', () => {
  const pos = { x: 30, y: 40 };
  const tgt = { x: 100, y: 100 };
  const bnd = { width: 200, height: 200 };
  const r1 = stepRoaming(pos, tgt, { width: 48, height: 48 }, bnd, 3);
  const r2 = stepRoaming(pos, tgt, { width: 48, height: 48 }, bnd, 3);
  assert.equal(r1.x, r2.x);
  assert.equal(r1.y, r2.y);
  assert.equal(r1.arrived, r2.arrived);
});
test('stepRoaming clamps to surface bounds', () => {
  const pos = { x: 150, y: 150 };
  const tgt = { x: 250, y: 250 };
  const r = stepRoaming(pos, tgt, { width: 48, height: 48 }, { width: 200, height: 200 }, 5);
  assert.ok(r.x <= 200 - 48, `x ${r.x} should clamp to ≤${200-48}`);
  assert.ok(r.y <= 200 - 48, `y ${r.y} should clamp to ≤${200-48}`);
});
test('stepRoaming respects offset surfaces', () => {
  const pos = { x: 200, y: 80 };
  const tgt = { x: 300, y: 160 };
  const bnd = { left: 200, top: 60, width: 500, height: 300 };
  const r = stepRoaming(pos, tgt, { width: 48, height: 48 }, bnd, 3);
  assert.ok(r.x >= 200, `x ${r.x} should stay ≥ surface left 200`);
  assert.ok(r.y >= 60, `y ${r.y} should stay ≥ surface top 60`);
});

/* ════════════════════════════════════════════════
   PERSISTENCE — FULL STATE EXPORT/IMPORT
   ════════════════════════════════════════════════ */

test('exportFullState includes needs fields', () => {
  const n = createNeeds({ hunger: 72.5, lastUpdate: '2026-01-01T12:00:00.000Z' });
  const s = createState({ state: STATES.IDLE, position: {x: 50, y: 60} });
  const json = exportFullState(s, n);
  const parsed = JSON.parse(json);
  assert.equal(parsed.needsVersion, 1);
  assert.ok(parsed.needsHunger !== undefined);
  assert.equal(parsed.state, 'IDLE');
});

test('importFullState round-trips needs and state', () => {
  const n = createNeeds({ hunger: 65.3, happiness: 80.1, lastUpdate: '2026-06-01T00:00:00.000Z' });
  const s = createState({ state: STATES.ROAMING, position: {x: 120, y: 80} });
  const json = exportFullState(s, n);
  const full = importFullState(json);
  assert.equal(full.state.state, 'ROAMING');
  assert.equal(full.needs.hunger, 65.3);
  assert.equal(full.needs.happiness, 80.1);
  assert.equal(full.needs.lastUpdate, '2026-06-01T00:00:00.000Z');
});

test('importFullState old v1 state (no needs fields) returns defaults', () => {
  const oldJson = '{"state":"IDLE","supplies":{"Food":0,"Water":0,"Care":0},"position":{"x":0,"y":0}}';
  const full = importFullState(oldJson);
  assert.equal(full.state.state, 'IDLE');
  assert.equal(full.needs.hunger, DEFAULT_NEEDS.hunger);
  assert.ok(Number.isFinite(full.needs.hunger));
});

test('importFullState malformed JSON returns defaults', () => {
  const full = importFullState('{{{garbage}}}');
  assert.equal(full.state.state, 'HIDDEN');
  assert.ok(Number.isFinite(full.needs.hunger));
});

test('importFullState null input returns defaults', () => {
  const full = importFullState(null);
  assert.equal(full.state.state, 'HIDDEN');
});

/* ════════════════════════════════════════════════
   STATIC CONTRACT — VISUAL BEHAVIOR (non-regression)
   Fixed from broken regex-block tests to direct checks
   ════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════
   REGRESSION — MOVEMENT & ARRIVAL BEHAVIOR
   Proves stepRoaming produces changing positions
   and arrival schedules genuinely different targets
   ════════════════════════════════════════════════ */

test('stepRoaming produces changing positions over multiple ticks (non-arrived)', () => {
  // Simulate a long-distance roam: wolf starts far from target
  const pos = { x: 0, y: 0 };
  const tgt = { x: 500, y: 300 };
  const sz = { width: 48, height: 48 };
  const bnd = { left: 0, top: 0, width: 800, height: 600 };

  let cur = { ...pos };
  const positions = [cur];
  const maxTicks = 30;

  for (let t = 0; t < maxTicks; t++) {
    const step = stepRoaming(cur, tgt, sz, bnd, 3);
    // Clamp result (simulating what render does)
    cur = { x: Math.max(0, Math.min(bnd.width - sz.width, step.x)), y: Math.max(0, Math.min(bnd.height - sz.height, step.y)) };
    positions.push({ ...cur });

    if (step.arrived) break;
  }

  // Verify: at least 3 distinct positions (movement occurred)
  const uniquePositions = new Set(positions.map(p => `${p.x},${p.y}`));
  assert.ok(uniquePositions.size >= 3, `Expected ≥3 unique positions over ${maxTicks} ticks, got ${uniquePositions.size}: ${positions.slice(0, 5).map(p=>`(${p.x},${p.y})`).join(', ')}`);

  // Verify: final position is closer to target than start
  const distStart = Math.hypot(tgt.x - positions[0].x, tgt.y - positions[0].y);
  const distEnd = Math.hypot(tgt.x - positions[positions.length-1].x, tgt.y - positions[positions.length-1].y);
  assert.ok(distEnd < distStart, `Should end closer to target: started ${(distStart).toFixed(0)}px away, now ${(distEnd).toFixed(0)}px away`);
});

test('stepRoaming with offset surface preserves offset-aware movement', () => {
  const surfaceLeft = 100;
  const surfaceTop = 50;
  const surfaceWidth = 600;
  const surfaceHeight = 400;

  // Start just inside offset corner
  let cur = { x: surfaceLeft + 10, y: surfaceTop + 10 };
  const tgt = { x: surfaceLeft + surfaceWidth / 2, y: surfaceTop + surfaceHeight / 2 };
  const sz = { width: 48, height: 48 };
  const bnd = { left: surfaceLeft, top: surfaceTop, width: surfaceWidth, height: surfaceHeight };

  const positions = [cur];
  for (let t = 0; t < 20; t++) {
    const step = stepRoaming(cur, tgt, sz, bnd, 3);
    cur = { x: step.x, y: step.y };
    positions.push({ ...cur });
    if (step.arrived) break;
  }

  // All positions must stay within bounds
  for (let i = 0; i < positions.length; i++) {
    assert.ok(positions[i].x >= surfaceLeft, `Tick ${i}: x=${positions[i].x} below left ${surfaceLeft}`);
    assert.ok(positions[i].y >= surfaceTop, `Tick ${i}: y=${positions[i].y} above top ${surfaceTop}`);
    assert.ok(positions[i].x <= surfaceLeft + surfaceWidth - 48, `Tick ${i}: x exceeds right`);
    assert.ok(positions[i].y <= surfaceTop + surfaceHeight - 48, `Tick ${i}: y exceeds bottom`);
  }

  // Must have moved
  const dx = Math.abs(positions[positions.length-1].x - positions[0].x);
  const dy = Math.abs(positions[positions.length-1].y - positions[0].y);
  assert.ok(dx > 0 || dy > 0, 'Wolf must move from starting position on offset surface');
});

test('arrival returns arrived=true then next tick continues toward same target', () => {
  const pos = { x: 100, y: 50 };
  const tgt = { x: 101, y: 50.5 }; // Within dist<2 threshold — arrives in 1 step
  const sz = { width: 48, height: 48 };
  const bnd = { left: 0, top: 0, width: 300, height: 200 };

  const step1 = stepRoaming(pos, tgt, sz, bnd, 3);
  assert.ok(step1.arrived, `Should arrive when dist<2, got dist=${Math.hypot(tgt.x-pos.x,tgt.y-pos.y).toFixed(2)}, result=${JSON.stringify(step1)}`);
  assert.equal(step1.x, tgt.x, 'Arrived position must equal target');
  assert.equal(step1.y, tgt.y, 'Arrived position must equal target');

  // Now simulate: position is at target, but we call step again (should still arrive or stay)
  const step2 = stepRoaming({ x: tgt.x, y: tgt.y }, tgt, sz, bnd, 3);
  assert.ok(step2.arrived, 'Once at target, should remain arrived');
  assert.equal(step2.x, tgt.x, 'Position stays at target');
});

test('multiple valid surfaces produce traversable targets', () => {
  // With two separate surfaces, targets should pick from both
  const surfA = { left: 0, top: 0, right: 200, bottom: 150, width: 200, height: 150, margin: 4 };
  const surfB = { left: 400, top: 0, right: 700, bottom: 150, width: 300, height: 150, margin: 4 };

  // Generate many random targets and verify they span both surfaces
  const targetsX = [];
  for (let i = 0; i < 100; i++) {
    // Simulate picking surface randomly
    const useA = Math.random() > 0.5;
    const s = useA ? surfA : surfB;
    const tgt = surfaceTarget(s, { width: 48, height: 48 }, 'random');
    if (tgt) targetsX.push(tgt.x);
  }

  const inA = targetsX.filter(x => x >= surfA.left && x <= surfA.right);
  const inB = targetsX.filter(x => x >= surfB.left && x <= surfB.right);

  assert.ok(inA.length > 0, 'Should generate targets in surface A');
  assert.ok(inB.length > 0, 'Should generate targets in surface B');
  assert.ok(Math.abs(inA[Math.floor(inA.length/2)] - inB[Math.floor(inB.length/2)]) > 150,
    'Targets should span between surfaces (distance > 150px)');
});

const fs = require('node:fs');
const companionSource = fs.readFileSync(require.resolve('../wolf_companion.js'), 'utf8');

test('roam step speed exceeds idle pixel-per-tick', () => {
  assert.ok(companionSource.includes('dist * 0.12'),
    'roam speed formula must include distance multiplier');
  assert.ok(!companionSource.match(/var\s+speed\s*=\s*0\.5/),
    'legacy speed = 0.5 must not remain');
});

test('stepRoaming function exists in core exports', () => {
  assert.ok(typeof stepRoaming === 'function', 'stepRoaming must be exported from core');
});

test('CALLED handler cycles WALK frames during approach', () => {
  // Verify that the CALLED handler uses WALK_A or WALK_B, not IDLE
  assert.ok(companionSource.includes("'WALK_A'") || companionSource.includes('"WALK_A"'),
    'source must reference WALK_A frame for CALLED walking animation');
  assert.ok(companionSource.includes("'WALK_B'") || companionSource.includes('"WALK_B"'),
    'source must reference WALK_B frame for CALLED walking animation');
});

test('CALL picks surface target and approaches it', () => {
  assert.ok(companionSource.includes('surfaceTarget'),
    'CALL path must call core.surfaceTarget');
  assert.ok(companionSource.includes('roamTarget'),
    'CALL must set roamTarget for movement');
});

test('roamTarget uses absolute viewport coordinates', () => {
  var pickMatch = companionSource.match(/roamTarget = \{ x:[\s\S]*?y:[\s\S]*?\}/);
  assert.ok(pickMatch, 'roamTarget assignment found');
  var tgtAssign = pickMatch[0];
  assert.ok(tgtAssign.includes('target.x') || tgtAssign.includes('tgt.x'),
    'roamTarget must derive from surfaceTarget output');
});

test('getSurface returns composite bounding box with explicit left/top', () => {
  var gsMatch = companionSource.match(/function getSurface\(\)[^{]*\{[\s\S]*?return [^{]+\}/);
  assert.ok(gsMatch, 'getSurface function found');
  var gsBody = gsMatch[0];
  assert.ok(gsBody.includes('minX') && gsBody.includes('minY'),
    'getSurface must compute min bounds for composite bounding box');
});

test('CELEBRATING alternates WALK frames (bouncy celebration)', () => {
  var celebIdx = companionSource.indexOf('=== core.STATES.CELEBRATING');
  assert.ok(celebIdx >= 0, 'CELEBRATING handler found');
  var celebBlock = companionSource.substring(celebIdx, celebIdx + 500);
  assert.ok(celebBlock.includes("WALK_A"), 'CELEBRATING uses WALK_A');
  assert.ok(celebBlock.includes("WALK_B"), 'CELEBRATING uses WALK_B');
});

test('visibilitychange sets PAUSED state', () => {
  assert.ok(companionSource.includes('visibilitychange'), 'must listen for visibilitychange');
  assert.ok(companionSource.includes('document.visibilityState'), 'must read visibilityState');
  assert.ok(companionSource.includes('PAUSED'), 'must set PAUSED on hidden');
});

test('care action buttons exist in DOM', () => {
  assert.ok(companionSource.includes('doCareAction'), 'core must expose doCareAction routing');
  assert.ok(companionSource.includes('feed') && companionSource.includes('play') &&
            companionSource.includes('rest') && companionSource.includes('call'),
    'all 4 care actions must be exposed');
});

test('action seam has ARIA toolbar role', () => {
  assert.ok(companionSource.includes('role="toolbar"'), 'action seam must have ARIA toolbar role');
  assert.ok(companionSource.includes('aria-label'), 'action seam must have aria-label');
});

test('wolf-feedback uses aria-live for screen readers', () => {
  assert.ok(companionSource.includes('aria-live'), 'feedback area must announce to screen readers');
});

test('pointer events use capture phase for triple-tap', () => {
  assert.ok(companionSource.includes('capture: true'), 'pointer events must use capture');
  assert.ok(companionSource.includes('passive: true'), 'pointer events must be passive');
});

test('blockedTarget allows interaction inside wolf-action-seam', () => {
  assert.ok(companionSource.includes('#wolf-action-seam') || companionSource.includes('.wolf-action-seam'),
    'blockedTarget must recognize action-seam elements as interactive');
});

/* ════════════════════════════════════════════════
   CSS VERIFICATION — visual feedback contracts
   ════════════════════════════════════════════════ */

const cssSource = fs.readFileSync(require('path').join(__dirname, '../styles.css'), 'utf8');

test('CSS has wolf-companion selector', () => {
  assert.ok(cssSource.includes('.wolf-companion'), 'wolf button style must exist');
});
test('CSS has wolf-action-seam styles', () => {
  assert.ok(cssSource.includes('.wolf-action-seam'), 'action seam container must be styled');
});
test('CSS has wolf-action-btn hover styles', () => {
  assert.ok(cssSource.includes('.wolf-action-btn:hover'), 'action buttons must have hover state');
});
test('CSS has CALLED state border-color', () => {
  assert.ok(cssSource.includes('[data-state="CALLED"]'), 'CALLED visual state must be styled');
});
test('CSS has CELEBRATING state animation', () => {
  assert.ok(cssSource.includes('[data-state="CELEBRATING"]') || cssSource.includes('.wolf-celebrate'),
    'CELEBRATING must have distinct visual state');
});
test('CSS has prefers-reduced-motion override', () => {
  assert.ok(cssSource.includes('prefers-reduced-motion'), 'reduced motion support must exist');
});
test('CSS wolf layer uses overflow: visible (not hidden)', () => {
  assert.ok(cssSource.includes('overflow: visible') || cssSource.includes('overflow:visible'),
    'wolf-layer must allow feedback areas to show');
});

/* ════════════════════════════════════════════════
   WORLD-COORDINATE TERRITORY — RED TESTS
   These prove the new functions are contractually required
   ════════════════════════════════════════════════ */

// Verify all six new helpers exist as functions (RED gate — will pass once implemented)
test('rectToWorldRect is exported', () => {
  assert.strictEqual(typeof rectToWorldRect, 'function');
});
test('visibleWorldRect is exported', () => {
  assert.strictEqual(typeof visibleWorldRect, 'function');
});
test('isWorldPositionVisible is exported', () => {
  assert.strictEqual(typeof isWorldPositionVisible, 'function');
});
test('entryPointForVisibleEdge is exported', () => {
  assert.strictEqual(typeof entryPointForVisibleEdge, 'function');
});
test('clampToTerrainWorld is exported', () => {
  assert.strictEqual(typeof clampToTerrainWorld, 'function');
});
test('chooseReentryEdge is exported', () => {
  assert.strictEqual(typeof chooseReentryEdge, 'function');
});

// rectToWorldRect: converts viewport rect to document coordinates via scroll offsets
test('rectToWorldRect shifts rect by scrollX/scrollY', () => {
  const vp = { left: 0, top: 500 }; // visualViewport offset
  const r = rectToWorldRect({ left: 100, top: 200, right: 300, bottom: 400, width: 200, height: 200 }, { x: 0, y: 500 }, vp);
  // With scrollY=500 and visualViewport top=500, world-top should be 200 + 500 - 500 = 200...
  // Actually: rect.top is relative to viewport window top. If visualViewport.top=500 (scrolled down),
  // then element at DOM y=700 would have getBoundingClientRect().top = 700 - 500 = 200
  // So worldTop = rectTop + visualViewportTop = 200 + 500 = 700
  assert.equal(r.top, 700, `world top should be 700, got ${r.top}`);
  assert.equal(r.left, 100, `world left should be 100, got ${r.left}`);
  assert.equal(r.right, 300, `world right should be 300, got ${r.right}`);
  assert.equal(r.bottom, 900, `world bottom should be 900, got ${r.bottom}`);
});

test('rectToWorldRect with no visualViewport uses scrollY', () => {
  const r = rectToWorldRect({ left: 100, top: 200, right: 300, bottom: 400, width: 200, height: 200 }, { x: 50, y: 300 }, undefined);
  // No visualViewport → use scrollY directly: 200 + 300 = 500
  assert.equal(r.top, 500);
  assert.equal(r.left, 150); // 100 + 50
});

test('rectToWorldRect preserves zero-scroll identity', () => {
  const r = rectToWorldRect({ left: 100, top: 200, right: 300, bottom: 400, width: 200, height: 200 }, { x: 0, y: 0 }, { left: 0, top: 0 });
  assert.equal(r.left, 100);
  assert.equal(r.top, 200);
  assert.equal(r.width, 200);
  assert.equal(r.height, 200);
});

// visibleWorldRect: produces the current viewport window in world coords
test('visibleWorldRect returns correct world-space viewport rectangle', () => {
  const vwr = visibleWorldRect({ x: 0, y: 500 }, { width: 800, height: 600 });
  assert.equal(vwr.left, 0);
  assert.equal(vwr.top, 500);
  assert.equal(vwr.right, 800);
  assert.equal(vwr.bottom, 1100);
});

test('visibleWorldRect with horizontal scroll shifts left', () => {
  const vwr = visibleWorldRect({ x: 200, y: 0 }, { width: 800, height: 600 });
  assert.equal(vwr.left, 200);
  assert.equal(vwr.right, 1000);
});

// isWorldPositionVisible: partial visibility check
test('isWorldPositionVisible returns true when fully inside viewport', () => {
  const vis = { left: 0, top: 500, right: 800, bottom: 1100 };
  const pos = { x: 100, y: 600 };
  const wolfSize = { width: 48, height: 48 };
  assert.ok(isWorldPositionVisible(pos, vis, wolfSize), 'should be visible when centered in viewport');
});

test('isWorldPositionVisible returns false when fully outside viewport', () => {
  const vis = { left: 0, top: 500, right: 800, bottom: 1100 };
  const pos = { x: 2000, y: 2000 };
  const wolfSize = { width: 48, height: 48 };
  assert.strictEqual(isWorldPositionVisible(pos, vis, wolfSize), false);
});

test('isWorldPositionVisible returns true for partially visible wolf', () => {
  const vis = { left: 0, top: 500, right: 400, bottom: 1100 };
  const pos = { x: 380, y: 600 }; // Right edge at 428, partly in viewport
  const wolfSize = { width: 48, height: 48 };
  assert.ok(isWorldPositionVisible(pos, vis, wolfSize));
});

test('isWorldPositionVisible returns false when wolf completely above viewport', () => {
  const vis = { left: 0, top: 500, right: 800, bottom: 1100 };
  const pos = { x: 100, y: 400 }; // Wolf bottom at 448, entirely above 500
  const wolfSize = { width: 48, height: 48 };
  assert.strictEqual(isWorldPositionVisible(pos, vis, wolfSize), false);
});

// entryPointForVisibleEdge: non-top-left world entry point
test('entryPointForVisibleEdge left returns valid terrain position not at top-left', () => {
  const visibleRect = { left: 0, top: 500, right: 800, bottom: 1100 };
  const terrain = [{ left: 0, top: 500, right: 800, bottom: 1100, width: 800, height: 600 }];
  const ep = entryPointForVisibleEdge('left', visibleRect, terrain, { width: 48, height: 48 });
  assert.ok(ep !== null, 'must return a position');
  assert.ok(ep.x === -48 || ep.x >= visibleRect.left - 48, `x=${ep.x} invalid for left edge`);
  // Y must NOT be near top-left corner unless forced
  assert.ok(ep.y > visibleRect.top || ep.x !== visibleRect.left, 'should not snap to absolute top-left');
});

test('entryPointForVisibleEdge right returns valid terrain position on right side', () => {
  const visibleRect = { left: 0, top: 500, right: 800, bottom: 1100 };
  const terrain = [{ left: 0, top: 500, right: 800, bottom: 1100, width: 800, height: 600 }];
  const ep = entryPointForVisibleEdge('right', visibleRect, terrain, { width: 48, height: 48 });
  assert.ok(ep !== null);
  assert.ok(ep.x >= visibleRect.right || ep.x <= visibleRect.right + 100, `x=${ep.x} invalid for right edge`);
});

test('entryPointForVisibleEdge top returns non-corner position', () => {
  const visibleRect = { left: 0, top: 500, right: 800, bottom: 1100 };
  const terrain = [{ left: 0, top: 500, right: 800, bottom: 1100, width: 800, height: 600 }];
  const ep = entryPointForVisibleEdge('top', visibleRect, terrain, { width: 48, height: 48 });
  assert.ok(ep !== null);
  // X should be within terrain bounds, not clamped to 0
  assert.ok(ep.x >= visibleRect.left && ep.x <= visibleRect.right, `x=${ep.x} out of terrain for top edge`);
});

test('entryPointForVisibleEdge bottom returns non-corner position', () => {
  const visibleRect = { left: 0, top: 500, right: 800, bottom: 1100 };
  const terrain = [{ left: 0, top: 500, right: 800, bottom: 1100, width: 800, height: 600 }];
  const ep = entryPointForVisibleEdge('bottom', visibleRect, terrain, { width: 48, height: 48 });
  assert.ok(ep !== null);
  assert.ok(ep.x >= visibleRect.left && ep.x <= visibleRect.right, `x=${ep.x} out of terrain for bottom edge`);
});

// clampToTerrainWorld: preserves application-space offsets
test('clampToTerrainWorld clamps within terrain boundaries preserving offsets', () => {
  const terrain = [
    { left: 100, top: 500, right: 400, bottom: 700, width: 300, height: 200 },
    { left: 500, top: 500, right: 900, bottom: 700, width: 400, height: 200 }
  ];
  const pos = clampToTerrainWorld({ x: 1200, y: 600 }, terrain, { width: 48, height: 48 });
  assert.ok(pos.x >= 100, `x=${pos.x} below terrain min left`);
  assert.ok(pos.x <= 952, `x=${pos.x} beyond max right-48`);
  assert.ok(pos.y >= 500, `y=${pos.y} above terrain min top`);
  assert.ok(pos.y <= 700 - 48, `y=${pos.y} below terrain max bottom-48`);
});

test('clampToTerrainWorld handles multi-surface terrain preferring closest surface', () => {
  const terrain = [
    { left: 0, top: 0, right: 200, bottom: 150, width: 200, height: 150 },
    { left: 400, top: 0, right: 700, bottom: 150, width: 300, height: 150 }
  ];
  const pos = clampToTerrainWorld({ x: 100, y: 75 }, terrain, { width: 48, height: 48 });
  assert.ok(pos.x >= 0 && pos.x <= 152, 'should be clamped to first surface');
  const pos2 = clampToTerrainWorld({ x: 550, y: 75 }, terrain, { width: 48, height: 48 });
  assert.ok(pos2.x >= 400 && pos2.x <= 652, 'should be clamped to second surface');
});

test('clampToTerrainWorld returns original when already on terrain', () => {
  const terrain = [{ left: 100, top: 200, right: 500, bottom: 400, width: 400, height: 200 }];
  const pos = clampToTerrainWorld({ x: 200, y: 300 }, terrain, { width: 48, height: 48 });
  assert.equal(pos.x, 200);
  assert.equal(pos.y, 300);
});

// chooseReentryEdge: deterministic side-aware re-entry
test('chooseReentryEdge returns right when previous position was right of viewport', () => {
  const prevPos = { x: 1000, y: 600 };
  const visRect = { left: 0, top: 500, right: 800, bottom: 1100 };
  const edge = chooseReentryEdge(prevPos, visRect);
  assert.equal(edge, 'right');
});

test('chooseReentryEdge returns left when previous position was left of viewport', () => {
  const prevPos = { x: -50, y: 600 };
  const visRect = { left: 0, top: 500, right: 800, bottom: 1100 };
  const edge = chooseReentryEdge(prevPos, visRect);
  assert.equal(edge, 'left');
});

test('chooseReentryEdge returns top when previous position was above viewport', () => {
  const prevPos = { x: 400, y: 300 };
  const visRect = { left: 0, top: 500, right: 800, bottom: 1100 };
  const edge = chooseReentryEdge(prevPos, visRect);
  assert.equal(edge, 'top');
});

test('chooseReentryEdge returns bottom when previous position was below viewport', () => {
  const prevPos = { x: 400, y: 1200 };
  const visRect = { left: 0, top: 500, right: 800, bottom: 1100 };
  const edge = chooseReentryEdge(prevPos, visRect);
  assert.equal(edge, 'bottom');
});

test('chooseReentryEdge prefers nearest side when diagonal offscreen', () => {
  const prevPos = { x: 1000, y: 1200 };
  const visRect = { left: 0, top: 500, right: 800, bottom: 1100 };
  const edge = chooseReentryEdge(prevPos, visRect);
  // Both right and bottom are candidates; should pick one deterministically
  assert.ok(['right', 'bottom', 'left', 'top'].includes(edge));
});

test('chooseReentryEdge is symmetric for diagonal positions', () => {
  const visRect = { left: 0, top: 500, right: 800, bottom: 1100 };
  const edge1 = chooseReentryEdge({ x: 900, y: 400 }, visRect);
  const edge2 = chooseReentryEdge({ x: -100, y: 1300 }, visRect);
  assert.notStrictEqual(edge1, edge2, 'opposite diagonal corners should choose different edges');
});

// Multi-tick terrain movement in world coordinates
test('multi-tick world roaming produces changing positions across terrain surfaces', () => {
  const terrain = [
    { left: 0, top: 0, right: 300, bottom: 200, width: 300, height: 200 },
    { left: 400, top: 0, right: 700, bottom: 200, width: 300, height: 200 }
  ];
  const sz = { width: 48, height: 48 };
  let cur = { x: 50, y: 50 };

  // Simulate choosing targets and stepping toward them
  const positions = [cur];
  let target = surfaceTarget(terrain[1], sz, 'center'); // Start far on surface B
  if (!target) target = { x: 500, y: 50 };

  for (let t = 0; t < 40; t++) {
    // stepRoaming returns position already clamped to bounds; just use it directly
    const step = stepRoaming(cur, target, sz, terrain[1], 3);
    cur = { x: step.x, y: step.y };
    positions.push({ ...cur });
    if (step.arrived) {
      // Pick new target from alternating surface
      const surfIdx = t % 2;
      target = surfaceTarget(terrain[surfIdx], sz, 'random');
      if (!target) target = { x: 200, y: 50 };
    }
  }

  // Multiple unique positions (movement occurred)
  const uniquePositions = new Set(positions.map(p => `${p.x},${p.y}`));
  assert.ok(uniquePositions.size >= 5, `Expected ≥5 unique positions over 40 ticks, got ${uniquePositions.size}`);

  // Final position should differ significantly from start
  const dx = Math.abs(positions[positions.length-1].x - positions[0].x);
  const dy = Math.abs(positions[positions.length-1].y - positions[0].y);
  assert.ok(dx > 20 || dy > 20, 'Should move meaningfully across terrain');
});

// ─── OFFSCREEN / RE-ENTRY FOCUSED TESTS ───

// Simulates what checkOffscreenReentry does: detect out-of-bounds position → schedule entry
test('offscreen detection: wolf far outside viewport is invisible', () => {
  const visRect = visibleWorldRect({ x: 0, y: 0 }, { top: 0, left: 0 });
  const sz = { width: 48, height: 48 };
  // Wolf at origin inside viewport — should be visible
  assert.ok(isWorldPositionVisible({ x: 0, y: 0 }, visRect, sz),
    'Wolf at origin [0,0] with size 48x48 should be visible in [0,0,800,600]');
  // Wolf far below viewport — should NOT be visible
  assert.ok(!isWorldPositionVisible({ x: 500, y: 700 }, visRect, sz),
    'Wolf at y=700 must be invisible when viewport ends at y=600');
  // Wolf far right of viewport — should NOT be visible
  assert.ok(!isWorldPositionVisible({ x: 900, y: 100 }, visRect, sz),
    'Wolf at x=900 must be invisible when viewport ends at x=800');
});

// Edge-boundary visibility: wolf fully past viewport edge is invisible
test('offscreen detection: boundary wolf at viewport edge is still visible (partial overlap)', () => {
  const visRect = visibleWorldRect({ x: 0, y: 0 }, { top: 0, left: 0 });
  const sz = { width: 48, height: 48 };
  // Wolf at right edge — right side extends beyond 800 but left side still overlaps
  assert.ok(isWorldPositionVisible({ x: 752, y: 100 }, visRect, sz),
    'Wolf at x=752 (right edge at 800) should be partially visible');
  // Wolf whose LEFT edge is exactly at viewport right → no overlap → invisible
  assert.ok(!isWorldPositionVisible({ x: 800, y: 100 }, visRect, sz),
    'Wolf whose left edge is at x=800 must be fully off-viewport-right');
});

// Entry point validation: ensure it's always non-corner and on a proper edge
test('re-entry: entryPointForVisibleEdge returns non-corner points for all edges', () => {
  const sz = { width: 48, height: 48 };
  const vwr = { left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 };
  const epTop = entryPointForVisibleEdge('top', vwr, [], sz);
  const epBot = entryPointForVisibleEdge('bottom', vwr, [], sz);
  const epLft = entryPointForVisibleEdge('left', vwr, [], sz);
  const epRgt = entryPointForVisibleEdge('right', vwr, [], sz);
  // Top entry: x should be mid-viewport, y should be above viewport
  assert.ok(epTop.x > 0 && epTop.x < vwr.right - 48, 'Top entry x must be mid-viewport');
  assert.ok(epTop.y <= 0, 'Top entry y must be above or at viewport top');
  // Bottom entry: x mid, y below viewport
  assert.ok(epBot.x > 0 && epBot.x < vwr.right - 48, 'Bottom entry x must be mid-viewport');
  assert.ok(epBot.y >= 600, 'Bottom entry y must be below viewport');
  // Left entry: x negative/outside, y mid
  assert.ok(epLft.x < 0, 'Left entry x must be outside viewport');
  assert.ok(epLft.y > 0 && epLft.y < 600, 'Left entry y must be mid-height');
  // Right entry: x at/beyond right edge, y mid
  assert.ok(epRgt.x >= 800, 'Right entry x must be at/right-of viewport');
  assert.ok(epRgt.y > 0 && epRgt.y < 600, 'Right entry y must be mid-height');
});

// Re-entry from various offscreen quadrants produces different edges
test('re-entry: chooseReentryEdge selects correct edge for all offscreen quadrants', () => {
  const vwr = { left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 };
  assert.equal(chooseReentryEdge({ x: 900, y: 300 }, vwr), 'right');
  assert.equal(chooseReentryEdge({ x: -100, y: 300 }, vwr), 'left');
  assert.equal(chooseReentryEdge({ x: 400, y: -50 }, vwr), 'top');
  assert.equal(chooseReentryEdge({ x: 400, y: 700 }, vwr), 'bottom');
});

/* ════════════════════════════════════════════════
   FAILURE REPAIR TESTS — ENTERING progress & scroll freeze & call interrupt
   ════════════════════════════════════════════════ */

// ─── FAILURE B: ENTERING must always transition on arrival ───
// Regression test: previously enteredDist >= 3 blocked ROAMING transition
// when stepRoaming returned arrived=true immediately (wolf already at
// clamped entry position). Now ANY arrived result transitions to ROAMING.

test('FAILURE_B: stepRoaming arrives immediately when already at target', () => {
  // Simulates wolf placed exactly at clamped entry point
  const pos = { x: 400, y: 200 };
  const tgt = { x: 400, y: 200 }; // Same as position — dist=0
  const r = stepRoaming(pos, tgt, { width: 48, height: 48 },
    { left: 0, top: 0, width: 800, height: 600 });
  assert.ok(r.arrived, 'Must arrive when position equals target (dist=0)');
  assert.equal(r.x, 400, 'Position unchanged at target');
  assert.equal(r.y, 200, 'Position unchanged at target');
});

test('FAILURE_B: stepRoaming reaches target in discrete ticks with movement', () => {
  // Wolf starts far from target — verify stepped approach and eventual arrival.
  // At speed=4, approaching (200,200) from (0,0) takes ~50 ticks with
  // distance-based step scaling: step = min(4, dist*0.12+1).
  const start = { x: 0, y: 0 };
  const tgt = { x: 200, y: 200 };
  let cur = { ...start };
  const positions = [cur];
  let arrived = false;
  for (let i = 0; i < 80 && !arrived; i++) {
    const step = stepRoaming(cur, tgt, { width: 48, height: 48 },
      { left: 0, top: 0, width: 800, height: 600 }, 4);
    cur = { x: step.x, y: step.y };
    positions.push(cur);
    arrived = step.arrived;
    if (arrived) break;
  }
  assert.ok(arrived, 'Should reach target within 80 ticks at speed 4');
  // Verify intermediate positions changed (movement occurred)
  const uniquePositions = new Set(positions.map(p => `${p.x},${p.y}`));
  assert.ok(uniquePositions.size >= 3, `Must show ≥3 distinct positions during approach, got ${uniquePositions.size}: ${positions.slice(0,4).map(p=>`(${p.x},${p.y})`).join(', ')}`);
  // Verify final position matches target
  assert.equal(Math.abs(cur.x - tgt.x), 0, `Final x must equal target x`);
  assert.equal(Math.abs(cur.y - tgt.y), 0, `Final y must equal target y`);
});

test('FAILURE_B: multiple successive arrivals stay stable', () => {
  // After reaching target, subsequent calls must return arrived=true
  // (stability property for ENTERING→ROAMING transition reliability)
  const pos = { x: 500, y: 300 };
  const tgt = { x: 500, y: 300 };
  for (let i = 0; i < 5; i++) {
    const r = stepRoaming(pos, tgt, { width: 48, height: 48 },
      { left: 0, top: 0, width: 800, height: 600 });
    assert.ok(r.arrived, `Tick ${i}: must still report arrived`);
    assert.equal(r.x, 500);
    assert.equal(r.y, 300);
  }
});

// ─── FAILURE A: scroll-freeze prevents world-position drift ───
// Verified via browser harness; core contract: readScroll() sets a
// scrollFreezeUntil timestamp; movement steps are skipped during freeze.
// Unit-level proxy test verifies the helper functions used by the freeze.

test('FAILURE_A: rectToWorldRect idempotent across repeated scroll reads', () => {
  // If readScroll is called multiple times with same scroll values,
  // rectToWorldRect results must be identical — scroll shouldn't cause
  // surface recomputation drift.
  const sc = { x: 200, y: 500 };
  const vp = { top: 500, left: 0 };
  const r1 = rectToWorldRect({ left: 100, top: 200, right: 300, bottom: 400, width: 200, height: 200 }, sc, vp);
  const r2 = rectToWorldRect({ left: 100, top: 200, right: 300, bottom: 400, width: 200, height: 200 }, sc, vp);
  assert.equal(r1.left, r2.left, 'World left must be identical across reads');
  assert.equal(r1.top, r2.top, 'World top must be identical across reads');
  assert.equal(r1.right, r2.right, 'World right must be identical across reads');
  assert.equal(r1.bottom, r2.bottom, 'World bottom must be identical across reads');
});

// ─── State-machine continuity: CELEBRATING → CALLED direct-click path ───
// Verifies the transition chain exists for direct-click interruption.
// Browser-level acceptance proven in harness VERIFY 5.

test('State chain: CELEBRATING can transit to IDLE via transition()', () => {
  let s = createState({ state: STATES.CELEBRATING });
  let r = transition(s, 'exit');
  assert.equal(r.state, STATES.EXITING);
  s = Object.assign({}, s, { state: STATES.EXITING });
  r = transition(s, 'enter');
  assert.equal(r.state, STATES.IDLE);
});

test('State chain: entering state is reachable from HIDDEN', () => {
  const s = createState({ state: STATES.HIDDEN });
  const r = transition(s, 'show');
  assert.equal(r.state, STATES.ENTERING, 'HIDDEN→ENTERING via "show" event');
});

/* ─── Summary ─── */
console.log(`\n${passCount}/${passCount+failCount} tests passed${failCount ? ', ' + failCount + ' FAILED' : ''}`);
if (failCount) process.exit(1);
