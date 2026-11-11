// The floating bar's live wave: each side's loudness, rising at once, falling gently, reported at most every 80 ms.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { blockLevel, LevelMeter } = loadTs('src/audio/level-meter.ts');

const block = (amplitude) => new Int16Array(160).fill(amplitude);

test('silence is 0, a loud block is 1, and speech lands in between', () => {
  assert.equal(blockLevel(new Int16Array(0)), 0);
  assert.equal(blockLevel(block(0)), 0);
  assert.equal(blockLevel(block(1)), 0);
  assert.equal(blockLevel(block(32767)), 1);
  const speech = blockLevel(block(3000));
  assert.ok(speech > 0.5 && speech < 1, String(speech));
});

test('each side has its own level, reported at most once per interval', () => {
  const reports = [];
  let now = 0;
  const meter = new LevelMeter(
    (levels) => reports.push({ ...levels }),
    () => now,
  );
  meter.feed('THEY', block(32767));
  now = 40;
  meter.feed('ME', block(32767));
  assert.equal(reports.length, 1);
  assert.deepEqual(reports[0], { me: 0, they: 1 });
  now = 80;
  meter.feed('ME', block(0));
  assert.equal(reports.length, 2);
  assert.equal(reports[1].they, 1);
  assert.ok(reports[1].me > 0.8 && reports[1].me < 1, 'the level falls gently instead of dropping to silence');
});

test('reset reports silence on both sides at once', () => {
  const reports = [];
  const meter = new LevelMeter(
    (levels) => reports.push({ ...levels }),
    () => 0,
  );
  meter.feed('THEY', block(32767));
  meter.reset();
  assert.deepEqual(reports.at(-1), { me: 0, they: 0 });
});

test('stopping an incoming source clears only its level and preserves the microphone reading', () => {
  const values = [];
  const meter = new LevelMeter(
    (value) => values.push({ ...value }),
    () => 100,
    0,
  );
  const block = new Int16Array(512).fill(10000);
  meter.feed('ME', block);
  meter.feed('THEY', block);
  meter.resetSpeaker('THEY');
  assert.equal(values.at(-1).they, 0);
  assert.ok(values.at(-1).me > 0);
});
