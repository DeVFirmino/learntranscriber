const { test } = require('node:test');
const assert = require('node:assert/strict');
const { notchBounds, movedNotchBounds, resizedNotchBounds } = require('../src/main/domain/notch/geometry.cjs');
const { validateSettings } = require('../src/main/domain/settings/validate.cjs');
const { openDatabase } = require('../src/main/infrastructure/sqlite/database.cjs');
const { createRepositories } = require('../src/main/infrastructure/sqlite/repositories.cjs');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

const area = { x: -1000, y: 50, width: 1000, height: 700 };
const settings = { notchPinned: true, notchX: 0, notchY: 0, notchWidth: 436, notchHeight: 212 };

test('pinned Notch centers at the display top and restores its expanded size', () => {
  assert.deepEqual(notchBounds(settings, area, true), { x: -718, y: 58, width: 436, height: 212 });
  assert.deepEqual(notchBounds(settings, area, false), { x: -542, y: 58, width: 84, height: 48 });
});

test('drag clamps to the current display and snaps only within the top-center threshold', () => {
  const current = notchBounds(settings, area, true);
  assert.deepEqual(movedNotchBounds(current, area, -5000, 900, false).bounds, {
    x: -1000,
    y: 538,
    width: 436,
    height: 212,
  });
  assert.equal(movedNotchBounds(current, area, -700, 80, true).pinned, true);
  assert.deepEqual(movedNotchBounds(current, area, -700, 80, true).bounds, current);
  assert.equal(movedNotchBounds(current, area, -1000, 300, true).pinned, false);
});

test('resize respects display clearance and keeps a pinned Notch centered', () => {
  const current = notchBounds(settings, area, true);
  assert.deepEqual(resizedNotchBounds(current, area, 2000, 900, true), { x: -950, y: 58, width: 900, height: 640 });
  assert.deepEqual(resizedNotchBounds({ ...current, x: -10 }, area, 360, 160, false), {
    x: -360,
    y: 58,
    width: 360,
    height: 160,
  });
});

test('floating collapsed Notch keeps its expanded anchor and recovers offscreen coordinates', () => {
  const floating = { ...settings, notchPinned: false, notchX: -900, notchY: 300 };
  assert.deepEqual(notchBounds(floating, area, false), { x: -724, y: 300, width: 84, height: 48 });
  assert.deepEqual(notchBounds(floating, area, true), { x: -900, y: 300, width: 436, height: 212 });
  assert.deepEqual(notchBounds({ ...floating, notchX: 5000, notchY: 5000 }, area, true), {
    x: -436,
    y: 538,
    width: 436,
    height: 212,
  });
  assert.deepEqual(notchBounds(settings, { x: 0, y: 0, width: 320, height: 140 }, true), {
    x: 0,
    y: 0,
    width: 320,
    height: 140,
  });
});

test('Notch position, pin state and expanded size survive reopening while malformed geometry rejects', () => {
  const directory = mkdtempSync(join(tmpdir(), 'notch-geometry-'));
  let repos;
  try {
    const file = join(directory, 'data.sqlite');
    repos = createRepositories(openDatabase(file));
    const geometry = { notchPinned: false, notchX: -900, notchY: 300, notchWidth: 600, notchHeight: 320 };
    repos.settings.update(geometry);
    repos.db.close();
    repos = createRepositories(openDatabase(file));
    for (const [key, value] of Object.entries(geometry)) assert.equal(repos.settings.read()[key], value);
    for (const input of [
      { notchWidth: 359 },
      { notchWidth: 901 },
      { notchHeight: 159 },
      { notchHeight: 641 },
      { notchX: Infinity },
      { notchY: 1.5 },
      { notchPinned: 'true' },
    ])
      assert.throws(() => validateSettings(input));
  } finally {
    repos?.db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
