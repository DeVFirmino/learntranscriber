const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  realtimeModel,
  sessionUpdate,
  validTranscript,
  turnState,
  endTurn,
  turnSteps,
} = require('../src/main/domain/audio/openai-realtime.cjs');

// 20 ms frames of 16 kHz audio, loud enough for speech or silent.
const speech = (frames) => new Int16Array(320 * frames).fill(2000);
const silence = (frames) => new Int16Array(320 * frames);

test('a supported model is kept and anything else uses the live model', () => {
  assert.equal(realtimeModel('gpt-transcribe'), 'gpt-transcribe');
  assert.equal(realtimeModel('whisper-1'), 'gpt-live-transcribe');
  assert.equal(realtimeModel(undefined), 'gpt-live-transcribe');
});

test('the session asks for 24 kHz PCM without server turns, with the prompt and language only when set', () => {
  const plain = sessionUpdate({ model: 'gpt-live-transcribe', prompt: '', language: '' });
  assert.deepEqual(plain.session.audio.input, {
    format: { type: 'audio/pcm', rate: 24000 },
    transcription: { model: 'gpt-live-transcribe' },
    turn_detection: null,
  });
  const guided = sessionUpdate({ model: 'gpt-transcribe', prompt: 'Names: Ana', language: 'pt' });
  assert.deepEqual(guided.session.audio.input.transcription, {
    model: 'gpt-transcribe',
    prompt: 'Names: Ana',
    languages: ['pt'],
  });
});

test('only a transcript with a letter is saved', () => {
  assert.equal(validTranscript('Hello.'), true);
  assert.equal(validTranscript('...'), false);
  assert.equal(validTranscript('  '), false);
  assert.equal(validTranscript(''), false);
});

test('silence before speech is dropped, and a second of silence after it ends the turn', () => {
  const turn = turnState();
  assert.deepEqual(turnSteps(turn, silence(10)), []);
  const steps = turnSteps(turn, new Int16Array([...speech(2), ...silence(50)]));
  assert.equal(steps.filter((step) => step.audio).length, 52);
  assert.equal(steps.at(-1).commit, true);
  assert.equal(steps[0].audio.length, 480, 'each frame is sent at 24 kHz');
  assert.equal(turn.heard, false);
});

test('twenty seconds of speech end a turn, and samples short of a frame wait for the next push', () => {
  const turn = turnState();
  const steps = turnSteps(turn, speech(1000));
  assert.deepEqual(
    steps.map((step, index) => (step.commit ? index : null)).filter((index) => index !== null),
    [1000],
  );
  assert.deepEqual(turnSteps(turn, speech(1).subarray(0, 100)), []);
  assert.equal(turn.carry.length, 100);
  assert.equal(turnSteps(turn, speech(1).subarray(0, 220)).length, 1);
  assert.equal(turn.carry.length, 0);
});

test('ending a turn reports whether speech was heard', () => {
  const turn = turnState();
  assert.equal(endTurn(turn), false);
  turnSteps(turn, speech(3));
  assert.equal(endTurn(turn), true);
  assert.equal(endTurn(turn), false);
});
