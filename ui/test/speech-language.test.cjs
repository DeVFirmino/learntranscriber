// The floating panel offers automatic recognition first, keeps an unusual saved language, and lists each once.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { AUTO_SPEECH_LOCALE, speechLanguageOptions } = loadTs('src/features/speech-language.ts');
const plain = (value) => JSON.parse(JSON.stringify(value));

test('automatic comes first and matches the main process setting', () => {
  assert.equal(AUTO_SPEECH_LOCALE, 'auto');
  assert.deepEqual(plain(speechLanguageOptions('auto')), ['auto', 'pt-BR', 'en-US', 'es-ES']);
  assert.deepEqual(plain(speechLanguageOptions('en-US')), ['auto', 'en-US', 'pt-BR', 'es-ES']);
});

test('a saved language outside the common ones stays selectable after automatic', () => {
  assert.deepEqual(plain(speechLanguageOptions('fr-FR')), ['auto', 'fr-FR', 'pt-BR', 'en-US', 'es-ES']);
});
