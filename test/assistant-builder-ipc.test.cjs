const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openDatabase } = require('../src/main/infrastructure/sqlite/database.cjs');
const { createRepositories } = require('../src/main/infrastructure/sqlite/repositories.cjs');
const { createAppliedProposals } = require('../src/main/application/assistants/applied-proposals.cjs');
const { createRequestRegistry } = require('../src/main/application/runtime/requests.cjs');
const { createModelRoute } = require('../src/main/application/runtime/model-route.cjs');
const { createAssistantBuild } = require('../src/main/application/assistants/build.cjs');
const { createProposalApplication } = require('../src/main/application/assistants/apply-proposal.cjs');
const { createIpcRegistrar } = require('../src/main/interface/ipc/register.cjs');
const { registerAssistantBuilder } = require('../src/main/interface/ipc/assistant-builder.cjs');

function harness(t, { build = async () => ({ draft: {} }) } = {}) {
  const repos = createRepositories(openDatabase(':memory:'));
  t.after(() => repos.db.close());
  const map = new Map(),
    state = { changes: 0 },
    handlers = new Map(),
    main = { id: 1 },
    overlay = { id: 2 },
    applied = createAppliedProposals();
  const handle = createIpcRegistrar({
    ipcMain: { handle: (channel, fn) => handlers.set(channel, fn) },
    trusted: () => {},
    accepts: () => true,
  });
  registerAssistantBuilder(handle, {
    requests: createRequestRegistry({ requests: map, timers: { setTimeout, clearTimeout } }),
    build: createAssistantBuild({
      proposals: applied,
      settings: () => ({ provider: 'openai' }),
      builder: () => ({ build }),
      route: createModelRoute({
        acquireLocal: () => {
          throw new Error('unused');
        },
      }),
    }),
    proposals: createProposalApplication({
      applied,
      library: repos.assistants,
      saveSettings: (patch) => repos.settings.update(patch),
      changed: () => state.changes++,
    }),
    isMainWindow: (event) => event.sender === main,
  });
  const call = (sender, channel, input) => handlers.get(channel)({ sender }, input);
  return { repos, map, state, main, overlay, call, applied };
}
const createProposal = {
  tool: 'create_assistant',
  args: { assistant_name: 'Coach', system_prompt: 'Coach the user.' },
  token: 'p1',
};

test('the floating assistant cannot apply a proposal and nothing changes', async (t) => {
  const { repos, state, overlay, call } = harness(t);
  const before = repos.assistants.all().length;
  assert.deepEqual(await call(overlay, 'assistants:apply-builder-action', { proposal: createProposal }), {
    ok: false,
    error: 'Unsupported builder action.',
  });
  assert.equal(repos.assistants.all().length, before);
  assert.equal(state.changes, 0);
});

test('a failed proposal publishes nothing; a valid one publishes once and replays without a second write', async (t) => {
  const { repos, state, main, call, applied } = harness(t);
  const protectedDelete = { tool: 'delete_assistant', args: { id: 'general' }, token: 'p0' };
  applied.issue([protectedDelete, createProposal]);
  assert.equal((await call(main, 'assistants:apply-builder-action', { proposal: protectedDelete })).ok, false);
  assert.equal(state.changes, 0);
  const first = await call(main, 'assistants:apply-builder-action', { proposal: createProposal });
  assert.equal(first.ok, true, first.error);
  const count = repos.assistants.all().length;
  assert.equal(state.changes, 1, 'the first application publishes once');
  assert.deepEqual(await call(main, 'assistants:apply-builder-action', { proposal: createProposal }), first);
  assert.equal(repos.assistants.all().length, count);
  assert.equal(state.changes, 1, 'a replay does not publish again');
});

test('a build turn runs as an owned request, registers its proposals and is removed when it ends', async (t) => {
  const { map, main, call, applied } = harness(t, {
    build: async (_settings, _input, signal) => {
      assert.equal(map.get('b1').mode, 'assistantBuilder');
      assert.equal(signal.aborted, false);
      return { draft: { name: 'Coach' }, proposals: [createProposal] };
    },
  });
  assert.deepEqual(await call(main, 'assistants:build', { requestId: 'b1' }), {
    ok: true,
    value: { draft: { name: 'Coach' }, proposals: [createProposal] },
  });
  assert.equal(map.size, 0);
  // An issued token is recognised: a changed request is refused as changed, not as expired.
  assert.throws(() => applied.apply(null, { ...createProposal, args: {} }, null), /proposal changed/);
});
