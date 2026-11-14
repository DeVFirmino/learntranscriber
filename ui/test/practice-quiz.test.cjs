const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { parsePracticeQuiz, hideQuizWhileStreaming, quizScore } = loadTs('src/features/practice-quiz.ts');

const item = (overrides = {}) => ({
  question: 'What is 2 + 3?',
  choices: ['4', '5', '6', '23'],
  answer: 1,
  explanation: 'Adding 2 and 3 gives 5.',
  ...overrides,
});
const block = (questions) => JSON.stringify({ questions });

test('a well-formed quiz block yields its trimmed questions', () => {
  const [parsed] = parsePracticeQuiz(block([item({ question: '  What is 2 + 3?  ' })]));
  assert.equal(parsed.question, 'What is 2 + 3?');
  assert.deepEqual([...parsed.choices], ['4', '5', '6', '23']);
  assert.equal(parsed.answer, 1);
});

test('malformed quiz blocks are rejected so they show as code', () => {
  for (const code of [
    'not json',
    '[]',
    block([]),
    block(Array.from({ length: 6 }, () => item())),
    block([item({ answer: 4 })]),
    block([item({ answer: 1.5 })]),
    block([item({ answer: '1' })]),
    block([item({ choices: ['only one'] })]),
    block([item({ choices: ['5', '5', '6', '7'] })]),
    block([item({ choices: ['4', '', '6', '7'] })]),
    block([item({ explanation: ' ' })]),
    block([item({ question: 'x'.repeat(601) })]),
    block([item(), null]),
  ])
    assert.equal(parsePracticeQuiz(code), null, code.slice(0, 60));
});

test('streaming text never shows a quiz block, finished or still open', () => {
  const answer = 'Intro.\n\n```quiz\n{"questions":[{"answer":1,"explanation":"secret"}]}\n```\n\nAfter.';
  const hidden = hideQuizWhileStreaming(answer, '[quiz]');
  assert.equal(hidden, 'Intro.\n\n[quiz]\n\nAfter.');
  assert.equal(hideQuizWhileStreaming('Intro.\n```quiz\n{"questions":[{"answer":2', '[quiz]'), 'Intro.\n[quiz]');
  assert.equal(hideQuizWhileStreaming('```js\nconst a = 1\n```', '[quiz]'), '```js\nconst a = 1\n```');
});

test('the score counts checked questions and correct choices', () => {
  const questions = [item(), item({ answer: 0 }), item({ answer: 2 })];
  assert.deepEqual({ ...quizScore(questions, [1, 3, null]) }, { answered: 2, correct: 1, total: 3 });
});
