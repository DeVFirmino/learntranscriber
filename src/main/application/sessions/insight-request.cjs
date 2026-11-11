const { resolvePrompt } = require('../../domain/assistants/prompt-fallbacks.cjs');
const { outputLanguage } = require('../../domain/sessions/compaction.cjs');
const {
  insightInstruction,
  insightLines,
  insightSystemPrompt,
  insightUserContent,
  lastInsightBlock,
  transcriptText,
} = require('../../domain/sessions/notch-insight.cjs');

// Where each listening session's next transcript round starts, and how many insights it has shown; the first
// request of a session goes without the autonomous suffix. A request only stages its round: an
// answer that is shown moves the start past it, while an idle "..." answer or a failure keeps it, so the next request,
// Command-D included, still reads what was said (the pending summary boundary).
function createInsightRounds() {
  const rounds = new Map();
  const staged = new Map();
  return {
    get: (sessionId) => rounds.get(sessionId) || { start: 0, count: 0 },
    stage: (sessionId, start) => staged.set(sessionId, start),
    settle(sessionId, shown) {
      if (!staged.has(sessionId)) return;
      const start = staged.get(sessionId);
      staged.delete(sessionId);
      if (!shown) return;
      const current = rounds.get(sessionId) || { start: 0, count: 0 };
      rounds.set(sessionId, { start: Math.max(current.start, start), count: current.count + 1 });
    },
  };
}

// The words the other side is saying right now, from the window's live captions ("THEY: …" lines).
function liveTheyText(liveTranscript) {
  return String(liveTranscript || '')
    .split('\n')
    .filter((line) => line.startsWith('THEY: '))
    .map((line) => line.slice('THEY: '.length))
    .join(' ');
}

// The two messages of a live insight request. `guidance` is the realtime
// instruction with its source: the assistant's own prompt, a generated one, the local default or a failed generation.
function insightMessages({ session, assistant, settings, guidance, liveTranscript, trigger = 'manual', rounds }) {
  const lines = session.entries
    .filter((entry) => entry.kind === 'transcript')
    .map((entry) => ({ speaker: entry.speaker, text: entry.content }));
  const round = rounds.get(session.id);
  const transcript = transcriptText(insightLines(lines, trigger, round.start), liveTheyText(liveTranscript));
  if (!transcript.trim()) throw new Error('Nothing new was said since the last insight.');
  rounds.stage(session.id, lines.length);
  const assistantRealtimePrompt = guidance?.source === 'assistant';
  const instruction =
    guidance?.source === 'fallback'
      ? null
      : insightInstruction({
          realtimePrompt: assistantRealtimePrompt ? guidance.prompt : '',
          generatedPrompt: assistantRealtimePrompt ? '' : guidance?.prompt,
          systemPrompt: resolvePrompt('system', assistant, { settings }).prompt,
          language: outputLanguage(settings),
        });
  const last = session.entries.findLast((entry) => entry.kind === 'assistant')?.content;
  return [
    {
      role: 'system',
      content: insightSystemPrompt({
        instruction,
        assistantRealtimePrompt,
        mode: settings.insightMode === 'questions' ? 'only_questions' : settings.insightMode,
        first: round.count === 0,
      }),
    },
    {
      role: 'user',
      content: insightUserContent({
        trigger,
        transcript,
        lastInsight: lastInsightBlock(last),
        assistantRealtimePrompt,
      }),
    },
  ];
}

module.exports = { createInsightRounds, insightMessages, liveTheyText };
