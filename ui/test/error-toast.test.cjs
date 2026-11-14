const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTsx } = require('./helpers/load-tsx.cjs');

test('repeated failures update one short-lived, dismissible error notification', () => {
  const visible = new Map();
  const { showError } = loadTsx('src/features/workspace/error-toast.ts', {
    sonner: { toast: { error: (message, options) => visible.set(options.id, { message, ...options }) } },
  });
  const action = { label: 'Connect AI', onClick() {} };
  showError('Missing key', action);
  showError('Missing key', action);
  showError('Provider unavailable');
  assert.equal(visible.size, 1);
  const error = [...visible.values()][0];
  assert.equal(error.message, 'Provider unavailable');
  assert.equal(error.duration, 3000);
  assert.equal(error.closeButton, true);
  assert.equal(error.action, undefined);
});

test('a refused Keychain read offers a restart, every shown error is reported, and main-process errors are not sent back', () => {
  const visible = new Map();
  const reported = [];
  let restarted = 0;
  const keychain = 'macOS blocked the Keychain fixture.';
  const { showError, setRestartAction, setErrorReport } = loadTsx('src/features/workspace/error-toast.ts', {
    sonner: { toast: { error: (message, options) => visible.set(options.id, { message, ...options }) } },
    'src/i18n.ts': { documentT: (key) => (key === 'common.restartApp' ? 'Restart app' : key) },
    'src/locales/en.ts': { en: { 'error.keychainBlocked': keychain } },
  });
  setRestartAction(() => restarted++);
  setErrorReport((message) => reported.push(message));
  showError(keychain);
  const shown = visible.get('workspace-error');
  assert.equal(shown.duration, 15000);
  assert.equal(shown.action.label, 'Restart app');
  shown.action.onClick();
  assert.equal(restarted, 1);
  showError('Provider unavailable');
  assert.equal(visible.get('workspace-error').action, undefined);
  assert.equal(visible.get('workspace-error').duration, 3000);
  showError('Sent by the main process', undefined, { fromMain: true });
  assert.deepEqual(reported, [keychain, 'Provider unavailable']);
});

test('handing feedback to main transfers presentation instead of also showing a local toast', () => {
  const shown = [],
    forwarded = [];
  const { showError, setErrorReport, routeFeedback } = loadTsx('src/features/workspace/error-toast.ts', {
    sonner: { toast: { error: (message) => shown.push(message) } },
  });
  setErrorReport((message, notice) => {
    forwarded.push({ message, notice });
    return true;
  });
  showError('Native capture refused');
  assert.deepEqual(shown, []);
  assert.equal(routeFeedback('Native capture refused', { permission: 'screen' }), true);
  assert.equal(forwarded.length, 2);
  assert.equal(forwarded[1].notice.permission, 'screen');
  showError('Destination received it', undefined, { fromMain: true });
  assert.deepEqual(shown, ['Destination received it']);
  assert.equal(forwarded.length, 2, 'received feedback is never forwarded again');
});

test('a disconnected microphone offers a working Audio Settings action, including forwarded and translated errors', () => {
  const visible = [],
    forwarded = [];
  let opened = 0;
  const missing = 'The selected microphone is not connected. Choose another one in Settings → Audio.';
  const translated = 'O microfone selecionado não está conectado. Escolha outro em Configurações → Áudio.';
  const { showError, setAudioSettingsAction, setErrorReport } = loadTsx('src/features/workspace/error-toast.ts', {
    sonner: { toast: { error: (message, options) => visible.push({ message, options }) } },
    'src/i18n.ts': {
      documentT: (key) =>
        ({
          'error.theSelectedMicrophoneIsNotConnected': translated,
          'audio.changeMicrophone': 'Trocar microfone',
        })[key] ?? key,
    },
  });
  setAudioSettingsAction(() => opened++);
  setErrorReport((message) => {
    forwarded.push(message);
    return false;
  });
  for (const message of [missing, translated]) {
    showError(message, undefined, { fromMain: true });
    const toast = visible.at(-1);
    assert.equal(toast.options.action.label, 'Trocar microfone');
    assert.equal(toast.options.duration, 15000);
    toast.options.action.onClick();
  }
  assert.equal(opened, 2);
  assert.deepEqual(forwarded, []);
  const explicit = { label: 'Custom recovery', onClick() {} };
  showError(missing, explicit);
  assert.equal(visible.at(-1).options.action, explicit);
  showError('A different failure');
  assert.equal(visible.at(-1).options.action, undefined);
});
