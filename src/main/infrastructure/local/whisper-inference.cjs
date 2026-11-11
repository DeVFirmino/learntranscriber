// The decoding effort for each live pass; any other value keeps the server's defaults.
const DECODING = { final: { best_of: '5', beam_size: '5' }, preview: { best_of: '1', beam_size: '1' } };

// Transcribes WAV bytes with the managed whisper-server at `base`.
async function whisperInference({ base, bytes, settings, signal, fetch: fetchImpl = fetch }) {
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: 'audio/wav' }), 'segment.wav');
  form.append('response_format', 'json');
  form.append('language', settings.language || 'auto');
  if (settings.transcriptionPrompt) form.append('prompt', settings.transcriptionPrompt);
  for (const [key, value] of Object.entries(DECODING[settings.liveDecode] || {})) form.append(key, value);
  const response = await fetchImpl(base + '/inference', { method: 'POST', body: form, signal, redirect: 'error' });
  if (!response.ok) throw new Error('Local Whisper rejected this segment. Check model compatibility.');
  const json = await response.json();
  if (typeof json.text !== 'string') throw new Error('Local Whisper returned no transcript.');
  return json.text.trim();
}
module.exports = { whisperInference };
