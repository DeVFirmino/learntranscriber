// Prompt compaction keeps the latest eight entries verbatim and estimates tokens at four characters each.
const KEEP = 8;
// Chat re-compacts automatically only after this many new conversation messages.
const MIN_NEW_MESSAGES = 6;
function estimate(content) {
  return Math.ceil(content.length / 4);
}
function compactionState({ current, entries, count }) {
  return {
    summary: current?.content || '',
    createdAt: current?.created_at || null,
    estimatedTokens: estimate((current?.content || '') + entries.map((e) => e.content).join('\n')),
    count,
  };
}

// The compaction prompts; this build has no remote configuration, so these fixed defaults are always used. The
// first compaction summarizes the conversation; later ones evolve the previous summary with the turns added since.
const COMPACT_PROMPT =
  'You are compacting the context of an ongoing conversation so the model can continue answering without the full raw transcript.\n\nProduce a dense, factual summary that preserves:\n- The user\'s overarching goal or task\n- Decisions made and their rationale\n- Open questions, blockers, and unresolved threads\n- Named entities: people, places, products, files, URLs, IDs\n- Numbers, dates, parameters, and configuration values\n- Constraints, preferences, and working assumptions\n- The current state of any in-progress task (what has been done, what comes next)\n\nStyle:\n- Prose, not markdown — no headers, no bullet lists, no emoji\n- Dense and factual; omit pleasantries and meta-commentary\n- Write about the content, not about the conversation ("The user is building X" not "The user asked about X")\n- Preserve proper nouns and technical terms verbatim\n- Use the required output language supplied in the final language requirement\n\nOutput ONLY the compacted summary. No preface, no "Here is the summary:", no code fences.\n\nConversation to compact:\n${conversationText}';
const COMPACT_UPDATE_PROMPT =
  'You are updating a compacted context summary with new conversation turns.\n\nCURRENT COMPACTED SUMMARY:\n${previousSummary}\n\nNEW TURNS (since last compaction):\n${newContent}\n\nProduce an evolved summary that:\n- Incorporates facts, decisions, and state changes from the new turns\n- Retains everything from the current summary that is still relevant\n- Removes or updates anything the new turns have overridden\n- Preserves the dense, prose-only style (no headers, no bullets, no meta-commentary)\n- Uses the required output language supplied in the final language requirement\n\nOutput ONLY the updated summary. No preface, no explanation, no code fences.';

// Template fill: known ${keys} are replaced, anything else is left as written.
function fillTemplate(template, values) {
  return template.replace(/\$\{([^}]+)\}/g, (match, key) => (Object.hasOwn(values, key) ? values[key] : match));
}

// Conversation turns formatted as "User:" or "Assistant:", one blank line apart. This store also
// keeps transcript lines among them; those use the "[ME]: …" transcript form.
function conversationText(entries) {
  return entries
    .map((entry) =>
      entry.kind === 'transcript'
        ? `[${entry.speaker || 'UNKNOWN'}]: ${entry.content}`
        : `${entry.kind === 'user' ? 'User' : 'Assistant'}: ${entry.content}`,
    )
    .join('\n\n');
}

// The output-language requirement. The language is the interface language when set; otherwise the OS locale, then English.
const LANGUAGE_NAMES = Object.freeze({ en: 'English', es: 'Spanish', 'pt-BR': 'Portuguese (Brazilian)' });
function outputLanguage(settings = {}, systemLanguage = Intl.DateTimeFormat().resolvedOptions().locale) {
  const language = String(settings.uiLanguage || systemLanguage || 'en')
    .toLowerCase()
    .replaceAll('_', '-');
  return LANGUAGE_NAMES[language.startsWith('pt') ? 'pt-BR' : language.startsWith('es') ? 'es' : 'en'];
}
function withLanguageRequirement(prompt, language, label = 'output') {
  return `${String(prompt || '').trim()}\n\nFINAL LANGUAGE REQUIREMENT:\nIMPORTANT: The required output language is ${language}. Write the entire ${label} in ${language}, including any title, subject, headings, bullets, and prose. Do not infer the language from the source conversation and do not switch languages. Preserve proper nouns, product names, code identifiers, commands, file paths, URLs, and quoted text only when needed.`;
}

// One user message: the first summary, or the previous one evolved with the new entries.
function compactionPrompt({ previousSummary, entries, settings }) {
  const prompt = previousSummary
    ? fillTemplate(COMPACT_UPDATE_PROMPT, { previousSummary, newContent: conversationText(entries) })
    : fillTemplate(COMPACT_PROMPT, { conversationText: conversationText(entries) });
  return withLanguageRequirement(prompt, outputLanguage(settings), 'compacted summary');
}

// Conversation messages added since the checkpoint was written, counted before compacting again.
function newMessagesSince(current, entries) {
  if (!current) return Infinity;
  const observed = current.observed_through_rowid ?? null;
  // New checkpoints retain the snapshot's last row, so equal timestamps and entries arriving mid-generation work.
  // Legacy checkpoints have no observation boundary; retain their timestamp fallback until the next compaction.
  return entries.filter(
    (entry) =>
      ['user', 'assistant'].includes(entry.kind) &&
      (observed === null ? entry.created_at > current.created_at : entry.sequence > observed),
  ).length;
}

module.exports = {
  KEEP,
  MIN_NEW_MESSAGES,
  estimate,
  compactionState,
  COMPACT_PROMPT,
  COMPACT_UPDATE_PROMPT,
  fillTemplate,
  conversationText,
  outputLanguage,
  withLanguageRequirement,
  compactionPrompt,
  newMessagesSince,
};
