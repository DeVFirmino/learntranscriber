const { test } = require('node:test');
const assert = require('node:assert/strict');
const { utteranceState, feedUtterance, endUtterance } = require('../src/main/domain/audio/utterance-segmenter.cjs');

const voice = (ms) => new Int16Array(ms * 16).fill(2000).buffer;
const silence = (ms) => new Int16Array(ms * 16).buffer;

test('quiet audio never starts an utterance and keeps only a short pre-roll', () => {
  const state = utteranceState();
  assert.deepEqual(feedUtterance(state, silence(2000)), []);
  assert.equal(state.heard, false);
  assert.equal(state.preRollBytes, 7680);
  assert.deepEqual(endUtterance(state), { heard: false, audio: null });
});

test('speech starts after 160 ms, offers preview windows and ends after one second of silence', () => {
  const state = utteranceState();
  assert.deepEqual(feedUtterance(state, voice(140)), []);
  assert.equal(state.heard, false);
  const actions = feedUtterance(state, voice(1000));
  assert.equal(state.heard, true);
  assert.ok(actions.length >= 1 && actions.every((action) => action.preview?.length >= 24000));
  const ending = feedUtterance(state, silence(1000)).find((action) => action.end);
  assert.equal(ending.end.heard, true);
  assert.equal(ending.end.audio.length % 640, 0);
  assert.equal(state.heard, false);
  assert.equal(state.bytes, 0);
});

test('a partial frame carries into the next feed and a short utterance has no final audio', () => {
  const state = utteranceState();
  feedUtterance(state, new Int16Array(100).buffer);
  assert.equal(state.carry.length, 200);
  feedUtterance(state, voice(300));
  assert.deepEqual(endUtterance(state).audio, null);
});
