const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { SessionController } = loadTs('src/features/workspace/session-controller.ts');

function harness(state = { activeSessionId: 'live' }) {
  const log = [],
    pending = new Map();
  const api = {
    session: (id) => new Promise((resolve) => pending.set(id, resolve)),
    createSession: async (title) => ({ id: 'new', title }),
    state: async () => ({ activeSessionId: 'new' }),
  };
  const controller = new SessionController(api, {
    state: () => state,
    show: (value) => log.push(['show', value.id]),
    setState: (value) => log.push(['state', value.activeSessionId]),
    clearImages: () => log.push(['clear']),
    navigate: () => log.push(['navigate']),
  });
  return { controller, log, resolve: (id) => pending.get(id)({ id }), state };
}

test('a slower older refresh never replaces a newer one', async () => {
  const { controller, log, resolve } = harness();
  controller.selectedId = 'a';
  const first = controller.refresh();
  controller.selectedId = 'b';
  const second = controller.refresh();
  resolve('b');
  await second;
  resolve('a');
  await first;
  assert.deepEqual(log, [['show', 'b']]);
  assert.equal(controller.selectedId, 'b');
});

test('with nothing selected the live session is shown', async () => {
  const { controller, log, resolve } = harness();
  const refresh = controller.refresh();
  resolve('live');
  await refresh;
  assert.deepEqual(log, [['show', 'live']]);
});

test('opening another session clears attachments; reopening the same keeps them', async () => {
  const { controller, log, resolve } = harness();
  let open = controller.open('a');
  resolve('a');
  await open;
  open = controller.open('a');
  resolve('a');
  await open;
  assert.deepEqual(log, [['clear'], ['show', 'a'], ['navigate'], ['show', 'a'], ['navigate']]);
});

test('ensure starts a session only when none is live', async () => {
  const idle = harness({ activeSessionId: null });
  await idle.controller.ensure(() => 'Meeting');
  assert.deepEqual(idle.log, [['clear'], ['show', 'new'], ['state', 'new'], ['navigate']]);
  const none = new SessionController({}, { state: () => null });
  await assert.rejects(
    none.ensure(() => 'x'),
    /still opening/,
  );
});

test('floating starts and resumes the live session without navigating the main window', async () => {
  const idle = harness({ activeSessionId: null });
  await idle.controller.ensure(() => 'Meeting', false);
  assert.deepEqual(idle.log, [['clear'], ['show', 'new'], ['state', 'new']]);
  const live = harness();
  const opening = live.controller.ensure(() => 'Meeting', false);
  live.resolve('live');
  await opening;
  assert.deepEqual(live.log, [['clear'], ['show', 'live']]);
});
