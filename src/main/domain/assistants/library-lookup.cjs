// A string argument from the model, or undefined when it is missing, not text or too long.
const str = (value, max = 20000) => (typeof value === 'string' && value.length <= max ? value : undefined);

function searchLibrary(assistants, args = {}) {
  const query = (str(args.query, 200) || '').trim().toLowerCase(),
    category = (str(args.category, 80) || '').trim().toLowerCase();
  return assistants
    .filter(
      (item) =>
        (!category || String(item.category || '').toLowerCase() === category) &&
        (!query ||
          [item.name, item.category, item.prompt].some((value) =>
            String(value || '')
              .toLowerCase()
              .includes(query),
          )),
    )
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 10)
    .map((item) => ({ id: item.id, name: item.name, category: item.category || 'Uncategorized' }));
}

const withName = (assistants, name) =>
  assistants.filter((item) => item.name.toLowerCase() === name.trim().toLowerCase());

function candidates(assistants, args) {
  const id = str(args.assistant_id, 100);
  // Models sometimes pass a name as the ID; an exact name still identifies the assistant.
  if (id) return assistants.find((item) => item.id === id) || withName(assistants, id);
  const name = str(args.assistant_name, 80)?.trim();
  return name ? withName(assistants, name) : null;
}

function findAssistant(assistants, args) {
  const match = candidates(assistants, args);
  if (!Array.isArray(match)) return match || null;
  if (match.length > 1) throw new Error('More than one assistant has that name; use its ID.');
  return match[0] || null;
}

// The draft fields of a stored assistant row.
function assistantDraft(item) {
  return {
    name: item.name,
    category: item.category,
    systemPrompt: item.prompt,
    realtimePrompt: item.realtime_prompt,
    followUpPrompt: item.follow_up_prompt,
    emailPrompt: item.email_prompt,
    context: item.context,
    requireCertainty: item.require_certainty === true,
  };
}

module.exports = { str, searchLibrary, findAssistant, assistantDraft };
