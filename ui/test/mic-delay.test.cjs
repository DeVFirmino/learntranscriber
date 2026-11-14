// The microphone is held back 200 ms: each block comes out delayed by the held audio, and taking the held audio
// returns it oldest first and empties the delay.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { MicDelay } = loadTs('src/audio/mic-delay.ts');
const { append, usable } = loadTs('src/audio/float-samples.ts', { Float32Array });

// At 30 Hz, 200 ms is six samples.
const block = (...values) => new Float32Array(values);

test('a block comes out delayed by the held audio, which starts silent', () => {
  const delay = new MicDelay();
  assert.equal(delay.holding, false);
  assert.deepEqual([...delay.align(block(1, 2, 3, 4), 30)], [0, 0, 0, 0]);
  assert.equal(delay.holding, true);
  assert.deepEqual([...delay.align(block(5, 6, 7, 8), 30)], [0, 0, 1, 2]);
});

test('the held audio is taken oldest first and the delay starts over', () => {
  const delay = new MicDelay();
  delay.align(block(1, 2, 3, 4, 5, 6, 7, 8), 30);
  assert.deepEqual([...delay.take()], [3, 4, 5, 6, 7, 8]);
  assert.equal(delay.holding, false);
  assert.equal(delay.take(), null);
});

test('a new sample rate starts a new delay, and a rate too low for one sample passes the block through', () => {
  const delay = new MicDelay();
  delay.align(block(1, 2, 3, 4, 5, 6), 30);
  assert.deepEqual([...delay.align(block(9, 9, 9, 9), 15)], [0, 0, 0, 9]);
  const through = block(1, 2);
  assert.equal(new MicDelay().align(through, 2), through);
});

test('two blocks join when both exist, and an empty block is not worth processing', () => {
  assert.deepEqual([...append(block(1), block(2, 3))], [1, 2, 3]);
  const only = block(4);
  assert.equal(append(null, only), only);
  assert.equal(append(only, null), only);
  assert.equal(usable(block()), false);
  assert.equal(usable(null), false);
  assert.equal(usable(block(1)), true);
});
