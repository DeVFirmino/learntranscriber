const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openDatabase } = require('../src/main/infrastructure/sqlite/database.cjs');
const { createRepositories } = require('../src/main/infrastructure/sqlite/repositories.cjs');
const { credentialVault } = require('../src/main/infrastructure/credentials/safe-storage.cjs');
const { createCredentials } = require('../src/main/application/credentials/manage.cjs');
const { createActiveSession } = require('../src/main/application/runtime/active-session.cjs');
const { createWorkspaceState } = require('../src/main/application/runtime/workspace-state.cjs');
const { createWorkspacePublication } = require('../src/main/application/runtime/publication.cjs');

test('the public state carries key status and header names but no secret values', async (t) => {
  const repos = createRepositories(openDatabase(':memory:'));
  t.after(() => repos.db.close());
  const keychain = {
    isAsyncEncryptionAvailable: async () => true,
    encryptStringAsync: async (value) => Buffer.from(`sealed:${value}`),
    decryptStringAsync: async (bytes) => ({ result: bytes.toString().replace(/^sealed:/, '') }),
  };
  const credentials = createCredentials({
    vault: credentialVault({
      credentials: repos.credentials,
      safeStorage: keychain,
      timers: { setTimeout: () => 1, clearTimeout() {} },
    }),
    changed: () => {},
  });
  await credentials.saveKey({ provider: 'openai', key: 'sk-very-secret' });
  await credentials.saveHeaders([{ key: 'X-Team', value: 'header-secret' }]);
  const state = createWorkspaceState({
    library: {
      settings: () => repos.settings.read(),
      credentials: () => repos.credentials.status(),
      headerNames: () => credentials.headerNames(),
      assistants: () => repos.assistants.all(),
      builtInAssistants: () => [],
      sessions: () => repos.sessionSearch.list(),
    },
    runtime: {
      activeId: () => null,
      localModels: () => ({}),
      runtimeInstalls: () => ({}),
      modelCatalog: [],
      chatgpt: () => ({ accounts: [] }),
    },
    windows: { notch: () => ({ expanded: false }), overlay: () => ({ expanded: true }) },
    desktop: { shortcutDefinitions: () => [], privacy: () => ({}), permissions: () => ({}) },
  }).snapshot();
  const json = JSON.stringify(state);
  assert.doesNotMatch(json, /sk-very-secret|header-secret|sealed:/);
  assert.deepEqual(state.customHeaderNames, ['X-Team']);
  assert.equal(state.credentials.openai, true);
  assert.deepEqual(Object.keys(state), [
    'settings',
    'credentials',
    'customHeaderNames',
    'assistants',
    'builtInAssistants',
    'sessions',
    'activeSessionId',
    'localModels',
    'runtimeInstalls',
    'modelCatalog',
    'chatgpt',
    'notch',
    'overlay',
    'shortcutDefinitions',
    'privacy',
    'permissions',
  ]);
});

function publication({ active = null, concealed = false, mode = 'proactive', selection = true } = {}) {
  const calls = [],
    session = createActiveSession();
  if (active) session.set(active);
  const publish = createWorkspacePublication({
    active: session,
    privacy: { concealed },
    settings: () => ({ copyToPrompt: true, autoSelection: selection, insightMode: mode }),
    notch: {
      prune: (context) => calls.push(`prune:${context.activeId}:${context.concealed}`),
      sync: () => calls.push('notch'),
    },
    bar: { sync: () => calls.push('bar') },
    watchers: {
      copy: (id, on) => calls.push(`copy:${id}:${on}`),
      selection: (id, on) => calls.push(`selection:${id}:${on}`),
    },
    insights: { cancel: () => calls.push('insights') },
    tray: { update: () => calls.push('tray') },
    state: { snapshot: () => ({ ok: true }) },
    broadcast: (channel) => calls.push(channel),
  });
  publish.changed();
  return calls;
}

test('a live, visible session keeps the watchers on and publishes last', () => {
  assert.deepEqual(publication({ active: 's1' }), [
    'prune:s1:false',
    'notch',
    'bar',
    'copy:s1:true',
    'selection:s1:true',
    'tray',
    'workspace:changed',
  ]);
});

test('question/meeting-note modes disable the selection watcher and enabled modes preserve explicit opt-outs', () => {
  for (const mode of ['only_questions', 'meeting_notes']) {
    assert.ok(publication({ active: 's1', mode }).includes('selection:s1:false'));
  }
  for (const mode of ['moderate', 'proactive', 'full_power']) {
    assert.ok(publication({ active: 's1', mode, selection: false }).includes('selection:s1:false'));
  }
});

test('concealing cancels insights and turns the watchers off before publishing', () => {
  assert.deepEqual(publication({ active: 's1', concealed: true }), [
    'prune:s1:true',
    'notch',
    'bar',
    'copy:s1:false',
    'insights',
    'selection:s1:false',
    'tray',
    'workspace:changed',
  ]);
  assert.deepEqual(publication(), [
    'prune:null:false',
    'notch',
    'bar',
    'copy:null:true',
    'insights',
    'selection:null:true',
    'tray',
    'workspace:changed',
  ]);
});
