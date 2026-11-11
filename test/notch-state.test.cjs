const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createNotchState } = require('../src/main/application/runtime/notch-state.cjs');

function harness() {
  let clock = 1000;
  const state = createNotchState({ now: () => clock });
  return {
    state,
    tick: (ms) => {
      clock += ms;
    },
  };
}
const visible = { activeId: 's1', visible: true, concealed: false };
const offer = (state, overrides = {}) => {
  let expanded = 0;
  const id = state.offer(
    {
      requestId: 'r1',
      sessionId: 's1',
      answer: 'Answer.',
      automatic: true,
      activeId: 's1',
      notchOpen: true,
      ...overrides,
    },
    () => {
      expanded++;
      state.setExpanded(true);
    },
  );
  return { id, expanded };
};

test('an automatic answer expands the Notch and waits for a visible acknowledgement', () => {
  const { state } = harness();
  assert.deepEqual(offer(state), { id: 'r1', expanded: 1 });
  assert.equal(state.status('s1').pendingAutomatic, true);
  assert.equal(state.acknowledge('r1', visible), true);
  assert.deepEqual(state.snapshot(), { pending: null, displayed: { id: 'r1', sessionId: 's1', at: 1000 } });
});

test('stale ids, other sessions, hidden or concealed windows and a collapsed Notch cannot acknowledge', () => {
  const { state } = harness();
  offer(state, { automatic: false });
  assert.equal(state.acknowledge('r1', visible), false, 'collapsed');
  state.setExpanded(true);
  assert.equal(state.acknowledge('old', visible), false);
  assert.equal(state.acknowledge('r1', { ...visible, activeId: 's2' }), false);
  assert.equal(state.acknowledge('r1', { ...visible, visible: false }), false);
  assert.equal(state.acknowledge('r1', { ...visible, concealed: true }), false);
  assert.equal(state.snapshot().pending.id, 'r1');
});

test('an empty answer, another session or a closed Notch gets no acknowledgement id', () => {
  const { state } = harness();
  assert.equal(offer(state, { answer: '  ' }).id, null);
  assert.equal(offer(state, { sessionId: 's2' }).id, null);
  assert.equal(offer(state, { notchOpen: false }).id, null);
  assert.equal(state.snapshot().pending, null);
});

test('collapsing drops an unseen automatic insight but keeps a requested answer; a new window keeps both', () => {
  const { state } = harness();
  offer(state);
  state.setExpanded(false);
  assert.equal(state.snapshot().pending, null);
  offer(state, { automatic: false });
  state.setExpanded(false);
  assert.equal(state.snapshot().pending.id, 'r1');
  state.setExpanded(true);
  state.resetExpanded();
  assert.equal(state.expanded(), false);
  assert.equal(state.snapshot().pending.id, 'r1');
});

test('pruning drops a pending answer from another session, and an automatic one while concealed', () => {
  const { state } = harness();
  offer(state);
  state.prune({ activeId: 's1', concealed: false });
  assert.ok(state.snapshot().pending);
  state.prune({ activeId: 's1', concealed: true });
  assert.equal(state.snapshot().pending, null);
  offer(state, { automatic: false });
  state.prune({ activeId: 's2', concealed: false });
  assert.equal(state.snapshot().pending, null);
});

test('a new automatic insight waits for the minimum visible time after the last display', () => {
  const { state, tick } = harness();
  const settings = { notchEnabled: true, notchMinimumVisibleSeconds: 5 };
  assert.equal(state.canStart(settings, 's1', 's1'), true);
  offer(state);
  assert.equal(state.canStart(settings, 's1', 's1'), false, 'pending automatic');
  state.acknowledge('r1', visible);
  tick(4999);
  assert.equal(state.canStart(settings, 's1', 's1'), false);
  tick(1);
  assert.equal(state.canStart(settings, 's1', 's1'), true);
  assert.equal(state.canStart({ ...settings, notchEnabled: false }, 's1', 's1'), true);
});
