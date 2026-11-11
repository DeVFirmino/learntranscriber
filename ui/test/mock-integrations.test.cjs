// The preview's integrations surface: ChatGPT login and the integration error channel, composed into one
// IntegrationsApi.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');

const globals = {
  crypto,
  structuredClone,
  DOMException,
  setTimeout,
  clearTimeout,
  URL,
  window: { setTimeout, clearTimeout },
};
function context() {
  const { createMockContext } = loadTs('src/bridge/mock/state.ts', globals);
  const ctx = createMockContext();
  return { ctx, integrations: loadTs('src/bridge/mock/integrations.ts', globals).integrationsApi(ctx) };
}

test('ChatGPT login activates one account at a time and clears it on sign-out', async () => {
  const { ctx, integrations } = context();
  const { id } = await integrations.loginChatGPT();
  assert.equal(ctx.state.activeAccount, id);
  assert.equal(ctx.settings.provider, 'chatgpt');
  await assert.rejects(integrations.selectChatGPT('missing'), /Sign in to that ChatGPT account first/);
  const selected = await integrations.selectChatGPT(id);
  assert.equal(selected.activeId, id);
  await integrations.logoutChatGPT(id);
  assert.equal(ctx.state.activeAccount, null);
});
