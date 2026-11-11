const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createAudioTranscriber } = require('../src/main/application/audio/transcribe-audio.cjs');
const { whisperInference } = require('../src/main/infrastructure/local/whisper-inference.cjs');

const wav = { bytes: new Uint8Array([1, 2, 3]).buffer, mime: 'audio/wav' };

function transcriber(calls) {
  return createAudioTranscriber({
    acquireWhisper: () => {
      calls.push('acquire');
      return { base: 'http://127.0.0.1:9', release: () => calls.push('release') };
    },
    whisper: async ({ base, bytes }) => {
      calls.push(['whisper', base, bytes.length]);
      return '[BLANK_AUDIO]';
    },
    appleSpeech: { transcribe: async (_bytes, locale) => `apple ${locale}` },
    providers: { transcribe: async (settings, _bytes, mime) => `${settings.transcriptionProvider} ${mime}` },
  });
}

test('each engine transcribes and local Whisper releases its lease, dropping blank audio', async () => {
  const calls = [];
  const audio = transcriber(calls);
  assert.equal(await audio.transcribe(wav, { transcriptionProvider: 'local' }), '');
  assert.deepEqual(calls, ['acquire', ['whisper', 'http://127.0.0.1:9', 3], 'release']);
  assert.equal(
    await audio.transcribe(wav, { transcriptionProvider: 'apple', appleSpeechLocale: 'pt-BR' }),
    'apple pt-BR',
  );
  assert.equal(
    await audio.transcribe({ ...wav, mime: 'audio/webm' }, { transcriptionProvider: 'openai' }),
    'openai audio/webm',
  );
});

test('unsupported audio is refused before any engine runs', async () => {
  const calls = [];
  const audio = transcriber(calls);
  await assert.rejects(audio.transcribe({ ...wav, mime: 'audio/webm' }, { transcriptionProvider: 'local' }), /WAV/);
  await assert.rejects(audio.transcribe({ ...wav, mime: 'audio/webm' }, { transcriptionProvider: 'apple' }), /PCM/);
  await assert.rejects(audio.transcribe({ ...wav, mime: 'audio/flac' }, {}), /Unsupported audio format/);
  await assert.rejects(audio.transcribe({ bytes: new ArrayBuffer(0), mime: 'audio/wav' }, {}), /20 MB/);
  assert.deepEqual(calls, []);
});

test('the Whisper request carries the language, prompt and final-pass decoding', async () => {
  let sent;
  const text = await whisperInference({
    base: 'http://127.0.0.1:9',
    bytes: Buffer.from([1]),
    settings: { language: 'pt', transcriptionPrompt: 'Names', liveDecode: 'final' },
    fetch: async (url, init) => {
      sent = { url, form: Object.fromEntries([...init.body.entries()].filter(([key]) => key !== 'file')) };
      return { ok: true, json: async () => ({ text: ' Olá ' }) };
    },
  });
  assert.equal(text, 'Olá');
  assert.equal(sent.url, 'http://127.0.0.1:9/inference');
  assert.deepEqual(sent.form, {
    response_format: 'json',
    language: 'pt',
    prompt: 'Names',
    best_of: '5',
    beam_size: '5',
  });
  await assert.rejects(
    whisperInference({ base: '', bytes: Buffer.from([1]), settings: {}, fetch: async () => ({ ok: false }) }),
    /rejected this segment/,
  );
});
