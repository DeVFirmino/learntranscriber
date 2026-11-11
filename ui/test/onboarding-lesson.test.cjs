const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { lessonAction } = loadTs('src/features/onboarding/lesson.ts');

test('practice pause resumes; stop ends the example until an explicit replay', () => {
  assert.equal(lessonAction('listening', 'pause'), 'paused');
  assert.equal(lessonAction('paused', 'pause'), 'listening');
  for (const state of ['listening', 'paused', 'stopped']) assert.equal(lessonAction(state, 'stop'), 'stopped');
  assert.equal(lessonAction('stopped', 'pause'), 'stopped');
  assert.equal(lessonAction('stopped', 'replay'), 'listening');
});
