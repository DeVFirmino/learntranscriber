// Splits a live 16 kHz PCM16 stream into utterances by voice activity. 20 ms frames above the speech level start
// an utterance after 160 ms of voice (with the 250 ms before it kept); a 750 ms window of new audio is offered
// for a preview; one second of silence, or 60 s of speech, ends the utterance.
const FRAME_BYTES = 640;
const SPEECH_LEVEL = 500;
const PRE_ROLL_BYTES = 8000;
const ONSET_MS = 160;
const WINDOW_BYTES = 24000;
const OVERLAP_BYTES = 4800;
const PAUSE_BYTES = 32000;
const MAX_UTTERANCE_BYTES = 1920000;
// A shorter utterance (under 0.8 s) is not worth a final decode.
const MIN_FINAL_BYTES = 25600;

function utteranceState() {
  return {
    parts: [],
    bytes: 0,
    heard: false,
    voiceMs: 0,
    silence: 0,
    preRoll: [],
    preRollBytes: 0,
    window: [],
    windowBytes: 0,
    carry: Buffer.alloc(0),
  };
}

function isSpeech(frame) {
  let energy = 0;
  for (let i = 0; i < frame.length; i += 2) {
    const value = frame.readInt16LE(i);
    energy += value * value;
  }
  return Math.sqrt(energy / (frame.length / 2)) > SPEECH_LEVEL;
}

function append(state, frame) {
  state.parts.push(frame);
  state.bytes += frame.length;
  state.window.push(frame);
  state.windowBytes += frame.length;
}

// Before speech: keeps a short pre-roll and starts the utterance once enough consecutive voice arrived.
function listen(state, frame, speech) {
  state.preRoll.push(frame);
  state.preRollBytes += frame.length;
  while (state.preRollBytes > PRE_ROLL_BYTES) state.preRollBytes -= state.preRoll.shift().length;
  state.voiceMs = speech ? state.voiceMs + 20 : 0;
  if (state.voiceMs < ONSET_MS) return;
  state.heard = true;
  for (const chunk of state.preRoll) append(state, chunk);
  state.preRoll = [];
  state.preRollBytes = 0;
}

/**
 * Ends the current utterance and resets the state. `heard` says whether it contained speech; `audio` is its PCM
 * when it is long enough for a final decode.
 */
function endUtterance(state) {
  const ended = {
    heard: state.heard,
    audio: state.heard && state.bytes >= MIN_FINAL_BYTES ? Buffer.concat(state.parts) : null,
  };
  Object.assign(state, { ...utteranceState(), carry: state.carry });
  return ended;
}

// Feeds PCM samples; returns, in order, `{ preview }` windows to decode and `{ end }` utterances that finished.
function feedUtterance(state, samples) {
  const pcm = Buffer.concat([state.carry, Buffer.from(samples)]),
    actions = [];
  let offset = 0;
  for (; offset + FRAME_BYTES <= pcm.length; offset += FRAME_BYTES) {
    const frame = Buffer.from(pcm.subarray(offset, offset + FRAME_BYTES)),
      speech = isSpeech(frame);
    if (!state.heard) {
      listen(state, frame, speech);
      continue;
    }
    append(state, frame);
    state.silence = speech ? 0 : state.silence + frame.length;
    if (state.windowBytes >= WINDOW_BYTES) {
      const window = Buffer.concat(state.window);
      actions.push({ preview: window });
      const overlap = window.subarray(Math.max(0, window.length - OVERLAP_BYTES));
      state.window = [Buffer.from(overlap)];
      state.windowBytes = overlap.length;
    }
    if (state.silence >= PAUSE_BYTES || state.bytes >= MAX_UTTERANCE_BYTES) actions.push({ end: endUtterance(state) });
  }
  state.carry = Buffer.from(pcm.subarray(offset));
  return actions;
}

module.exports = { MAX_UTTERANCE_BYTES, utteranceState, feedUtterance, endUtterance };
