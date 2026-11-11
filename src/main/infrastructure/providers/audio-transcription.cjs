const { validateEndpoint } = require('../../domain/settings/endpoint.cjs');
const { requireOk } = require('./sse.cjs');
const { BASES } = require('./endpoints.cjs');

const EXTENSIONS = { wav: 'wav', mp4: 'm4a', ogg: 'ogg' };
const extension = (mime) => Object.entries(EXTENSIONS).find(([part]) => mime.includes(part))?.[1] || 'webm';

// Gemini transcribes inline audio through a stateless interaction and returns only its model text.
async function geminiTranscript({ fetch, key, settings, bytes, mime, signal }) {
  if (bytes.length > 14000000) throw new Error('Gemini inline audio must be smaller than 14 MB.');
  if (!settings.transcriptionModel?.startsWith('gemini-'))
    throw new Error('Choose a Gemini audio-capable model in audio settings.');
  const body = {
    model: settings.transcriptionModel,
    store: false,
    input: [
      {
        type: 'text',
        text:
          'Return only a verbatim transcript of the spoken audio, without commentary or labels. If there is no speech, return [BLANK_AUDIO].' +
          (settings.language ? ' Language hint: ' + settings.language : ''),
      },
      { type: 'audio', mime_type: mime, data: Buffer.from(bytes).toString('base64') },
    ],
  };
  const response = await requireOk(
    await fetch(BASES.gemini + '/interactions', {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
      redirect: 'error',
    }),
    'gemini',
  );
  const json = await response.json();
  if (json.status !== 'completed') throw new Error('Gemini transcription did not complete.');
  const result = (json.steps || [])
    .filter((step) => step.type === 'model_output')
    .flatMap((step) => step.content || [])
    .filter((part) => part.type === 'text')
    .map((part) => part.text || '')
    .join('')
    .trim();
  if (!result || result.length > 100000) throw new Error('Gemini returned no valid transcript.');
  return result;
}

// OpenAI and custom endpoints take the audio file through /audio/transcriptions.
async function compatibleTranscript({ fetch, key, settings, bytes, mime, signal }) {
  const base =
    settings.transcriptionProvider === 'custom' ? validateEndpoint(settings.transcriptionBaseUrl) : BASES.openai;
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: mime }), `audio.${extension(mime)}`);
  form.append('model', settings.transcriptionModel);
  if (settings.language) form.append('language', settings.language);
  const response = await requireOk(
    await fetch(`${base}/audio/transcriptions`, {
      method: 'POST',
      headers: key ? { Authorization: `Bearer ${key}` } : {},
      body: form,
      signal,
      redirect: 'error',
    }),
    settings.transcriptionProvider,
  );
  const json = await response.json();
  if (typeof json.text !== 'string') throw new Error('The transcription endpoint returned no text.');
  return json.text.trim();
}

// Transcribes recorded audio with the configured cloud or custom transcription provider.
function providerTranscript(request) {
  return request.settings.transcriptionProvider === 'gemini'
    ? geminiTranscript(request)
    : compatibleTranscript(request);
}

module.exports = { providerTranscript };
