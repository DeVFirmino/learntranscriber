const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createActiveSession } = require('../src/main/application/runtime/active-session.cjs');
const { createScreenInsights } = require('../src/main/application/context/screen-insights.cjs');

function harness({ auto = true, busy = false, mode = 'proactive' } = {}) {
  const active = createActiveSession();
  active.set('s1');
  const asked = [],
    pending = [],
    privacy = { concealed: false },
    state = { busy, cancelled: [], mode, auto, speaking: false };
  let clock = 100000,
    id = 0;
  const insights = createScreenInsights({
    settings: () => ({ autoScreenInsights: state.auto, insightMode: state.mode }),
    active,
    privacy,
    requests: { busy: () => state.busy, cancelMode: (mode) => state.cancelled.push(mode) },
    speaking: () => state.speaking,
    screenshot: async () => ({
      toDataURL: () => 'data:image/png;base64,AA',
      getSize: () => ({ width: 2880, height: 1800 }),
      resize: (size) => {
        state.resized = size;
        return { toJPEG: (quality) => ((state.quality = quality), Buffer.from('jpeg')) };
      },
      toJPEG: () => Buffer.from('full'),
    }),
    newId: () => String(++id),
    report: () => {},
    showSelection: () => {},
    clock: () => clock,
    ask: { available: () => true, run: async (input) => asked.push(input) },
    timers: {
      setTimeout: (fn, ms) => {
        const timer = { fn, ms };
        pending.push(timer);
        return timer;
      },
      clearTimeout: (timer) => {
        const at = pending.indexOf(timer);
        if (at >= 0) pending.splice(at, 1);
      },
    },
  });
  return {
    insights,
    asked,
    pending,
    privacy,
    state,
    active,
    advance: (ms) => {
      clock += ms;
    },
  };
}
const fire = async (pending) => {
  const timer = pending.shift();
  await timer.fn();
  return timer.ms;
};

test('a newer selection replaces the scheduled insight', async () => {
  const { insights, asked, pending } = harness();
  insights.selected({ sessionId: 's1', text: 'first' });
  insights.selected({ sessionId: 's1', text: 'second' });
  assert.equal(pending.length, 1);
  await fire(pending);
  assert.deepEqual(
    asked.map((item) => [item.mode, item.context]),
    [['screenInsight', 'second']],
  );
});

test('a concealed window, a busy request or a changed session cancels the insight', async () => {
  for (const change of [
    (h) => {
      h.privacy.concealed = true;
    },
    (h) => {
      h.state.busy = true;
    },
    (h) => {
      h.active.set('s2');
    },
    (h) => {
      h.state.speaking = true;
    },
    (h) => {
      h.state.mode = 'only_questions';
    },
    (h) => {
      h.state.auto = false;
    },
  ]) {
    const h = harness();
    h.insights.selected({ sessionId: 's1', text: 'x' });
    change(h);
    await fire(h.pending);
    assert.deepEqual(h.asked, []);
  }
});

test('only question and meeting-notes modes suppress automatic screen selection; explicit opt-outs persist', async () => {
  for (const mode of ['only_questions', 'meeting_notes']) {
    const h = harness({ mode });
    h.insights.selected({ sessionId: 's1', text: 'Selected topic' });
    assert.equal(h.pending.length, 0);
  }
  for (const mode of ['moderate', 'proactive', 'full_power']) {
    const h = harness({ mode });
    h.insights.selected({ sessionId: 's1', text: 'Selected topic' });
    await fire(h.pending);
    assert.equal(h.asked.length, 1, mode);
  }
  const optedOut = harness({ auto: false });
  optedOut.insights.selected({ sessionId: 's1', text: 'Selected topic' });
  assert.equal(optedOut.pending.length, 0);
});

test('after an insight the next waits out 15 seconds, and never less than 800 ms', async () => {
  const { insights, pending, advance } = harness();
  insights.selected({ sessionId: 's1', text: 'a' });
  assert.equal(await fire(pending), 800);
  advance(5000);
  insights.selected({ sessionId: 's1', text: 'b' });
  assert.equal(pending[0].ms, 10000);
  advance(20000);
  insights.selected({ sessionId: 's1', text: 'c' });
  assert.equal(pending.at(-1).ms, 800);
});

test('cancel stops the pending insight and aborts running screen insights', async () => {
  const { insights, asked, pending, state } = harness();
  insights.selected({ sessionId: 's1', text: 'x' });
  insights.cancel();
  assert.equal(pending.length, 0);
  assert.deepEqual(state.cancelled, ['screenInsight']);
  assert.deepEqual(asked, []);
});

test('a copied selection asks a chat question only for the visible, idle live session', async () => {
  const idle = harness();
  await idle.insights.copied({ sessionId: 's1', text: 'code' });
  assert.equal(idle.asked[0].mode, 'chat');
  assert.equal(idle.asked[0].requestId, 'copy-1');
  const busy = harness({ busy: true });
  await busy.insights.copied({ sessionId: 's1', text: 'code' });
  const other = harness();
  await other.insights.copied({ sessionId: 's2', text: 'code' });
  assert.deepEqual([busy.asked, other.asked], [[], []]);
});

test('a started session gets one baseline screen read with the fast image preset', async () => {
  const { insights, asked, pending, state } = harness();
  insights.sessionStarted('s1');
  insights.sessionStarted('s1');
  assert.equal(pending.length, 1, 'once per session');
  assert.equal(await fire(pending), 1);
  assert.deepEqual(asked, [
    {
      requestId: 'baseline-1',
      sessionId: 's1',
      mode: 'screenInsight',
      baseline: true,
      image: 'data:image/jpeg;base64,' + Buffer.from('jpeg').toString('base64'),
    },
  ]);
  assert.deepEqual(state.resized, { width: 1024 });
  assert.equal(state.quality, 82);
});

test('the baseline screen read respects mode, privacy, busy requests and the live session', async () => {
  for (const setup of [
    (h) => (h.state.auto = false),
    (h) => (h.state.mode = 'only_questions'),
    (h) => (h.privacy.concealed = true),
    (h) => (h.state.busy = true),
    (h) => h.active.set('s2'),
  ]) {
    const h = harness();
    h.insights.sessionStarted('s1');
    setup(h);
    await fire(h.pending);
    assert.deepEqual(h.asked, []);
  }
});
