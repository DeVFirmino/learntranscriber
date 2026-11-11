const { text } = require('../shared/text.cjs');

const PROMPTS = [
  ['realtimePrompt', 20000],
  ['followUpPrompt', 20000],
  ['emailPrompt', 20000],
  ['context', 100000],
];

function validKnowledgeFiles(files) {
  return (
    Array.isArray(files) &&
    files.length <= 20 &&
    !files.some(
      (file) =>
        !file ||
        typeof file.name !== 'string' ||
        !file.name.trim() ||
        file.name.length > 200 ||
        /\p{Cc}/u.test(file.name) ||
        typeof file.content !== 'string' ||
        file.content.length > 1000000 ||
        !Number.isSafeInteger(file.size) ||
        file.size < 0 ||
        file.size > 1000000,
    ) &&
    files.reduce((total, file) => total + file.content.length, 0) <= 200000
  );
}

// Accepts camelCase or stored snake_case input. When knowledge files are omitted, an update keeps the saved ones.
function normalizeAssistant(input, { newId, savedKnowledgeFiles }) {
  const name = text(input.name, 80),
    prompt = text(input.prompt, 20000),
    id = input.id || newId();
  const category =
    typeof input.category === 'string' && input.category.trim() ? text(input.category, 80) : 'Uncategorized';
  const requireCertainty =
    (Object.hasOwn(input, 'requireCertainty') ? input.requireCertainty : input.require_certainty) === true;
  const knowledgeFiles = input.knowledgeFiles ?? input.knowledge_files ?? savedKnowledgeFiles(id) ?? [];
  if (!validKnowledgeFiles(knowledgeFiles))
    throw new Error('Choose up to 20 readable knowledge files totaling 200,000 characters.');
  const prompts = {};
  for (const [key, max] of PROMPTS) {
    const storedKey = key.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);
    const value = Object.hasOwn(input, key) ? input[key] : input[storedKey];
    if (value === undefined || value === null) {
      prompts[key] = '';
      continue;
    }
    if (typeof value !== 'string' || value.length > max) throw new Error(`Invalid assistant field: ${key}.`);
    prompts[key] = value.trim();
  }
  return {
    id,
    name,
    prompt,
    category,
    ...prompts,
    requireCertainty,
    knowledgeFiles,
  };
}
module.exports = { normalizeAssistant };
