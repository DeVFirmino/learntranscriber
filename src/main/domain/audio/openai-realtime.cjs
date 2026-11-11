const { resample16kTo24k, level } = require('./pcm.cjs');

// The OpenAI Realtime transcription rules: its models, the session it asks for, which transcripts are kept, and how
// pushed 16 kHz audio becomes turns.
const MODELS = ['gpt-live-transcribe', 'gpt-transcribe'];
const FRAME = 320; // 20 ms at 16 kHz
const SPEECH_LEVEL = 500;
const PAUSE_FRAMES = 50; // one second of silence after speech ends a turn
const MAX_TURN_FRAMES = 1000; // or twenty seconds of audio

// A supported model is kept; anything else uses the live model.
function realtimeModel(candidate) {
  return MODELS.includes(candidate) ? candidate : 'gpt-live-transcribe';
}

// The session configuration sent before any audio: 24 kHz PCM, the model with its prompt and language, and no server
// turn detection, since turns are committed on pauses here.
function sessionUpdate({ model, prompt, language }) {
  return {
    type: 'session.update',
    session: {
      type: 'transcription',
      audio: {
        input: {
          format: { type: 'audio/pcm', rate: 24000 },
          transcription: {
            model,
            ...(prompt ? { prompt } : {}),
            ...(language ? { languages: [language] } : {}),
          },
          turn_detection: null,
        },
      },
    },
  };
}

// A transcript worth saving has at least one letter.
function validTranscript(value) {
  return Boolean(value && value.trim() && /\p{L}/u.test(value));
}

// One speaker's turn: whether speech was heard, its silent and total frames, and the samples short of a frame.
function turnState() {
  return { heard: false, silence: 0, frames: 0, carry: new Int16Array(0) };
}

// Ends the turn if speech was heard; the caller then commits the audio buffer.
function endTurn(turn) {
  if (!turn.heard) return false;
  turn.heard = false;
  turn.silence = 0;
  turn.frames = 0;
  return true;
}

// Splits pushed audio into 20 ms frames. Silence before speech is dropped; from speech on, every frame is sent at
// 24 kHz, and a second of silence or twenty seconds of audio ends the turn.
function turnSteps(turn, incoming) {
  const samples = new Int16Array(turn.carry.length + incoming.length);
  samples.set(turn.carry);
  samples.set(incoming, turn.carry.length);
  const steps = [];
  let offset = 0;
  for (; offset + FRAME <= samples.length; offset += FRAME) {
    const frame = samples.subarray(offset, offset + FRAME),
      speech = level(frame) > SPEECH_LEVEL;
    if (!turn.heard && !speech) continue;
    turn.heard = true;
    turn.frames++;
    turn.silence = speech ? 0 : turn.silence + 1;
    steps.push({ audio: resample16kTo24k(frame) });
    if ((turn.silence >= PAUSE_FRAMES || turn.frames >= MAX_TURN_FRAMES) && endTurn(turn)) steps.push({ commit: true });
  }
  turn.carry = samples.slice(offset);
  return steps;
}

module.exports = { MODELS, realtimeModel, sessionUpdate, validTranscript, turnState, endTurn, turnSteps };
