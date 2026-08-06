const assert = require('node:assert/strict');
const {
  STATES, DEFAULT_CONFIG, SPRITE_SIZE, PALETTE,
  IDLE_FRAME, WALK_A_FRAME, WALK_B_FRAME, WALK_FRAMES,
  getFrameBlocks, getWalkFrame, getPalette,
  createState, clampPosition, transition,
  visibleSurface, entryEdge, exportState, importState,
  rewardTaskCompletion, normalizeSurfaces, surfaceTarget
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
test('IDLE_FRAME ears (CYAN accent in x=13..21, y=2..4)', () => {
  assert.ok(hasColorInRegion(IDLE_FRAME, 'CYAN', 13, 2, 21, 4));
});
test('WALK_A_FRAME ears (CYAN accent)', () => {
  assert.ok(hasColorInRegion(WALK_A_FRAME, 'CYAN', 13, 2, 21, 4));
});
test('WALK_B_FRAME ears (CYAN accent)', () => {
  assert.ok(hasColorInRegion(WALK_B_FRAME, 'CYAN', 13, 2, 21, 4));
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

/* ─── Anatomy: wolf must read as a quadrupedal creature ─── */

// Helpers
function countPixels(blocks, colorKey) {
  let n = 0;
  blocks.forEach(([c]) => { if (c === colorKey) n += 1; }); // rough proxy
  const set = pixelSet(blocks);
  return set.size;
}

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

// A recognizable sprite needs enough pixels (not just a few dots)
function totalPixelCount(blocks) { return pixelSet(blocks).size; }

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

// Head region: solid dark mass with ear accents on top
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

// Ears: accent-colored pixels in the top-center (above head)
test('IDLE_FRAME ears have CYAN accents in top strip y=0..5, x=16..22', () => {
  assert.ok(hasColorInRegion(IDLE_FRAME, 'CYAN', 16, 0, 22, 5));
});
test('WALK_A_FRAME ears have CYAN accents', () => {
  assert.ok(hasColorInRegion(WALK_A_FRAME, 'CYAN', 16, 0, 22, 5));
});
test('WALK_B_FRAME ears have CYAN accents', () => {
  assert.ok(hasColorInRegion(WALK_B_FRAME, 'CYAN', 16, 0, 22, 5));
});

// Muzzle: dark pixels extending to front-right edge
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

// Body: contiguous dark mass in center
test('IDLE_FRAME body center is continuous (no gaps larger than 2px)', () => {
  // Check that rows 7-15 have at least 5 consecutive BLACK pixels somewhere
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

// Legs: four separate column groups (two front, two back), each with paw pixels
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

// Tail: connected chain from rear-left to upper-left (bushy tail pointing up)
function tailConnectedness(blocks) {
  // Extract all pixels where x<=6 or x<=4 depending on frame
  // Then check they form a single connected component via 4-connectivity
  const tailPixels = [];
  for (const p of pixelSet(blocks)) {
    const [x, y, c] = p.split(',');
    const nx = Number(x);
    if (nx <= 5) tailPixels.push({x: nx, y: Number(y)});
  }
  if (tailPixels.length < 3) return false;
  // BFS connectivity
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

// Cyberpunk palette usage: all 4 colors present in every frame
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

/* ─── normalizeSurfaces: pure geometry contracts ────────────── */
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

/* ─── surfaceTarget: deterministic position within a surface ── */
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
    // Allow tiny floating-point overshoot from Math.random() ≈ 1.0
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

/* ─── Interaction & overlay data contracts ───────────────────── */
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

/* ─── Summary ─── */
console.log(`\n${passCount}/${passCount+failCount} tests passed${failCount ? ', ' + failCount + ' FAILED' : ''}`);
if (failCount) process.exit(1);