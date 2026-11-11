const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { InsightScheduler } = loadTs('src/features/workspace/insight-scheduler.ts');
const { lastQuestion } = loadTs('src/features/workspace/spoken-question.ts');
const { insightMode } = loadTs('src/features/workspace/insight-modes.ts');

const line = (speaker, text, at) => ({ speaker, text, at });
const snap = (over) => ({ now: 0, mode: 'proactive', lines: [], live: {}, inFlight: false, ...over });

test('questions are found in English, Portuguese and Spanish, with or without a question mark', () => {
  assert.equal(lastQuestion('We shipped it. What is the rollback plan?'), 'What is the rollback plan?');
  assert.equal(lastQuestion('Fechamos o contrato. Quando vocês conseguem entregar'), 'Quando vocês conseguem entregar');
  assert.equal(lastQuestion('¿Cuál es el presupuesto?'), '¿Cuál es el presupuesto?');
  assert.equal(lastQuestion('The meeting went well.'), '');
  assert.equal(insightMode('nonsense'), 'proactive');
});

test('a question from the other speaker triggers as soon as its line is saved, and only once', () => {
  const s = new InsightScheduler();
  s.reset(0, 0);
  assert.equal(s.decide(snap({ now: 10_000, live: { THEY: 'What is your budget for this quarter' } })), null);
  const lines = [line('THEY', 'What is your budget for this quarter', 10_500)];
  assert.equal(s.decide(snap({ now: 11_000, lines, live: { ME: 'well' } })), null, 'not while the user speaks');
  assert.equal(s.decide(snap({ now: 11_200, lines })), 'question');
  s.requested(1, 11_200);
  assert.equal(s.decide(snap({ now: 20_000, lines })), null, 'the same question is not asked twice');
});

test('nothing is requested while the user speaks or while an insight runs', () => {
  const s = new InsightScheduler();
  s.reset(0, 0);
  const lines = [line('ME', 'First point.', 1_000), line('ME', 'Second point.', 2_000)];
  assert.equal(s.decide(snap({ now: 60_000, lines, live: { ME: 'and also' } })), null);
  assert.equal(s.decide(snap({ now: 60_000, lines, inFlight: true })), null);
  assert.equal(s.decide(snap({ now: 60_000, lines })), 'user-help');
});

test('proactive mode helps after two user lines and five seconds of silence', () => {
  const s = new InsightScheduler();
  s.reset(0, 0);
  const one = [line('ME', 'Hello there.', 4_000)];
  assert.equal(s.decide(snap({ now: 20_000, lines: one })), null, 'one line is not enough');
  const two = [...one, line('ME', 'The second point concerns pricing.', 10_000)];
  assert.equal(s.decide(snap({ now: 14_000, lines: two })), null, 'not silent long enough');
  assert.equal(s.decide(snap({ now: 15_100, lines: two })), 'user-help');
  s.requested(2, 15_100);
  assert.equal(s.decide(snap({ now: 40_000, lines: two })), null, 'covered lines do not trigger again');
});

test('periodic checks need new speech and follow the mode interval', () => {
  const s = new InsightScheduler();
  s.reset(0, 0);
  const they = [line('THEY', 'We moved the launch.', 1_000)];
  assert.equal(s.decide(snap({ now: 29_000, lines: they })), null);
  assert.equal(s.decide(snap({ now: 30_000, lines: they })), 'periodic');
  assert.equal(s.decide(snap({ now: 30_000, lines: they, mode: 'only_questions' })), null);
  const fast = new InsightScheduler();
  fast.reset(0, 0);
  assert.equal(fast.decide(snap({ now: 10_000, lines: they, mode: 'meeting_notes' })), 'periodic');
  const idle = new InsightScheduler();
  idle.reset(1, 0);
  assert.equal(
    idle.decide(snap({ now: 120_000, lines: they })),
    null,
    'speech before listening started does not count',
  );
});

test('a newly saved repetition is a new question even when its wording is identical', () => {
  const s = new InsightScheduler();
  s.reset(0, 0);
  const first = [line('THEY', 'What is your budget?', 1000)];
  assert.equal(s.decide(snap({ now: 1100, mode: 'only_questions', lines: first })), 'question');
  s.requested(1, 1100);
  assert.equal(s.decide(snap({ now: 5000, mode: 'only_questions', lines: first })), null);
  const repeated = [...first, line('THEY', 'What is your budget?', 6000)];
  assert.equal(s.decide(snap({ now: 6100, mode: 'only_questions', lines: repeated })), 'question');
});

test('unpunctuated Spanish questions with accented interrogatives are recognized', () => {
  assert.equal(lastQuestion('Qué presupuesto tenemos'), 'Qué presupuesto tenemos');
  assert.equal(lastQuestion('Por qué falló el despliegue'), 'Por qué falló el despliegue');
  assert.equal(lastQuestion('¿Qué presupuesto tenemos'), '¿Qué presupuesto tenemos');
  assert.equal(lastQuestion('Whatever you need'), '');
});

test('a stable live question triggers before finalization and its matching final is not repeated', () => {
  const s = new InsightScheduler();
  s.reset(0, 0);
  const live = { THEY: 'What is the rollback plan?' };
  assert.equal(s.decide(snap({ now: 1000, live })), null);
  assert.equal(s.decide(snap({ now: 2000, live })), 'question');
  s.requested(0, 2000);
  assert.equal(s.decide(snap({ now: 4000, live })), null, 'unchanged provisional speech is covered');
  const lines = [line('THEY', 'What is the rollback plan?', 4500)];
  assert.equal(s.decide(snap({ now: 5000, lines })), null, 'the matching final was already answered');
  const repeated = [...lines, line('THEY', 'What is the rollback plan?', 6000)];
  assert.equal(s.decide(snap({ now: 6100, lines: repeated })), 'question', 'a later utterance is new');
});

test('live questions wait for stable text and never interrupt user speech or another response', () => {
  const s = new InsightScheduler();
  s.reset(0, 0);
  assert.equal(s.decide(snap({ now: 1000, live: { THEY: 'What is your budget' } })), null);
  const live = { THEY: 'What is your budget this year?' };
  assert.equal(s.decide(snap({ now: 1500, live })), null, 'revised text restarts the debounce');
  assert.equal(s.decide(snap({ now: 2000, live })), null);
  assert.equal(s.decide(snap({ now: 3000, live: { ...live, ME: 'Let me explain' } })), null);
  assert.equal(s.decide(snap({ now: 4000, live, inFlight: true })), null);
  assert.equal(s.decide(snap({ now: 5000, live })), 'question');
  s.reset(0, 6000);
  assert.equal(s.decide(snap({ now: 6100, live })), null, 'a new run does not reuse an old candidate');
});

test('a final arriving before its live caption clears cannot trigger the same answer again', () => {
  const s = new InsightScheduler();
  s.reset(0, 0);
  const live = { THEY: 'What is the rollback plan?' };
  s.decide(snap({ now: 1000, live }));
  assert.equal(s.decide(snap({ now: 2000, live })), 'question');
  s.requested(0, 2000);
  const lines = [line('THEY', live.THEY, 3000)];
  assert.equal(s.decide(snap({ now: 3100, lines, live })), null);
  assert.equal(s.decide(snap({ now: 5000, lines, live })), null);
});

test('automatic question requests prioritize THEY rather than treating ME questions as incoming questions', () => {
  const scheduler = new InsightScheduler();
  scheduler.reset(0, 0);
  const lines = [line('ME', 'What is dependency injection?', 1200)];
  assert.equal(scheduler.decide(snap({ now: 1300, lines, live: { ME: 'and also' } })), null);
  assert.equal(scheduler.decide(snap({ now: 1500, lines })), null);
  const incoming = [line('THEY', 'What is the deployment plan?', 1100), ...lines];
  assert.equal(scheduler.decide(snap({ now: 1600, lines: incoming })), 'question');
  assert.equal(scheduler.question, 'What is the deployment plan?');
});

test('only model-confirmed hesitation can relax the speaking guard in a supported mode', () => {
  const scheduler = new InsightScheduler();
  scheduler.reset(0, 0);
  const lines = [line('ME', 'I started explaining.', 1000)];
  const live = { ME: 'um let me think' };
  assert.equal(scheduler.decide(snap({ now: 5000, mode: 'full_power', lines, live })), null);
  assert.equal(
    scheduler.decide(snap({ now: 5000, mode: 'full_power', lines, live, isMeHesitating: true })),
    'user-help',
  );
  assert.equal(scheduler.decide(snap({ now: 5000, mode: 'only_questions', lines, live, isMeHesitating: true })), null);
});

test('all five mode sensitivity/invite/selection contracts agree across renderer and main process', () => {
  const { INSIGHT_MODES } = loadTs('src/features/workspace/insight-modes.ts');
  const { MODES } = require('../../src/main/domain/sessions/realtime-policy.cjs');
  for (const [name, config] of Object.entries(INSIGHT_MODES)) {
    for (const key of ['sensitivity', 'inviteMs', 'selection', 'periodicMs'])
      assert.equal(config[key], MODES[name][key], `${name}.${key}`);
  }
  assert.equal(insightMode('questions'), 'only_questions');
});

test('a failed incoming-question request restores its speech boundary and waits before retrying', () => {
  const s = new InsightScheduler();
  s.reset(0, 0);
  const lines = [line('THEY', 'What is the recovery plan?', 1000)];
  assert.equal(s.decide(snap({ now: 1100, lines })), 'question');
  s.requested(1, 1100);
  s.failed(2000);
  assert.equal(s.decide(snap({ now: 4999, lines })), null);
  assert.equal(s.decide(snap({ now: 5000, lines })), 'question');
  s.requested(1, 5000);
  s.completed();
  assert.equal(s.decide(snap({ now: 9000, lines })), null);
});

test('a failed provisional request can retry its final without duplicating a successful answer', () => {
  const s = new InsightScheduler();
  s.reset(0, 0);
  const live = { THEY: 'How do we retry this operation?' };
  s.decide(snap({ now: 1000, live }));
  assert.equal(s.decide(snap({ now: 2000, live })), 'question');
  s.requested(0, 2000);
  s.failed(2500);
  const lines = [line('THEY', live.THEY, 3000)];
  assert.equal(s.decide(snap({ now: 5500, lines })), 'question');
  s.requested(1, 5500);
  s.completed();
  assert.equal(s.decide(snap({ now: 9000, lines })), null);
});

test('a late failed request after reset cannot restore a previous listening boundary', () => {
  const s = new InsightScheduler();
  s.reset(0, 0);
  s.requested(1, 1000);
  s.reset(0, 2000);
  s.failed(2500);
  const lines = [line('THEY', 'What is the new question?', 3000)];
  assert.equal(s.decide(snap({ now: 3100, lines })), 'question');
});

test('a question within three seconds of the previous request waits for the minimum gap', () => {
  const s = new InsightScheduler();
  s.reset(0, 0);
  const first = [line('THEY', 'We moved the launch.', 1_000)];
  assert.equal(s.decide(snap({ now: 30_000, lines: first })), 'periodic');
  s.requested(1, 30_000);
  s.completed(true);
  const asked = [...first, line('THEY', 'What changed in the plan?', 31_000)];
  assert.equal(s.decide(snap({ now: 31_500, lines: asked })), null, 'inside the 3 s gap');
  assert.equal(s.decide(snap({ now: 32_999, lines: asked })), null);
  assert.equal(s.decide(snap({ now: 33_000, lines: asked })), 'question');
});

test('the first question after listening starts is not held by the gap', () => {
  const s = new InsightScheduler();
  s.reset(0, 5_000);
  const lines = [line('THEY', 'Can you hear me now?', 5_500)];
  assert.equal(s.decide(snap({ now: 5_600, lines })), 'question');
});

test('after a delivered insight, periodic checks wait for new speech from the other side', () => {
  const s = new InsightScheduler();
  s.reset(0, 0);
  const they = [line('THEY', 'We moved the launch.', 1_000)];
  assert.equal(s.decide(snap({ now: 30_000, lines: they, mode: 'moderate' })), null);
  assert.equal(s.decide(snap({ now: 90_000, lines: they, mode: 'moderate' })), 'periodic');
  s.requested(1, 90_000);
  s.completed(true);
  const mine = [...they, line('ME', 'Right, that makes sense.', 100_000)];
  assert.equal(s.decide(snap({ now: 200_000, lines: mine, mode: 'moderate' })), null, 'only my own speech');
  const theirs = [...mine, line('THEY', 'Marketing needs the new date.', 210_000)];
  assert.equal(s.decide(snap({ now: 220_000, lines: theirs, mode: 'moderate' })), 'periodic');
});

test('an empty insight does not hold later periodic checks', () => {
  const s = new InsightScheduler();
  s.reset(0, 0);
  const they = [line('THEY', 'We moved the launch.', 1_000)];
  assert.equal(s.decide(snap({ now: 90_000, lines: they, mode: 'moderate' })), 'periodic');
  s.requested(1, 90_000);
  s.completed(false);
  const mine = [...they, line('ME', 'Right, that makes sense.', 100_000)];
  assert.equal(s.decide(snap({ now: 200_000, lines: mine, mode: 'moderate' })), 'periodic');
});

test('repeated failures wait twice as long each time, up to two minutes, and a success resets the wait', () => {
  const s = new InsightScheduler();
  s.reset(0, 0);
  const lines = [line('THEY', 'What is the recovery plan?', 1000)];
  let now = 1100;
  const waits = [];
  for (let attempt = 0; attempt < 8; attempt += 1) {
    while (!s.decide(snap({ now, lines }))) now += 100;
    s.requested(1, now);
    const failedAt = now;
    s.failed(failedAt);
    now += 100;
    while (!s.decide(snap({ now, lines }))) now += 100;
    waits.push(now - failedAt);
  }
  assert.deepEqual(waits, [3000, 6000, 12000, 24000, 48000, 96000, 120000, 120000]);
  s.requested(1, now);
  s.completed();
  const later = now + 5000;
  const next = [...lines, line('THEY', 'And the rollback?', later - 100)];
  assert.equal(s.decide(snap({ now: later, lines: next })), 'question');
  s.requested(2, later);
  s.failed(later + 10);
  assert.equal(s.decide(snap({ now: later + 3009, lines: next })), null);
  assert.equal(s.decide(snap({ now: later + 3010, lines: next })), 'question');
});
