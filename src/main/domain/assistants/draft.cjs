const FIELDS = {
  name: 80,
  category: 80,
  systemPrompt: 20000,
  realtimePrompt: 20000,
  followUpPrompt: 20000,
  emailPrompt: 20000,
  context: 100000,
};

function normalizeDraft(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid assistant draft.');
  const draft = {};
  for (const [key, max] of Object.entries(FIELDS)) {
    const value = input[key] ?? '';
    if (typeof value !== 'string' || value.length > max) throw new Error(`Invalid assistant draft field: ${key}.`);
    draft[key] = value.trim();
  }
  if (input.requireCertainty !== undefined && typeof input.requireCertainty !== 'boolean')
    throw new Error('Invalid assistant certainty setting.');
  draft.requireCertainty = input.requireCertainty === true;
  draft.category = draft.category || 'Uncategorized';
  if (JSON.stringify(draft).length > 160000) throw new Error('This assistant draft is too large to refine.');
  return draft;
}

module.exports = { FIELDS, normalizeDraft };
