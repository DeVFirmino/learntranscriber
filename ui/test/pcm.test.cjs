// One drain's blocks join into one run of samples, as live captions receive them.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { joinPcm } = loadTs('src/audio/pcm.ts');
test('the blocks of one drain join into one run of samples', () => {
  assert.deepEqual([...joinPcm([new Int16Array([1, 2]), new Int16Array([3])])], [1, 2, 3]);
  assert.equal(joinPcm([]).length, 0);
});
