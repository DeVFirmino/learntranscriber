const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openDatabase } = require('../src/main/infrastructure/sqlite/database.cjs');
const { createRepositories } = require('../src/main/infrastructure/sqlite/repositories.cjs');
const { createActiveSession } = require('../src/main/application/runtime/active-session.cjs');
const { createRequestRegistry } = require('../src/main/application/runtime/requests.cjs');
const { createGeneration } = require('../src/main/application/sessions/generate.cjs');
const { persistGeneratedOutput } = require('../src/main/application/sessions/generated-output.cjs');
const { prepareSessionContext } = require('../src/main/application/sessions/context-preparation.cjs');

function harness(
  t,
  { provider = 'openai', answer = 'Generated answer.', stream, lease, ready, notchAllowed = true, extra = {} } = {},
) {
  const repos = createRepositories(openDatabase(':memory:'));
  t.after(() => repos.db.close());
  repos.settings.update({
    provider: 'custom',
    customBaseUrl: 'http://127.0.0.1:1/v1',
    model: 'fixture',
    translationLanguage: 'Portuguese',
  });
  const session = repos.sessions.create('Planning', 'general');
  const active = createActiveSession();
  active.set(session.id);
  const log = {
    owner: [],
    overlay: [],
    answers: [],
    finished: [],
    presented: [],
    changes: 0,
    leases: { acquired: 0, released: 0 },
    automaticFailures: [],
    settledRounds: [],
    errors: [],
    traces: [],
  };
  const requests = createRequestRegistry({ timers: { setTimeout, clearTimeout } });
  const generation = createGeneration({
    sessions: {
      get: (id) => repos.sessions.get(id),
      updateModel: (id, m) => repos.sessions.updateModel(id, m),
      assistantFor: (id) => repos.assistants.forSession(id),
      addUserEntry: (id, q, generation) => repos.entries.add(id, 'user', q, '', null, generation),
      persistOutput: (s, mode, a, requestId) => persistGeneratedOutput(repos, s, mode, a, requestId),
    },
    settings: () => ({ ...repos.settings.read(), provider }),
    active,
    requests,
    acquireLocal: () => {
      log.leases.acquired++;
      return {
        vision: false,
        contextSize: 4096,
        base: 'http://127.0.0.1:9',
        model: 'local-model',
        ...lease,
        release: () => log.leases.released++,
      };
    },
    notch: {
      canStartInsight: () => notchAllowed,
      presentAnswer: (value) => {
        log.presented.push(value);
        return value.automatic ? value.requestId : null;
      },
    },
    compactor: { compact: async () => ({ summary: 'Compacted.' }) },
    providers: {
      ready,
      checkContext: async () => {},
      stream:
        stream ||
        (async (_settings, _messages, onDelta) => {
          onDelta(answer);
          return answer;
        }),
    },
    prepareContext: (options) =>
      prepareSessionContext({
        repositories: repos,
        providers: { checkContext: async () => {} },
        ...options,
      }),
    summaryRewrite: { messages: () => [{ role: 'user', content: 'Rewrite.' }], clean: (value) => `clean:${value}` },
    requestImages: () => [],
    insightRounds: { settle: (id, analyzed) => log.settledRounds.push({ id, analyzed }) },
    events: {
      ownerDelta: (_sender, payload) => log.owner.push(payload),
      overlayDelta: (payload) => log.overlay.push(payload),
      answer: (payload) => log.answers.push(payload),
      finished: (payload) => log.finished.push(payload),
      automaticFailed: (message) => log.automaticFailures.push(message),
    },
    changed: () => log.changes++,
    log: (message) => log.errors.push(message),
    trace: (message) => log.traces.push(message),
    ...extra,
  });
  const run = (input, id = 'r1') =>
    generation.run({ requestId: id, sessionId: session.id, ...input }, { sender: { id: 1 } });
  return { repos, session, log, run, requests };
}
const kinds = (repos) => (id) => repos.sessions.get(id).entries.map((e) => e.kind);

test('bulk translation off is refused before inference or session changes', async (t) => {
  let calls = 0;
  const f = harness(t, {
    stream: async () => {
      calls++;
      return 'Must not run';
    },
  });
  f.repos.entries.add(f.session.id, 'transcript', 'A saved sentence.', 'THEY');
  f.repos.settings.update({ translationLanguage: '' });
  const before = f.repos.sessions.get(f.session.id);
  await assert.rejects(f.run({ mode: 'translation' }), /Translation is off/);
  assert.equal(calls, 0);
  assert.deepEqual(f.repos.sessions.get(f.session.id), before);
  assert.deepEqual(f.log.overlay, []);
});

test('automatic screen insight stays available in Session when the optional Notch is unavailable', async (t) => {
  const f = harness(t, { notchAllowed: false });
  assert.equal(await f.run({ mode: 'screenInsight', context: 'Selected source text' }), 'Generated answer.');
  assert.equal(f.log.answers.length, 1);
  assert.equal(f.log.overlay.length, 2);
  assert.deepEqual(f.log.presented, []);
});

test('hesitation evaluation uses its tiny model budget without writing or publishing an answer', async (t) => {
  let observed;
  const f = harness(t, {
    stream: async (settings, messages) => {
      observed = { settings, messages };
      return 'HESITATING';
    },
  });
  const before = f.repos.sessions.get(f.session.id);
  assert.equal(await f.run({ mode: 'insightHesitation', liveTranscript: 'um let me think' }), 'HESITATING');
  assert.equal(observed.settings.generationFeature, 'realtimeSummaryEval');
  assert.equal(observed.settings.generationConfig.maxOutputTokens, 15);
  assert.equal(observed.messages[1].content, 'um let me think');
  assert.deepEqual(f.repos.sessions.get(f.session.id), before);
  assert.deepEqual(f.log.owner, []);
  assert.deepEqual(f.log.overlay, []);
  assert.deepEqual(f.log.answers, []);
  assert.deepEqual(f.log.finished, []);
  assert.equal(f.log.changes, 0);
  await assert.rejects(
    f.run({ mode: 'insightHesitation' }, 'invalid-eval'),
    /active listening session and live speech/,
  );
});

test('session generation carries the feature preset through preparation to the provider route', async (t) => {
  for (const [mode, feature] of [
    ['chat', 'analysis'],
    ['summary', 'summary'],
    ['insight', 'realtimeSummary'],
    ['translation', 'translation'],
  ]) {
    let observed;
    const f = harness(t, {
      stream: async (settings) => {
        observed = settings;
        return 'Fixture answer';
      },
    });
    f.repos.entries.add(f.session.id, 'transcript', 'A controlled conversation.', 'THEY');
    await f.run({ mode, question: 'Question' });
    assert.equal(observed.generationFeature, feature, mode);
    assert.equal(observed.model, 'fixture');
  }
});

test('invalid input is refused before any request starts', async (t) => {
  const { repos, session, log, run } = harness(t);
  repos.entries.add(session.id, 'transcript', 'We chose queues.', 'THEY');
  await assert.rejects(run({ mode: 'poem' }), /Invalid generation mode/);
  await assert.rejects(run({ mode: 'chat', question: 'Hi', context: 5 }), /Context must be at most/);
  await assert.rejects(run({ mode: 'summaryRewrite', draft: 5, instructions: '' }), /Invalid overview rewrite request/);
  assert.deepEqual(log.finished, []);
});

for (const mode of ['summary', 'summaryRewrite', 'translation', 'insight'])
  test(`${mode} needs a transcript first`, async (t) => {
    const { run } = harness(t);
    await assert.rejects(run({ mode }), /Add or record a transcript/);
  });

test('chat stores the question before the answer and streams to owner and overlay', async (t) => {
  const { repos, session, log, run } = harness(t);
  assert.equal(await run({ mode: 'chat', question: 'What next?' }), 'Generated answer.');
  assert.deepEqual(kinds(repos)(session.id), ['user', 'assistant']);
  assert.equal(log.owner.length, 1);
  assert.deepEqual(
    log.overlay.map((event) => event.delta),
    ['', 'Generated answer.'],
  );
  assert.equal(log.answers[0].entryId, repos.sessions.get(session.id).entries[1].id);
  assert.deepEqual(log.finished, [
    { requestId: 'r1', sessionId: session.id, mode: 'chat', sequence: 1, outcome: 'success' },
  ]);
  assert.equal(log.changes, 1);
});

test('summary and translation write their fields, not entries', async (t) => {
  const { repos, session, run } = harness(t);
  repos.entries.add(session.id, 'transcript', 'We chose queues.', 'THEY');
  await run({ mode: 'summary' }, 's1');
  await run({ mode: 'translation' }, 't1');
  const saved = repos.sessions.get(session.id);
  assert.equal(saved.summary, 'Generated answer.');
  assert.equal(saved.translation, 'Generated answer.');
  assert.deepEqual(kinds(repos)(session.id), ['transcript']);
});

test('a summary rewrite returns a cleaned draft and writes, publishes and shows nothing', async (t) => {
  const { repos, session, log, run } = harness(t);
  repos.entries.add(session.id, 'transcript', 'We chose queues.', 'THEY');
  assert.equal(
    await run({ mode: 'summaryRewrite', draft: 'Old.', instructions: 'Shorter.' }),
    'clean:Generated answer.',
  );
  assert.equal(repos.sessions.get(session.id).summary, '');
  assert.deepEqual([log.overlay, log.answers, log.finished, log.presented], [[], [], [], []]);
  assert.equal(log.owner.length, 1);
  assert.equal(log.changes, 0);
});

test('automatic insights never use the Notch answer path even when the Notch is available, unlike a chat answer', async (t) => {
  const { repos, session, log, run } = harness(t);
  repos.entries.add(session.id, 'transcript', 'We chose queues.', 'THEY');
  await run({ mode: 'insight' }, 'i1');
  await run({ mode: 'screenInsight', context: 'Selected source text' }, 's1');
  assert.deepEqual(log.presented, []);
  assert.deepEqual(
    log.answers.map((answer) => answer.displayAckId),
    [undefined, undefined],
  );
  assert.deepEqual(kinds(repos)(session.id), ['transcript', 'assistant', 'assistant']);
  await run({ mode: 'chat', question: 'What did we choose?' }, 'c1');
  assert.equal(log.presented.length, 1);
  assert.equal(log.presented[0].automatic, false);
});

test('a live insight stays in Session and is not blocked by an unrelated Notch', async (t) => {
  const { repos, session, log, run } = harness(t, { notchAllowed: false });
  repos.entries.add(session.id, 'transcript', 'We chose queues.', 'THEY');
  await run({ mode: 'insight' }, 'i1');
  assert.deepEqual(log.presented, []);
  assert.equal(log.answers[0].displayAckId, undefined);
  assert.equal(log.answers[0].text, 'Generated answer.');
  assert.deepEqual(kinds(repos)(session.id), ['transcript', 'assistant']);
});

test('/compact runs the compactor and publishes without streaming', async (t) => {
  const { log, run } = harness(t);
  assert.equal(await run({ mode: 'chat', question: ' /compact ' }), 'Compacted.');
  assert.deepEqual(log.owner, []);
  assert.equal(log.changes, 1);
});

test('a local provider releases its lease after a provider failure and stores no answer', async (t) => {
  const { repos, session, log, run } = harness(t, {
    provider: 'local',
    stream: async () => {
      throw new Error('Model crashed.');
    },
  });
  await assert.rejects(run({ mode: 'chat', question: 'Hi' }), /Model crashed/);
  assert.deepEqual(log.leases, { acquired: 1, released: 1 });
  assert.deepEqual(kinds(repos)(session.id), ['user']);
  assert.equal(log.finished.length, 1);
});

test('each admitted generation carries a higher sequence on every overlay event', async (t) => {
  const { repos, session, log, run } = harness(t);
  repos.entries.add(session.id, 'transcript', 'We chose queues.', 'THEY');
  await run({ mode: 'chat', question: 'One?' }, 'a');
  await run({ mode: 'insight' }, 'b');
  assert.deepEqual(
    log.overlay.map((event) => event.sequence),
    [1, 1, 2, 2],
  );
  assert.deepEqual(
    log.answers.map((event) => event.sequence),
    [1, 2],
  );
  assert.deepEqual(
    log.finished.map((event) => event.sequence),
    [1, 2],
  );
});

test('a question asked without a model fails before it is stored, so retries are not duplicated', async (t) => {
  let streamed = 0;
  const { repos, session, run } = harness(t, {
    ready: async () => {
      throw new Error('Choose an assistant model in AI sources.');
    },
    stream: async () => {
      streamed++;
      return 'x';
    },
  });
  for (const id of ['r1', 'r2']) await assert.rejects(run({ mode: 'chat', question: 'hi' }, id), /assistant model/);
  assert.deepEqual(kinds(repos)(session.id), []);
  assert.equal(streamed, 0);
});

test('a failed automatic insight is reported to every window, a failed chat only to its owner', async (t) => {
  t.mock.method(console, 'error', () => {});
  const { repos, session, log, run } = harness(t, {
    stream: async () => {
      throw new Error('Provider down.');
    },
  });
  repos.entries.add(session.id, 'transcript', 'We chose queues.', 'THEY');
  await assert.rejects(run({ mode: 'insight' }, 'i1'), /Provider down/);
  await assert.rejects(run({ mode: 'chat', question: 'Hi' }, 'c1'), /Provider down/);
  assert.deepEqual(log.automaticFailures, ['Provider down.']);
});

test('an automatic request is traced outside the error log, and only its failure is logged as an error', async (t) => {
  const ok = harness(t);
  ok.repos.entries.add(ok.session.id, 'transcript', 'We chose queues.', 'THEY');
  await ok.run({ mode: 'insight' }, 'i1');
  assert.deepEqual(ok.log.traces, [`Generation insight requested for session ${ok.session.id}.`]);
  assert.deepEqual(ok.log.errors, []);
  const failing = harness(t, {
    stream: async () => {
      throw new Error('Provider down.');
    },
  });
  failing.repos.entries.add(failing.session.id, 'transcript', 'We chose queues.', 'THEY');
  await assert.rejects(failing.run({ mode: 'insight' }, 'i1'), /Provider down/);
  assert.deepEqual(failing.log.errors, ['Generation insight failed: Provider down.']);
});

test('a request still waiting after the slow mark is logged as a warning, and a quick one is not', async (t) => {
  const timers = [];
  const warnings = [];
  const fake = {
    setTimeout: (fn, ms) => {
      const timer = { fn, ms, cleared: false };
      timers.push(timer);
      return timer;
    },
    clearTimeout: (timer) => {
      if (timer) timer.cleared = true;
    },
  };
  let release;
  const slow = harness(t, {
    provider: 'chatgpt',
    stream: () => new Promise((resolve) => (release = () => resolve('Late answer.'))),
    extra: { warn: (message) => warnings.push(message), timers: fake, slowAfterMs: 30000 },
  });
  slow.repos.entries.add(slow.session.id, 'transcript', 'We chose queues.', 'THEY');
  const pending = slow.run({ mode: 'insight' }, 'i1');
  await new Promise((resolve) => setImmediate(resolve));
  const mark = timers.find((timer) => timer.ms === 30000);
  mark.fn();
  assert.deepEqual(warnings, ['Generation insight has waited 30 s for chatgpt · fixture.']);
  release();
  await pending;
  assert.equal(mark.cleared, true);
  const quick = harness(t, { extra: { warn: (message) => warnings.push(message), timers: fake } });
  quick.repos.entries.add(quick.session.id, 'transcript', 'We chose queues.', 'THEY');
  await quick.run({ mode: 'insight' }, 'i2');
  assert.equal(timers.filter((timer) => timer.ms === 30000).at(-1).cleared, true);
  assert.equal(warnings.length, 1);
});

test('provisional speech reaches the insight model before finalization without becoming a transcript', async (t) => {
  const received = [];
  const { repos, session, run } = harness(t, {
    stream: async (_settings, messages, delta) => {
      received.push(messages);
      delta('Use a reversible deployment.');
      return 'Use a reversible deployment.';
    },
  });
  await run({ mode: 'insight', liveTranscript: 'THEY: What is the rollback plan?' });
  // The words still being recognized close the round's transcript in the user message.
  assert.match(received[0][1].content, /THEY: \[currently speaking\] What is the rollback plan\?$/);
  assert.deepEqual(kinds(repos)(session.id), ['assistant']);
  assert.equal(
    repos.sessions.get(session.id).entries.some((e) => e.content.includes('What is the rollback plan?')),
    false,
  );
});

test('provisional speech is bounded and cannot replace the transcript in other generation modes', async (t) => {
  const { run } = harness(t);
  for (const liveTranscript of [5, 'x'.repeat(20001)])
    await assert.rejects(run({ mode: 'insight', liveTranscript }), /Context must be at most/);
  await assert.rejects(run({ mode: 'insight', liveTranscript: '  ' }), /Add or record a transcript/);
  for (const mode of ['chat', 'summary', 'translation'])
    await assert.rejects(
      run({ mode, question: 'Hi', liveTranscript: 'THEY: provisional' }),
      /only used for live insights/,
    );
});

test('a live spoken question goes out under the question trigger without storing a duplicate user entry', async (t) => {
  let prompt;
  const { repos, session, run } = harness(t, {
    stream: async (_settings, messages, onDelta) => {
      prompt = messages.map((message) => message.content).join('\n');
      onDelta('Dependency injection supplies dependencies from outside a class.');
      return 'Dependency injection supplies dependencies from outside a class.';
    },
  });
  repos.entries.add(session.id, 'transcript', 'What is dependency injection?', 'ME');
  await run({ mode: 'insight', question: 'What is dependency injection?', trigger: 'question' });
  // A question trigger reads the latest ten transcript messages under the question instruction.
  assert.match(prompt, /Trigger: USER\/ME or THEY asked a question\./);
  assert.match(prompt, /Latest 10 transcript messages:\n\nME: What is dependency injection\?/);
  assert.deepEqual(kinds(repos)(session.id), ['transcript', 'assistant']);
});

for (const stopped of ['error', 'cancelled']) {
  test(`generation identity survives a ${stopped} question followed by an automatic insight`, async (t) => {
    let calls = 0;
    let started;
    const streaming = new Promise((resolve) => {
      started = resolve;
    });
    const f = harness(t, {
      stream: async (_route, _messages, delta, signal) => {
        if (calls++ === 0) {
          delta('Partial reply');
          started();
          if (stopped === 'error') throw new Error('Provider failed');
          await new Promise((_resolve, reject) =>
            signal.addEventListener('abort', () => reject(signal.reason), { once: true }),
          );
        }
        delta('Automatic insight');
        return 'Automatic insight';
      },
    });
    f.repos.entries.add(f.session.id, 'transcript', 'Meeting context', 'THEY');
    const question = f.run({ mode: 'chat', question: 'Unanswered question' }, 'question-request');
    const rejected = assert.rejects(question);
    await streaming;
    if (stopped === 'cancelled') f.requests.cancel('question-request', 1);
    await rejected;
    await f.run({ mode: 'insight' }, 'insight-request');
    const turns = f.repos.sessions.get(f.session.id).entries.filter((entry) => entry.kind !== 'transcript');
    assert.deepEqual(
      turns.map((entry) => [entry.kind, entry.generation_mode, entry.request_id]),
      [
        ['user', 'chat', 'question-request'],
        ['assistant', 'insight', 'insight-request'],
      ],
    );
    for (const event of f.log.overlay.concat(f.log.answers, f.log.finished)) {
      assert.equal(event.sessionId, f.session.id);
      assert.equal(event.mode, event.requestId === 'question-request' ? 'chat' : 'insight');
    }
    assert.equal(f.log.answers[0].entryId, turns[1].id);
    assert.equal(f.log.finished[0].outcome, stopped);
    assert.equal(f.log.finished[1].outcome, 'success');
  });
}

test('a saved chat question and reply share their request identity', async (t) => {
  const f = harness(t);
  await f.run({ mode: 'chat', question: 'Hello' }, 'paired-chat');
  const turns = f.repos.sessions.get(f.session.id).entries;
  assert.deepEqual(
    turns.map((entry) => [entry.generation_mode, entry.request_id]),
    [
      ['chat', 'paired-chat'],
      ['chat', 'paired-chat'],
    ],
  );
});

test('a readiness failure is visible before a provider emits its first token', async (t) => {
  const f = harness(t, {
    ready: async () => {
      throw new Error('Not ready');
    },
  });
  await assert.rejects(f.run({ mode: 'chat', question: 'Hi' }), /Not ready/);
  assert.equal(f.log.overlay[0].delta, '');
  assert.equal(f.log.finished[0].outcome, 'error');
  assert.equal(f.log.finished[0].errorCode, 'generationFailed');
  assert.equal(f.log.finished[0].requestId, f.log.overlay[0].requestId);
});

test('cancellation prevents a provider’s late resolved answer from being persisted or published', async (t) => {
  const f = harness(t, {
    stream: async (_settings, _messages, delta) => {
      delta('Partial');
      f.requests.cancel('late', 1);
      return 'Late answer after cancellation';
    },
  });
  await assert.rejects(f.run({ mode: 'chat', question: 'Hi' }, 'late'));
  assert.deepEqual(kinds(f.repos)(f.session.id), ['user']);
  assert.deepEqual(f.log.answers, []);
  assert.equal(f.log.finished[0].outcome, 'cancelled');
});

test('a cancelled automatic insight does not broadcast a provider failure toast even when its abort is wrapped', async (t) => {
  const f = harness(t, {
    stream: async () => {
      f.requests.cancel('cancel-insight', 1);
      throw new Error('Wrapped provider abort');
    },
  });
  f.repos.entries.add(f.session.id, 'transcript', 'Meeting context', 'THEY');
  await assert.rejects(f.run({ mode: 'insight' }, 'cancel-insight'), /Wrapped provider abort/);
  assert.deepEqual(f.log.automaticFailures, []);
  assert.equal(f.log.finished[0].outcome, 'cancelled');
  // A cancellation is not a failure, so the error log stays clean for the real ones.
  assert.deepEqual(f.log.errors, []);
  assert.ok(f.log.traces.includes('Generation insight was cancelled.'));
});

test('a late cancelled insight does not mark its round analyzed', async (t) => {
  const f = harness(t, {
    stream: async () => {
      f.requests.cancel('late-insight', 1);
      return 'Late insight';
    },
  });
  f.repos.entries.add(f.session.id, 'transcript', 'Meeting context', 'THEY');
  await assert.rejects(f.run({ mode: 'insight' }, 'late-insight'));
  assert.deepEqual(f.log.settledRounds, [{ id: f.session.id, analyzed: false }]);
  assert.deepEqual(f.log.answers, []);
});

test('manual insight failures return to their panel owner without broadcasting an automatic failure', async (t) => {
  const f = harness(t, {
    stream: async () => {
      throw new Error('Provider unavailable');
    },
  });
  f.repos.entries.add(f.session.id, 'transcript', 'Heard context', 'THEY');
  await assert.rejects(f.run({ mode: 'insight', trigger: 'manual' }), /Provider unavailable/);
  assert.deepEqual(f.log.automaticFailures, []);
  assert.equal(f.log.finished.length, 1);
  assert.equal(f.log.finished[0].outcome, 'error');
  assert.equal(f.log.errors.length, 1);
});
