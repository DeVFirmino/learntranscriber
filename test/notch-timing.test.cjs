const { test } = require('node:test');
const assert = require('node:assert/strict');
const { canStartAutomaticInsight } = require('../src/main/domain/notch/timing.cjs');

test('automatic insight waits for display acknowledgement and the configured reading time', () => {
  const state = { enabled: true, sessionId: 'active', activeSessionId: 'active', minimumSeconds: 15, now: 20000 };
  assert.equal(canStartAutomaticInsight({ ...state, pending: { sessionId: 'active', automatic: true } }), false);
  assert.equal(canStartAutomaticInsight({ ...state, lastDisplayed: { sessionId: 'active', at: 5001 } }), false);
  assert.equal(canStartAutomaticInsight({ ...state, lastDisplayed: { sessionId: 'active', at: 5000 } }), true);
  assert.equal(canStartAutomaticInsight({ ...state, pending: { sessionId: 'active', automatic: false } }), true);
});

test('automatic insight timing is scoped to the active session and enabled Notch', () => {
  const state = { enabled: true, sessionId: 'active', activeSessionId: 'active', minimumSeconds: 15, now: 20000 };
  const lastDisplayed = { sessionId: 'other', at: 19999 };
  assert.equal(canStartAutomaticInsight({ ...state, lastDisplayed }), true);
  assert.equal(
    canStartAutomaticInsight({ ...state, enabled: false, pending: { sessionId: 'active', automatic: true } }),
    true,
  );
  assert.equal(
    canStartAutomaticInsight({ ...state, activeSessionId: 'other', pending: { sessionId: 'active', automatic: true } }),
    true,
  );
});
