const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTsx } = require('./helpers/load-tsx.cjs');
const { windowFanOut } = require('../../src/main/infrastructure/electron/fan-out.cjs');

test('the screenshot permission failure travels from the hidden recorder to one panel with one Settings action', async () => {
  const shown = { main: [], panel: [], bar: [] };
  const panes = [];
  const surfaces = {};
  const api = {
    openPrivacyPane: async (permission) => panes.push(permission),
    state: async () => ({
      permissions: { microphone: 'granted', screen: 'granted' },
      settings: {
        onboardingAudioSource: 'computer',
        systemAudio: true,
        systemAudioSource: 'native',
        transcriptionProvider: 'openai',
      },
    }),
    systemAudioStatus: async () => ({ permissionGranted: false }),
  };
  for (const name of Object.keys(shown)) {
    const cache = new Map();
    const mocks = {
      sonner: {
        toast: {
          message: (message, options) => shown[name].push({ message, options, kind: 'hint' }),
          error: (message, options) => shown[name].push({ message, options, kind: 'error' }),
        },
      },
    };
    const events = loadTsx('src/features/workspace/integration-feedback.ts', mocks, cache);
    const errors = loadTsx('src/features/workspace/error-toast.ts', mocks, cache);
    const hints = loadTsx('src/features/workspace/listening-hint.ts', mocks, cache);
    surfaces[name] = { events, errors, hints };
  }
  const window = (name, visible) => ({
    isDestroyed: () => false,
    isVisible: () => visible,
    webContents: { send: (_channel, feedback) => surfaces[name].events.showIntegrationFeedback(api, feedback) },
  });
  const main = window('main', false),
    panel = window('panel', true),
    bar = window('bar', true);
  const fanOut = windowFanOut({
    BrowserWindow: { getAllWindows: () => [main, panel, bar], getFocusedWindow: () => null },
    windows: { panelVisible: () => true, overlay: () => panel, bar: () => bar },
  });
  let reports = 0;
  surfaces.main.errors.setErrorReport((message, notice) => {
    reports++;
    fanOut.toVisible(main.webContents, 'integration:error', { message, notice });
    return true;
  });
  const { createCaptureErrorReporter } = loadTsx('src/features/workspace/capture-error-reporter.ts');
  const report = createCaptureErrorReporter({
    api,
    failure: surfaces.main.errors.showError,
    blocked: (permission, diagnostic) => surfaces.main.hints.showListeningHint(api, permission, { diagnostic }),
  });
  await report(
    'Native system audio could not start (The user declined TCCs for application, window, display capture).',
  );
  assert.equal(reports, 1);
  assert.equal(shown.main.length, 0);
  assert.equal(shown.bar.length, 0);
  assert.equal(shown.panel.length, 1);
  assert.equal(shown.panel[0].kind, 'hint');
  assert.ok(shown.panel[0].message.includes('Screen & System Audio'));
  shown.panel[0].options.action.onClick();
  assert.deepEqual(panes, ['screen']);
});
