const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createSpeechAssets } = require('../src/main/application/audio/speech-assets.cjs');

test('capabilities describe the saved language, or the primary one when it is automatic', async () => {
  const asked = [];
  let saved = 'auto';
  const assets = createSpeechAssets({
    active: { id: () => null },
    settings: () => ({ appleSpeechLocale: saved }),
    nativeSpeech: { capabilities: async (locale) => asked.push(locale) },
  });
  await assets.capabilities();
  saved = 'pt-BR';
  await assets.capabilities();
  assert.deepEqual(asked, ['en-US', 'pt-BR']);
});

test('languages cannot be installed or released while a session is live', () => {
  const assets = createSpeechAssets({
    active: { id: () => 'live' },
    settings: () => ({}),
    nativeSpeech: {
      manageLocale: () => {
        throw new Error('Must not manage languages.');
      },
    },
  });
  assert.throws(() => assets.manageLocale({ operation: 'install', locale: 'pt-BR' }), /End the active session/);
});
