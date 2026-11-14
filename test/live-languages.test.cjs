const { test } = require('node:test');
const assert = require('node:assert/strict');
const { requestedLanguages, preflightLanguages } = require('../src/main/infrastructure/native/live-languages.cjs');

const streams = (supported) => async (locale) => ({
  authorization: 'authorized',
  supportsStreamingRecognition: supported.includes(locale),
});

test('a live session asks for the primary and the automatic alternate, with US English for a blank setting', () => {
  assert.deepEqual(requestedLanguages('auto'), { setting: 'auto', locale: 'en-US', alternate: 'pt-BR' });
  assert.deepEqual(requestedLanguages(' pt-BR '), { setting: ' pt-BR ', locale: 'pt-BR', alternate: null });
  assert.deepEqual(requestedLanguages(''), { setting: '', locale: 'en-US', alternate: null });
});

test('the primary is checked first and the alternate is kept only when it streams', async () => {
  const asked = [];
  const preflight = (locale) => {
    asked.push(locale);
    return streams(['en-US', 'pt-BR'])(locale);
  };
  const both = await preflightLanguages(requestedLanguages('auto'), { preflight, cancelled: () => false });
  assert.deepEqual(both, { setting: 'auto', locale: 'en-US', alternate: 'pt-BR' });
  assert.deepEqual(asked, ['en-US', 'pt-BR']);
  const alone = await preflightLanguages(requestedLanguages('auto'), {
    preflight: streams(['en-US']),
    cancelled: () => false,
  });
  assert.deepEqual(alone, { setting: 'auto', locale: 'en-US', alternate: null });
  const failed = await preflightLanguages(requestedLanguages('auto'), {
    preflight: async (locale) => {
      if (locale === 'pt-BR') throw new Error('Helper timed out.');
      return { authorization: 'authorized', supportsStreamingRecognition: true };
    },
    cancelled: () => false,
  });
  assert.equal(failed.alternate, null);
});

test('a primary that is denied or cannot stream stops the session, and a cancelled one skips the alternate', async () => {
  await assert.rejects(
    preflightLanguages(requestedLanguages('auto'), {
      preflight: async () => ({ authorization: 'denied', supportsStreamingRecognition: true }),
      cancelled: () => false,
    }),
    /Enable Speech Recognition/,
  );
  await assert.rejects(
    preflightLanguages(requestedLanguages('auto'), { preflight: streams(['pt-BR']), cancelled: () => false }),
    /Streaming Apple Speech is unavailable/,
  );
  const asked = [];
  const cancelled = await preflightLanguages(requestedLanguages('auto'), {
    preflight: (locale) => {
      asked.push(locale);
      return streams(['en-US', 'pt-BR'])(locale);
    },
    cancelled: () => true,
  });
  assert.deepEqual(asked, ['en-US']);
  assert.equal(cancelled.alternate, 'pt-BR');
});
