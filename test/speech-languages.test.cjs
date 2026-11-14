const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  AUTO_SPEECH_LOCALE,
  AUTO_SPEECH_LOCALES,
  speechLanguages,
  speechLanguageLabel,
} = require('../src/main/domain/audio/speech-languages.cjs');

test('automatic listens in US English first and Brazilian Portuguese as the alternate', () => {
  assert.equal(AUTO_SPEECH_LOCALE, 'auto');
  assert.deepEqual([...AUTO_SPEECH_LOCALES], ['en-US', 'pt-BR']);
  assert.ok(Object.isFrozen(AUTO_SPEECH_LOCALES));
  assert.deepEqual(speechLanguages('auto'), { primary: 'en-US', alternate: 'pt-BR' });
});

test('any other setting listens in that language alone', () => {
  for (const setting of ['en-US', 'pt-BR', 'es-ES', '', 'Auto'])
    assert.deepEqual(speechLanguages(setting), { primary: setting, alternate: null });
});

test('sessions name the automatic setting by its languages and any other by itself', () => {
  assert.equal(speechLanguageLabel('auto'), 'Auto EN + PT');
  assert.equal(speechLanguageLabel('pt-BR'), 'pt-BR');
});

test('a session records automatic Apple Speech by its languages', () => {
  const { sessionMetadata } = require('../src/main/domain/sessions/rules.cjs');
  const metadata = (appleSpeechLocale) =>
    sessionMetadata({ provider: 'openai', model: 'm', transcriptionProvider: 'apple', appleSpeechLocale }, {})
      .transcriptionModel;
  assert.equal(metadata('auto'), 'Apple Speech (Auto EN + PT)');
  assert.equal(metadata('pt-BR'), 'Apple Speech (pt-BR)');
});
