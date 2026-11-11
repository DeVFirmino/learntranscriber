// The live insight request shape: a system prompt and one user message with the trigger, the
// last insight and the transcript round.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PROMPTS, isSilentAnswer } = require('../src/main/domain/sessions/notch-insight.cjs');
const { createInsightRounds, insightMessages } = require('../src/main/application/sessions/insight-request.cjs');

const SETTINGS = { insightMode: 'proactive', uiLanguage: 'en' };
const session = (lines, answers = []) => ({
  id: 's1',
  entries: [
    ...lines.map(([speaker, content]) => ({ kind: 'transcript', speaker, content })),
    ...answers.map((content) => ({ kind: 'assistant', content })),
  ],
});
const build = (s, options) =>
  insightMessages({ session: s, assistant: null, settings: SETTINGS, guidance: { source: 'fallback' }, ...options });
// A request whose answer was shown.
const shown = (s, options) => {
  const messages = build(s, options);
  options.rounds.settle(s.id, true);
  return messages;
};

test('Command-D reads the round since the last attempt, with the words still being spoken, under the manual trigger', () => {
  const rounds = createInsightRounds();
  const [system, user] = build(session([['THEY', 'What is the capital of Peru?']]), {
    rounds,
    liveTranscript: 'ME: hmm\nTHEY: and   Chile?',
  });
  assert.ok(system.content.startsWith(PROMPTS.instructions));
  assert.ok(system.content.includes(PROMPTS.modeSections.proactive));
  assert.equal(user.content.split('\n\n')[0], PROMPTS.triggers.manual);
  assert.match(
    user.content,
    /Current round transcript messages since the last Notch analysis attempt:\n\nTHEY: What is the capital of Peru\?\nTHEY: \[currently speaking\] and Chile\?$/,
  );
});

test('only the first request of a session goes without the autonomous suffix', () => {
  const rounds = createInsightRounds();
  const lines = [['THEY', 'First question?']];
  assert.doesNotMatch(shown(session(lines), { rounds })[0].content, /<autonomous_mode>/);
  lines.push(['THEY', 'Second question?']);
  assert.match(build(session(lines), { rounds })[0].content, /<autonomous_mode>/);
});

test('the next round starts after what was analyzed, and an empty round sends nothing', () => {
  const rounds = createInsightRounds();
  const lines = [['THEY', 'Old line.']];
  shown(session(lines), { rounds });
  lines.push(['THEY', 'New line.']);
  const [, user] = shown(session(lines), { rounds });
  assert.doesNotMatch(user.content, /Old line/);
  assert.match(user.content, /THEY: New line\.$/);
  assert.throws(() => build(session(lines), { rounds }), /Nothing new was said/);
});

test('an idle "..." answer or a failure keeps the round, so Command-D still reads the question', () => {
  const rounds = createInsightRounds();
  const lines = [['ME', 'What is the capital of Peru?']];
  build(session(lines), { rounds });
  rounds.settle('s1', false);
  const [system, user] = build(session(lines), { rounds, trigger: 'manual' });
  assert.match(user.content, /ME: What is the capital of Peru\?$/);
  assert.doesNotMatch(system.content, /<autonomous_mode>/);
});

test('the idle placeholder is only dots, an ellipsis or "listening", line by line', () => {
  for (const text of ['...', ' … ', '- ...\n\n1. …', 'Listening...', '', null])
    assert.equal(isSilentAnswer(text), true);
  for (const text of ['Lima.', '... Lima', 'Listening to music']) assert.equal(isSilentAnswer(text), false);
});

test('a question reads the latest ten messages, and the last answer is shown as the last visible insight', () => {
  const rounds = createInsightRounds();
  const lines = Array.from({ length: 12 }, (_, i) => ['THEY', `Line ${i}?`]);
  const [, user] = build(session(lines, ['Lima.']), { rounds, trigger: 'question' });
  assert.doesNotMatch(user.content, /Line 1\?/);
  assert.match(user.content, /Latest 10 transcript messages:\n\nTHEY: Line 2\?/);
  assert.match(user.content, /<last_notch_insight source="realtime-summary">\nLima\.\n<\/last_notch_insight>/);
});

test("an assistant's realtime prompt is authoritative: its contract, its trigger wording and no autonomous suffix", () => {
  const rounds = createInsightRounds();
  const [system, user] = insightMessages({
    session: session([['THEY', 'Translate this.']]),
    assistant: { prompt: 'Translate to Spanish.' },
    settings: SETTINGS,
    guidance: { prompt: 'Translate every THEY line.', source: 'assistant' },
    rounds,
  });
  assert.match(system.content, /^Translate every THEY line\.\n\nFINAL LANGUAGE REQUIREMENT:/);
  assert.match(system.content, /<assistant_task>\nTranslate to Spanish\.\n<\/assistant_task>/);
  assert.ok(system.content.endsWith(PROMPTS.assistantContract));
  assert.equal(user.content.split('\n\n')[0], PROMPTS.triggersWithAssistantPrompt.manual);
});
