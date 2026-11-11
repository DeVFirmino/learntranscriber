const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createMainActions } = require('../src/main/infrastructure/electron/main-actions.cjs');

function fakeWindow({ loading }) {
  const sent = [];
  const waiting = [];
  return {
    sent,
    finishLoad: () => waiting.splice(0).forEach((listener) => listener()),
    isDestroyed: () => false,
    webContents: {
      isLoadingMainFrame: () => loading,
      once: (event, listener) => event === 'did-finish-load' && waiting.push(listener),
      send: (channel, action) => sent.push([channel, action]),
    },
  };
}

test('an action reaches a workspace that is already loaded right away', () => {
  const main = fakeWindow({ loading: false });
  const shown = [];
  createMainActions({ windows: { showMain: () => shown.push('main'), main: () => main } }).open('openSettings');
  assert.deepEqual(shown, ['main']);
  assert.deepEqual(main.sent, [['workspace:action', 'openSettings']]);
});

test('an action waits for a workspace that is still loading', () => {
  const main = fakeWindow({ loading: true });
  createMainActions({ windows: { showMain: () => {}, main: () => main } }).open('openAiSources');
  assert.deepEqual(main.sent, []);
  main.finishLoad();
  assert.deepEqual(main.sent, [['workspace:action', 'openAiSources']]);
});
