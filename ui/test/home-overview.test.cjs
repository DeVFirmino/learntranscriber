const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { sessionStats, sessionsPerDay, providerName, transcriptionName, homeShortcuts, SESSION_LIST_LIMIT } = loadTs(
  'src/features/home/home-overview.ts',
);

const now = Date.parse('2026-11-06T12:00:00Z');
const at = (iso) => ({ started_at: iso });

test('session stats count the last seven days and flag a capped list', () => {
  const stats = sessionStats(
    [at('2026-11-06T09:00:00Z'), at('2026-10-31T12:00:01Z'), at('2026-10-30T12:00:00Z'), at('not a date')],
    now,
  );
  assert.deepEqual({ ...stats }, { total: 4, capped: false, thisWeek: 2 });
  assert.equal(sessionStats([at('2026-11-07T09:00:00Z')], now).thisWeek, 0);
  const full = Array.from({ length: SESSION_LIST_LIMIT }, () => at('2026-01-01T00:00:00Z'));
  assert.equal(sessionStats(full, now).capped, true);
});

test('providers and transcription read as brands, leaving local and custom to the caller', () => {
  assert.equal(providerName('chatgpt'), 'ChatGPT');
  assert.equal(providerName('lmstudio'), 'LM Studio');
  assert.equal(providerName('local'), null);
  assert.equal(providerName('toString'), null);
  assert.equal(
    transcriptionName({ transcriptionProvider: 'apple', appleSpeechLocale: 'pt-BR' }),
    'Apple Speech · pt-BR',
  );
  assert.equal(transcriptionName({ transcriptionProvider: 'apple', appleSpeechLocale: '' }), 'Apple Speech · en-US');
  assert.equal(transcriptionName({ transcriptionProvider: 'local', appleSpeechLocale: '' }), 'Whisper · local');
  assert.equal(transcriptionName({ transcriptionProvider: 'openai', appleSpeechLocale: '' }), 'OpenAI');
  assert.equal(transcriptionName({ transcriptionProvider: 'custom', appleSpeechLocale: '' }), null);
});

test('Home shows the session shortcuts in order and skips disabled or unbound ones', () => {
  const definition = (id, accelerator, enabled = true) => ({ id, label: id, accelerator, enabled, registered: true });
  const shown = homeShortcuts([
    definition('capture', 'CommandOrControl+E'),
    definition('ask', ''),
    definition('record', 'CommandOrControl+D', false),
    definition('hide', 'CommandOrControl+B'),
    definition('overlay', 'CommandOrControl+M'),
  ]);
  assert.deepEqual([...shown.map((item) => item.id)], ['overlay', 'capture']);
});

test('sessions per day fills the last seven local days, oldest first, and ignores the future', () => {
  const local = (y, m, d, h) => new Date(y, m - 1, d, h).toISOString();
  const now = new Date(2026, 10, 6, 15).getTime();
  const days = sessionsPerDay(
    [
      at(local(2026, 11, 6, 9)),
      at(local(2026, 11, 6, 1)),
      at(local(2026, 11, 4, 23)),
      at(local(2026, 10, 31, 0)),
      at(local(2026, 10, 30, 23)),
      at(local(2026, 11, 6, 18)),
      at('not a date'),
    ],
    now,
  );
  assert.equal(days.length, 7);
  assert.deepEqual([...days.map((item) => item.count)], [1, 0, 0, 0, 1, 0, 2]);
  assert.equal(days[6].day, new Date(2026, 10, 6).getTime());
});
