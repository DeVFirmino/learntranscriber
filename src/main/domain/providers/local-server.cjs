const { launchArgs } = require('./local-launch.cjs');

const MAX_MODEL_BYTES = 32 * 1024 ** 3;

function modelKind(value) {
  if (!['llm', 'whisper'].includes(value)) throw new Error('Choose LLM or Whisper.');
  return value;
}

function downloadUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash)
    throw new Error('Use a public HTTPS model URL without credentials or query parameters.');
  return url;
}

// A download may only redirect to another HTTPS location without credentials.
function redirectTarget(location, current) {
  const next = new URL(location, current);
  if (next.protocol !== 'https:' || next.username || next.password)
    throw new Error('Model download redirected to an unsupported URL.');
  return next;
}

// The first four bytes identify the format: GGUF for language models, GGML for whisper.cpp.
function checkModelMagic(type, magic) {
  if (type === 'llm' && (magic.length !== 4 || magic.toString() !== 'GGUF'))
    throw new Error('Choose a GGUF language model.');
  if (type !== 'llm' && (magic.length !== 4 || magic.readUInt32LE() !== 0x67676d6c))
    throw new Error('Choose a whisper.cpp GGML model.');
}

// The catalog entry a download came from, kept when its id is a plain token.
const catalogOrigin = (input) =>
  typeof input.id === 'string' && /^[a-zA-Z0-9._-]{1,100}$/.test(input.id) ? { catalogId: input.id } : {};

function cacheArgs(mode = 'off') {
  if (mode === 'off') return [];
  const type = { moderate: 'q8_0', aggressive: 'q4_0' }[mode];
  if (!type) throw new Error('Unsupported KV cache mode.');
  // Keys and values share the preset's type.
  return ['--cache-type-k', type, '--cache-type-v', type, '--flash-attn', 'on'];
}

// The llama-server or whisper-server arguments for one model on a loopback port.
function serverArgs({ type, model, modelFile, projectorFile, port, config, settings }) {
  const common = ['-m', modelFile, '--host', '127.0.0.1', '--port', String(port)];
  if (type !== 'llm')
    return [...common, '--language', 'auto', ...(settings.localWhisperGpu === false ? ['--no-gpu'] : [])];
  const vision = model.projector
    ? [
        '--mmproj',
        projectorFile,
        '--image-max-tokens',
        String(Math.max(256, Math.floor(Math.max(512, config.contextSize) * 0.5))),
      ]
    : [];
  return [...common, '--alias', model.id, ...launchArgs(config), ...vision, ...cacheArgs(settings.kvCacheMode)];
}

// The context each slot really has: the server's reported n_ctx, bounded by the configured size per slot.
function slotCapacity(props, config) {
  const effective = props.default_generation_settings?.n_ctx;
  const capacity = Math.min(Math.floor(config.contextSize / config.parallel), effective);
  if (!Number.isInteger(effective) || capacity < 512 || props.total_slots !== config.parallel)
    throw new Error('Local server did not report a valid context capacity for its configured slots.');
  return capacity;
}

module.exports = {
  MAX_MODEL_BYTES,
  modelKind,
  downloadUrl,
  redirectTarget,
  checkModelMagic,
  catalogOrigin,
  cacheArgs,
  serverArgs,
  slotCapacity,
};
