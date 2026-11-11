const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { demoFrame, playDemo } = loadTs('src/features/onboarding/demo-playback.ts');
const phrase = "I read the chapter twice, but I can't remember it. What could I try?";

test('the example grows one transcript, holds the question trigger, then reveals an insight', () => {
  assert.equal(demoFrame(null, phrase).phase, 'idle');
  const first = demoFrame(0, phrase);
  const middle = demoFrame(1280, phrase);
  assert.equal(first.phase, 'transcribing');
  assert.ok(middle.transcript.startsWith(first.transcript));
  assert.ok(middle.transcript.length < phrase.length);
  const question = demoFrame(2500, phrase);
  assert.equal(question.phase, 'question');
  assert.equal(question.transcript, phrase);
  const insight = demoFrame(10000, phrase);
  assert.equal(insight.phase, 'insight');
  assert.equal(insight.transcript, phrase);
  assert.equal(insight.progress, 100);
});

test('reduced motion reveals the complete transcript without typewriter motion and still shows the trigger', () => {
  assert.equal(demoFrame(0, phrase, true).transcript, phrase);
  assert.equal(demoFrame(900, phrase, true).phase, 'question');
  assert.equal(demoFrame(2100, phrase, true).phase, 'insight');
  for (const time of [-1, NaN, 0, 500, 10000]) {
    const frame = demoFrame(time, phrase);
    assert.ok(frame.progress >= 0 && frame.progress <= 100);
  }
});

test('playback stops scheduling after its insight and ignores queued callbacks after unmount', () => {
  let time = 0;
  const queued = [];
  const cancelled = [];
  const frames = [];
  const stop = playDemo({
    phrase,
    reducedMotion: false,
    now: () => time,
    schedule: (callback) => {
      queued.push(callback);
      return queued.length;
    },
    cancel: (id) => cancelled.push(id),
    onFrame: (frame) => frames.push(frame),
  });
  time = 1000;
  queued[0]();
  assert.equal(frames.length, 1);
  stop();
  queued[1]();
  assert.equal(frames.length, 1);
  assert.deepEqual(cancelled, [2]);
  const complete = [];
  time = 0;
  playDemo({
    phrase,
    reducedMotion: false,
    now: () => time,
    schedule: (fn) => complete.push(fn),
    cancel: () => {},
    onFrame: (frame) => frames.push(frame),
  });
  time = 10000;
  complete[0]();
  assert.equal(frames.at(-1).phase, 'insight');
  assert.equal(complete.length, 1);
});
