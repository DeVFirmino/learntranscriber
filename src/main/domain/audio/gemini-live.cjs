// The Gemini Live rules this module implements: which models it uses, how it
// merges the running transcription, how it sets a session up, which closes it never retries, and the audio it sends.
const DEFAULT_MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025';
const MODELS = ['gemini-2.5-flash-native-audio-preview-12-2025', 'gemini-2.5-flash-native-audio-preview-09-2025'];
const PAUSE_MS = 700; // gemini_vad_silence_duration_ms
const MAX_RECONNECTS = 3;
const INSTRUCTION = 'You are a transcription engine. Do not answer. Do not generate responses.';
// Configuration errors that are never retried.
const FATAL = /not found|not supported|bidiGenerateContent|Cannot extract voices from a non-audio request/;

// A known live model is kept; anything else falls back to the default.
function liveModel(candidate) {
  const model = typeof candidate === 'string' ? candidate.trim().replace(/^models\//, '') : '';
  return MODELS.includes(model) ? model : DEFAULT_MODEL;
}

function validTranscript(value) {
  return Boolean(value && value.trim() && /\p{L}/u.test(value));
}

// Gemini resends the running input transcription; this merges it by prefix, then by the longest overlap
// (at least six characters, or a shared word fragment), else appends with a space after sentence punctuation.
function overlap(previous, next) {
  const tail = previous.slice(-120).toLowerCase(),
    head = next.toLowerCase();
  for (let size = Math.min(tail.length, head.length, 120); size >= 6; size--)
    if (tail.slice(-size) === head.slice(0, size)) return size;
  const last = previous.match(/(\p{L}{1,20})$/u)?.[1] || '',
    first = next.match(/^(\p{L}{1,20})/u)?.[1] || '';
  if (!last || !first) return 0;
  for (let size = Math.min(last.length, first.length); size >= 2; size--)
    if (last.slice(-size).toLowerCase() === first.slice(0, size).toLowerCase()) return size;
  return 0;
}
function merge(buffer, text) {
  if (!text) return { delta: '', full: buffer };
  if (!buffer) return { delta: text, full: text };
  if (text.startsWith(buffer)) return { delta: text.slice(buffer.length), full: text };
  if (buffer.startsWith(text)) return { delta: '', full: buffer };
  const shared = overlap(buffer, text);
  if (shared > 0) return { delta: text.slice(shared), full: buffer + text.slice(shared) };
  const spacer =
    !/\s$/.test(buffer) && !/^\s/.test(text) && /[.!?]$/.test(buffer) && /^[\p{L}\p{N}]/u.test(text) ? ' ' : '';
  return { delta: spacer + text, full: buffer + spacer + text };
}

// Input transcription only, with the server detecting a turn after a 700 ms pause.
function liveSetup(model) {
  const native = model.toLowerCase().includes('native-audio');
  return {
    setup: {
      model: 'models/' + model,
      generationConfig: { responseModalities: [native ? 'AUDIO' : 'TEXT'] },
      systemInstruction: { parts: [{ text: INSTRUCTION }] },
      inputAudioTranscription: {},
      realtimeInputConfig: { automaticActivityDetection: { disabled: false, silenceDurationMs: PAUSE_MS } },
    },
  };
}

const fatalClose = (reason) => FATAL.test(reason);

// Mono 16 kHz PCM frames of at most two seconds, from the user or the other side.
function validFrame(input) {
  const samples = input?.samples;
  return (
    ['ME', 'THEY'].includes(input?.speaker) &&
    samples instanceof ArrayBuffer &&
    samples.byteLength > 0 &&
    samples.byteLength % 2 === 0 &&
    samples.byteLength <= 64000
  );
}

module.exports = {
  DEFAULT_MODEL,
  MODELS,
  PAUSE_MS,
  MAX_RECONNECTS,
  liveModel,
  validTranscript,
  merge,
  liveSetup,
  fatalClose,
  validFrame,
};
