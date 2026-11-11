const fields = ['name', 'systemPrompt', 'realtimePrompt', 'followUpPrompt', 'emailPrompt'];

function exportAssistant(assistant) {
  if (!assistant) throw new Error('Assistant not found.');
  return JSON.stringify(
    {
      type: 'learntranscriber.assistant-prompt',
      version: 1,
      assistant: {
        name: assistant.name,
        category: assistant.category || 'Uncategorized',
        systemPrompt: assistant.prompt,
        realtimePrompt: assistant.realtime_prompt || '',
        followUpPrompt: assistant.follow_up_prompt || '',
        emailPrompt: assistant.email_prompt || '',
        requireCertainty: assistant.require_certainty === true,
      },
    },
    null,
    2,
  );
}

function importAssistant(input) {
  let raw = String(input || '').trim();
  raw = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
  if (!raw) throw new Error('Paste a shared assistant prompt to import it.');
  if (raw.length > 250000) throw new Error('This shared prompt is too large to import.');
  let envelope;
  try {
    envelope = JSON.parse(raw);
  } catch {
    throw new Error('That is not a valid shared assistant prompt.');
  }
  if (
    !envelope ||
    envelope.type !== 'learntranscriber.assistant-prompt' ||
    envelope.version !== 1 ||
    !envelope.assistant ||
    typeof envelope.assistant !== 'object' ||
    Array.isArray(envelope.assistant)
  )
    throw new Error('This shared prompt uses an unsupported format.');
  const source = envelope.assistant;
  if (fields.some((key) => source[key] !== undefined && typeof source[key] !== 'string'))
    throw new Error('This shared prompt contains invalid prompt fields.');
  const draft = Object.fromEntries(fields.map((key) => [key, source[key] || '']));
  return {
    ...draft,
    category: typeof source.category === 'string' && source.category.trim() ? source.category.trim() : 'Uncategorized',
    requireCertainty: source.requireCertainty === true,
  };
}

module.exports = { exportAssistant, importAssistant };
