const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTsx, elements } = require('./helpers/load-tsx.cjs');
const react = require('react');

const text = (node) =>
  elements(node, 'span')
    .concat(elements(node, 'p'), elements(node, 'button'), elements(node, 'h2'), elements(node, 'strong'))
    .flatMap((element) => [element.props.children].flat())
    .filter((child) => typeof child === 'string');

const base = (workspace) => ({
  'src/settings/settings-icon.tsx': { SettingsIcon: 'Icon', ProviderIcon: 'ProviderIcon' },
  'src/settings/use-settings-t.ts': { useSettingsT: () => ({ st: (key) => key }) },
  './provider-page.css': {},
  '../ai-sources/provider-page.css': {},
  'src/workspace.ts': { useWorkspace: () => workspace },
});

test('a provider page header shows the same logo, name and status as its card', () => {
  const { ProviderHeader } = loadTsx('src/settings/tabs/ai-sources/provider-header.tsx', base({}));
  const off = ProviderHeader({ id: 'openai', name: 'OpenAI', connected: false });
  assert.equal(elements(off, 'ProviderIcon')[0].props.providerId, 'openai');
  assert.ok(text(off).includes('OpenAI'));
  assert.ok(text(off).includes('settings.api.cardGrid.notConnected'));
  const on = ProviderHeader({ id: 'openai', name: 'OpenAI', connected: true });
  assert.ok(text(on).includes('settings.api.cardGrid.connected'));
});

function chatgpt(accounts) {
  const calls = [];
  const workspace = {
    state: { chatgpt: { accounts, activeId: accounts[0]?.id ?? null, pending: false } },
    api: {
      loginChatGPT: async () => calls.push('login'),
      logoutChatGPT: async (id) => calls.push(`logout:${id}`),
    },
    act: (task) => task(),
  };
  const { ChatGptAuth } = loadTsx('src/settings/tabs/providers/chatgpt-auth.tsx', {
    ...base(workspace),
    react: { ...react, useState: (initial) => [initial, () => {}] },
    'src/settings/tabs/ai-sources/provider-card.tsx': { ProviderAction: 'ProviderAction' },
  });
  return { calls, view: ChatGptAuth({ onSetUpLocal: () => calls.push('local') }) };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

test('signed out, the ChatGPT row offers the existing sign-in', async () => {
  const { calls, view } = chatgpt([]);
  assert.equal(elements(view, 'Icon')[0].props.name, 'provider-chatgpt');
  const buttons = elements(view, 'ProviderAction');
  assert.equal(buttons.length, 1);
  buttons[0].props.onClick();
  await flush();
  assert.deepEqual(calls, ['login']);
});

test('signed in, the row signs out and explains both credentials with the local-model hint', async () => {
  const { calls, view } = chatgpt([{ id: 'acct', authenticated: true }]);
  assert.ok(text(view).includes('settings.api.chatgptConnected'));
  assert.ok(text(view).includes('settings.api.chatgptBothCredentials'));
  const [signOut, local] = elements(view, 'ProviderAction');
  signOut.props.onClick();
  local.props.onClick();
  await flush();
  assert.deepEqual(calls, ['logout:acct', 'local']);
});
