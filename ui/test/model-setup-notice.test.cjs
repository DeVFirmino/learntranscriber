const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { loadTsx, elements } = require('./helpers/load-tsx.cjs');
const { previewSettings } = loadTs('src/bridge/mock/settings-fixture.ts');

function harness() {
  let opened = 0;
  const routes = [];
  const state = {
    settings: { ...previewSettings(), provider: 'chatgpt', model: 'selected-model' },
    chatgpt: { accounts: [], activeId: null },
    credentials: {},
    localModels: { models: [], binaries: {} },
    permissions: {},
  };
  const { ModelSetupNotice } = loadTsx('src/components/model-setup-notice.tsx', {
    './model-setup-notice.css': {},
    'src/components/ui/button.tsx': { Button: 'Button' },
    'src/components/ui/action-button.tsx': { ActionButton: 'Button' },
    'src/workspace.ts': {
      useWorkspace: () => ({
        state,
        act: async (fn) => fn(),
        api: { openAiModels: async () => routes.push('settings/ai/models') },
        openAiSources: () => {
          opened++;
        },
      }),
    },
    'src/use-t.ts': { useT: () => ({ t: (key) => key }) },
  });
  return { state, routes, ModelSetupNotice, opened: () => opened };
}

test('a selected ChatGPT model still offers connection until the active account is authenticated', () => {
  const h = harness();
  const notice = h.ModelSetupNotice();
  const action = elements(notice, 'Button')[0];
  assert.equal(action.props.children, 'setup.connectAI');
  action.props.onClick();
  assert.equal(h.opened(), 1);
  h.state.chatgpt.activeId = 'account';
  h.state.chatgpt.accounts.push({ id: 'account', authenticated: false });
  assert.ok(h.ModelSetupNotice());
  h.state.chatgpt.accounts[0].authenticated = true;
  assert.equal(h.ModelSetupNotice(), null);
});

test('a selected cloud model without a key offers setup; a confirmed key removes the notice', () => {
  const h = harness();
  h.state.settings.provider = 'openai';
  assert.ok(h.ModelSetupNotice());
  h.state.credentials.openai = true;
  assert.equal(h.ModelSetupNotice(), null);
});

test('a connected account without a model opens model selection instead of authentication', () => {
  const h = harness();
  h.state.chatgpt.activeId = 'account';
  h.state.chatgpt.accounts.push({ id: 'account', authenticated: true });
  h.state.settings.model = '';
  const action = elements(h.ModelSetupNotice(), 'Button')[0];
  assert.equal(action.props.children, 'setup.chooseModel');
  action.props.onClick();
  assert.deepEqual(h.routes, ['settings/ai/models']);
  assert.equal(h.opened(), 0);
});
