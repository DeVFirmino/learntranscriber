const PROMPTS = require('./notch-insight-prompts.json');
const { withLanguageRequirement } = require('./compaction.cjs');

const QUESTION_TRIGGERS = new Set(['question', 'they-question']);
const TRIGGERS = new Set(['manual', 'question', 'they-question', 'invitation', 'user-help']);
const fill = (template, values) => template.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] ?? '');
const collapse = (text) =>
  String(text || '')
    .replace(/\s+/g, ' ')
    .trim();

// The output language requirement for the teleprompter output.
function withLanguage(prompt, language) {
  return `${withLanguageRequirement(prompt, language, 'teleprompter output')} ${PROMPTS.languageScope}`;
}

// The assistant's own task stays authoritative over the generic instruction.
function withAssistantCriteria(prompt, task) {
  const value = String(task || '').trim(),
    base = String(prompt || '').trim();
  return value ? fill(PROMPTS.assistantCriteria, { prompt: base, task: value }) : base;
}

// The live-response instruction: the assistant's realtime prompt or the generated one, in the output language and
// under the assistant's task. Without either, the default instruction is used as is.
function insightInstruction({ realtimePrompt, generatedPrompt, systemPrompt, language }) {
  const prompt = String(realtimePrompt || '').trim() || String(generatedPrompt || '').trim();
  return prompt ? withAssistantCriteria(withLanguage(prompt, language), systemPrompt) : PROMPTS.instructions;
}

// The mode section: the contract that defers to an assistant realtime prompt, the Notch mode, or the
// suggestion sensitivity.
function modeSection({ assistantRealtimePrompt = false, mode = null, sensitivity = 50 } = {}) {
  if (assistantRealtimePrompt) return PROMPTS.assistantContract;
  if (mode && Object.hasOwn(PROMPTS.modeSections, mode)) return PROMPTS.modeSections[mode];
  return (
    PROMPTS.sensitivitySections.find((section) => sensitivity <= section.max) || PROMPTS.sensitivitySections.at(-1)
  ).text;
}

// The autonomous-mode suffix, appended once.
function withAutonomousSuffix(prompt) {
  const suffix = PROMPTS.autonomousSuffix.trim();
  if (!prompt || prompt.includes(suffix)) return prompt || suffix;
  return `${prompt.trimEnd()}${prompt.trimEnd().endsWith('</autonomous_mode>') ? '\n' : '\n\n'}${suffix}`;
}

// The system prompt: the instruction, the mode section and, except on the session's first request or with an
// assistant realtime prompt, the autonomous suffix.
function insightSystemPrompt({ instruction, assistantRealtimePrompt = false, mode, sensitivity, first = false }) {
  const prompt = `${instruction || PROMPTS.instructions}\n\n${modeSection({ assistantRealtimePrompt, mode, sensitivity })}`;
  return first || assistantRealtimePrompt ? prompt : withAutonomousSuffix(prompt);
}

// Transcript lines as "SPEAKER: text", with the other side's words still being recognized last.
function transcriptText(lines, liveThey = '') {
  const live = collapse(liveThey);
  const all = live ? [...lines, { speaker: 'THEY', text: `${PROMPTS.labels.currentlySpeaking} ${live}` }] : lines;
  return all
    .filter((line) => line?.text && String(line.text).trim())
    .map((line) => `${line.speaker ? `${line.speaker}: ` : ''}${String(line.text).trim()}`)
    .join('\n');
}

// The last visible insight with its anti-repetition guidance.
function lastInsightBlock(insight) {
  const text = String((typeof insight === 'string' ? insight : insight?.text) || '').trim();
  if (!text) return '';
  const source = (typeof insight === 'object' && insight?.source) || 'realtime-summary';
  return [
    PROMPTS.lastInsight.header,
    `<last_notch_insight source="${source}">`,
    text.length > 4000 ? `${text.slice(0, 4000)}...` : text,
    '</last_notch_insight>',
    PROMPTS.lastInsight.guidance,
  ].join('\n');
}

// The user message: the trigger instruction, then the last insight, documents and transcript, or for
// a question from the other side the transcript first.
function insightUserContent({
  trigger = 'manual',
  transcript = '',
  lastInsight = '',
  documents = '',
  assistantRealtimePrompt = false,
}) {
  const triggers = assistantRealtimePrompt ? PROMPTS.triggersWithAssistantPrompt : PROMPTS.triggers;
  const instruction = triggers[trigger] || triggers.manual;
  const label = QUESTION_TRIGGERS.has(trigger) ? PROMPTS.labels.question : PROMPTS.labels.round;
  const parts =
    trigger === 'they-question'
      ? [instruction, label, transcript, documents, lastInsight]
      : [instruction, lastInsight, documents, label, transcript];
  return parts.filter(Boolean).join('\n\n');
}

// The idle placeholder: every line is empty, only dots or an ellipsis, or "listening",
// after any list marker. The model answers this way when it has nothing to say, and the answer is never shown.
function isSilentAnswer(text) {
  return String(text ?? '')
    .split(/\r?\n/)
    .every((line) => {
      const value = line
        .trim()
        .replace(/^(?:[-*+\u2022\u2023\u25e6]\s+|\d+[.)]\s+)/, '')
        .trim();
      return !value || /^(?:\.|\u2026)+$/.test(value) || /^listening(?:\.{3}|\u2026)?$/i.test(value);
    });
}

// Which transcript lines a request reads: the latest ten for a question, otherwise the round since the last attempt.
function insightLines(lines, trigger, roundStart) {
  return QUESTION_TRIGGERS.has(trigger) ? lines.slice(-PROMPTS.questionMessages) : lines.slice(roundStart);
}

module.exports = {
  PROMPTS,
  TRIGGERS,
  withLanguage,
  withAssistantCriteria,
  insightInstruction,
  modeSection,
  withAutonomousSuffix,
  insightSystemPrompt,
  transcriptText,
  lastInsightBlock,
  insightUserContent,
  insightLines,
  isSilentAnswer,
};
