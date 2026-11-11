const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { GenerationController } = loadTs('src/features/workspace/generation-controller.ts');
const { appendScreenshot } = loadTs('src/features/workspace/attachments.ts');
const { nextOverlayStream, initialOverlayStream, streamStatus } = loadTs('src/features/workspace/stream-state.ts');

function harness({
  generate = async () => {},
  capture = async () => 'data:image/png;base64,AAAA',
  quick = false,
  selected = 's1',
  ready = true,
  ensureSession = async () => {},
} = {}) {
  let images = [{ id: 'i1', data: 'img1' }],
    reviewed = { text: 'Selected', sessionId: 's1', label: 'Selection' },
    id = 0;
  const log = [],
    sent = [];
  const state = {
    activeSessionId: 's1',
    settings: { quickScreenshot: quick, provider: 'openai', model: 'chosen', customBaseUrl: '' },
    credentials: { openai: ready },
    chatgpt: { accounts: [], activeId: null },
    localModels: { models: [], binaries: {} },
  };
  let current = selected;
  const controller = new GenerationController({
    generate: async (input) => {
      sent.push(input);
      return generate(input);
    },
    capture,
    state: () => state,
    overlay: () => false,
    selectedId: () => current,
    shownSessionId: () => undefined,
    reviewedText: () => reviewed,
    clearReviewedText: (value) => {
      if (reviewed === value) reviewed = null;
    },
    images: () => images,
    replaceImages: (value) => {
      images = value;
    },
    attach: (image) => {
      images = [...images, { id: 'new', data: image }];
    },
    began: (requestId, question) => log.push(['began', requestId, question]),
    ended: () => log.push(['ended']),
    refresh: async () => log.push(['refresh']),
    ensureSession,
    attachedNotice: () => log.push(['notice']),
    newId: () => `r${++id}`,
  });
  return {
    controller,
    state,
    log,
    sent,
    images: () => images,
    reviewed: () => reviewed,
    switchTo: (value) => {
      current = value;
    },
  };
}

test('a chat question sends queued screenshots and reviewed text, clearing them only after success', async () => {
  const ok = harness();
  await ok.controller.run('chat', 'What is this?');
  assert.deepEqual(JSON.parse(JSON.stringify(ok.sent[0])), {
    requestId: 'r1',
    sessionId: 's1',
    mode: 'chat',
    question: 'What is this?',
    images: ['img1'],
    context: 'Selected',
  });
  assert.deepEqual([ok.images(), ok.reviewed()], [[], null]);
  const failed = harness({
    generate: async () => {
      throw new Error('Provider down.');
    },
  });
  await assert.rejects(failed.controller.run('chat', 'Again?'), /Provider down/);
  assert.equal(failed.images().length, 1);
  assert.ok(failed.reviewed());
  assert.deepEqual(failed.log, [['began', 'r1', 'Again?'], ['ended'], ['refresh']]);
});

test('only one answer runs at a time', async () => {
  let release;
  const { controller } = harness({
    generate: () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  });
  const first = controller.run('summary');
  await assert.rejects(controller.run('chat', 'x'), /Wait for the current response/);
  release();
  await first;
  assert.equal(controller.requestId, null);
});

test('a question waits for a screenshot being captured, and a second capture joins the first', async () => {
  let finish;
  const { controller, images, sent } = harness({
    capture: () =>
      new Promise((resolve) => {
        finish = () => resolve('data:image/png;base64,BBBB');
      }),
  });
  const capture = controller.capture(),
    again = controller.capture();
  await new Promise((resolve) => setImmediate(resolve));
  const asked = controller.run('chat', 'About the screen?');
  finish();
  await capture;
  await again;
  await asked;
  assert.deepEqual([...sent[0].images], ['img1', 'data:image/png;base64,BBBB']);
  assert.deepEqual(images(), []);
});

test('a capture is refused when the session changed meanwhile', async () => {
  let h;
  h = harness({
    capture: async () => {
      h.switchTo('s2');
      return 'data:image/png;base64,CC';
    },
  });
  await assert.rejects(h.controller.capture(), /The session changed during screen capture/);
  assert.equal(h.images().length, 1);
});

test('quick capture submits the screenshot without a draft or queued attachment step', async () => {
  const h = harness({ quick: true });
  await h.controller.capture();
  assert.equal(h.sent.length, 1);
  assert.equal(h.sent[0].mode, 'chat');
  assert.match(h.sent[0].question, /Analyze this screenshot/);
  assert.deepEqual([...h.sent[0].images], ['data:image/png;base64,AAAA']);
  assert.equal(h.images().length, 1, 'existing attachments stay queued for their own question');
});

test('screenshot attachments keep their limits', () => {
  const check = { isSafeScreenshot: (value) => value.startsWith('data:image/png;base64,'), newId: () => 'id' };
  const png = 'data:image/png;base64,' + 'A'.repeat(100);
  assert.throws(() => appendScreenshot([], 'data:image/jpeg;base64,AA', check), /PNG screenshot smaller than 8 MB/);
  assert.throws(
    () =>
      appendScreenshot(
        [1, 2, 3, 4].map((i) => ({ id: String(i), data: png })),
        png,
        check,
      ),
    /at most four/,
  );
  assert.equal(appendScreenshot([], png, check).length, 1);
});

test('the overlay stream starts, appends, answers and ignores what the arbiter rejects', () => {
  let state = initialOverlayStream;
  state = nextOverlayStream(state, 'start', {
    kind: 'delta',
    requestId: 'r1',
    text: 'Hel',
    at: '2026-10-31T12:00:00Z',
  });
  state = nextOverlayStream(state, 'append', {
    kind: 'delta',
    requestId: 'r1',
    text: 'lo',
    at: '2026-10-31T12:01:00Z',
  });
  assert.deepEqual(
    { ...state },
    { outcome: 'running', answer: 'Hello', streaming: true, responseId: 'r1', startedAt: '2026-10-31T12:00:00Z' },
  );
  assert.equal(nextOverlayStream(state, 'ignore', { kind: 'answer', text: 'Other' }), state);
  state = nextOverlayStream(state, 'answer', { kind: 'answer', requestId: 'r1', text: 'Hello!' });
  assert.deepEqual(
    { ...state },
    { outcome: 'saved', answer: 'Hello!', streaming: false, responseId: 'r1', startedAt: '2026-10-31T12:00:00Z' },
  );
  assert.equal(nextOverlayStream({ ...state, streaming: true }, 'finish', { kind: 'finished' }).streaming, false);
});

test('a streamed answer keeps the time it started, and a new request starts a new time', () => {
  let state = nextOverlayStream(initialOverlayStream, 'start', {
    kind: 'delta',
    requestId: 'r1',
    text: 'A',
    at: '2026-10-31T12:00:00Z',
  });
  for (const at of ['2026-10-31T12:00:30Z', '2026-10-31T12:02:00Z'])
    state = nextOverlayStream(state, 'append', { kind: 'delta', requestId: 'r1', text: '.', at });
  assert.equal(state.startedAt, '2026-10-31T12:00:00Z');
  state = nextOverlayStream(state, 'start', { kind: 'delta', requestId: 'r2', text: 'B', at: '2026-10-31T12:05:00Z' });
  assert.equal(state.startedAt, '2026-10-31T12:05:00Z');
  const appendFirst = nextOverlayStream(initialOverlayStream, 'append', {
    kind: 'delta',
    requestId: 'r3',
    text: 'C',
    at: '2026-10-31T12:06:00Z',
  });
  assert.equal(appendFirst.startedAt, '2026-10-31T12:06:00Z');
});

test('an automatic insight goes to the listening session even while a past session is shown', async () => {
  const h = harness({ selected: 'past-session' });
  await h.controller.run('insight');
  await h.controller.run('chat', 'About this old meeting?');
  assert.deepEqual(
    h.sent.map((input) => [input.mode, input.sessionId]),
    [
      ['insight', 's1'],
      ['chat', 'past-session'],
    ],
  );
});

test('only live insights send provisional speech and leave reviewed context and images untouched', async () => {
  const h = harness();
  await h.controller.run('insight', undefined, undefined, 'THEY: What is the rollback plan?');
  assert.equal(h.sent[0].liveTranscript, 'THEY: What is the rollback plan?');
  assert.equal(h.sent[0].context, undefined);
  assert.equal(h.sent[0].images, undefined);
  assert.equal(h.images().length, 1);
  assert.equal(h.reviewed().text, 'Selected');
  await h.controller.run('chat', 'Hello', undefined, 'THEY: private live speech');
  assert.equal(h.sent[1].liveTranscript, undefined);
});

test('an interrupted stream retains its partial text while a saved answer is never labelled interrupted', () => {
  const partial = nextOverlayStream(initialOverlayStream, 'start', { kind: 'delta', requestId: 'r', text: 'Partial' });
  const interrupted = nextOverlayStream(partial, 'finish', { kind: 'finished', requestId: 'r' });
  assert.equal(interrupted.answer, 'Partial');
  assert.equal(interrupted.outcome, 'interrupted');
  const saved = nextOverlayStream(partial, 'answer', { kind: 'answer', text: 'Complete' });
  assert.equal(nextOverlayStream(saved, 'finish', { kind: 'finished' }).outcome, 'saved');
});

test('overlay streams keep generation mode through deltas, completion and interruption, resetting on a new request', () => {
  let state = nextOverlayStream(initialOverlayStream, 'start', {
    kind: 'delta',
    requestId: 'i',
    sessionId: 's',
    mode: 'insight',
    text: 'Context',
  });
  state = nextOverlayStream(state, 'append', { kind: 'delta', requestId: 'i', text: ' continues' });
  assert.equal(state.mode, 'insight');
  assert.equal(nextOverlayStream(state, 'finish', { kind: 'finished', requestId: 'i' }).mode, 'insight');
  state = nextOverlayStream(state, 'answer', {
    kind: 'answer',
    requestId: 'i',
    mode: 'insight',
    text: 'Saved context',
  });
  assert.equal(state.mode, 'insight');
  state = nextOverlayStream(state, 'start', {
    kind: 'delta',
    requestId: 'c',
    sessionId: 's',
    mode: 'chat',
    text: 'Reply',
  });
  assert.equal(state.mode, 'chat');
  assert.equal(state.responseId, 'c');
  state = nextOverlayStream(state, 'start', { kind: 'delta', requestId: 'legacy', text: 'No metadata' });
  assert.equal(state.mode, undefined);
});

test('explicit completion distinguishes failure from cancellation without discarding partial text', () => {
  const partial = nextOverlayStream(initialOverlayStream, 'start', { kind: 'delta', requestId: 'r', text: 'Partial' });
  for (const outcome of ['error', 'cancelled']) {
    const ended = nextOverlayStream(partial, 'finish', {
      kind: 'finished',
      requestId: 'r',
      outcome,
      errorCode: outcome === 'error' ? 'generationFailed' : undefined,
    });
    assert.equal(ended.outcome, outcome);
    assert.equal(ended.answer, 'Partial');
    assert.equal(ended.streaming, false);
  }
});

test('completion handles empty failures, success without text and a saved answer without false interruption', () => {
  const empty = nextOverlayStream(initialOverlayStream, 'start', { kind: 'delta', requestId: 'r', text: '' });
  const failed = nextOverlayStream(empty, 'finish', { kind: 'finished', outcome: 'error', errorCode: 'timeout' });
  assert.equal(failed.outcome, 'error');
  assert.equal(failed.errorCode, 'timeout');
  assert.equal(failed.answer, '');
  assert.equal(nextOverlayStream(empty, 'finish', { kind: 'finished', outcome: 'success' }).outcome, 'idle');
  const saved = nextOverlayStream(empty, 'answer', { kind: 'answer', text: 'Saved' });
  assert.equal(nextOverlayStream(saved, 'finish', { kind: 'finished', outcome: 'success' }).outcome, 'saved');
  const fresh = nextOverlayStream(failed, 'start', { kind: 'delta', requestId: 'new', text: 'Retry' });
  assert.equal(fresh.outcome, 'running');
  assert.equal(fresh.errorCode, undefined);
});

test('floating completion messages use distinct localized keys and alert semantics only for failures', () => {
  assert.equal(streamStatus('error', 'timeout').key, 'overlay.generationTimeout');
  assert.equal(streamStatus('error', 'generationFailed').role, 'alert');
  assert.equal(streamStatus('cancelled').key, 'overlay.cancelled');
  assert.equal(streamStatus('cancelled').role, 'status');
  assert.equal(streamStatus('interrupted').key, 'overlay.interrupted');
  for (const outcome of ['idle', 'running', 'saved']) assert.equal(streamStatus(outcome), null);
});

test('chat and quick capture stop before generation or screenshot side effects when AI is not ready', async () => {
  const h = harness({
    ready: false,
    quick: true,
    capture: async () => assert.fail('Must not capture without quick-generation readiness'),
  });
  await assert.rejects(h.controller.run('chat', 'Keep this question'), /Connect an AI provider/);
  await assert.rejects(h.controller.capture(), /Connect an AI provider/);
  assert.deepEqual(h.sent, []);
  assert.deepEqual(h.log, []);
  assert.equal(h.images().length, 1);
  assert.ok(h.reviewed());
});

test('attachment capture remains available without an AI provider', async () => {
  const h = harness({ ready: false, quick: false });
  await h.controller.capture();
  assert.equal(h.images().length, 2);
  assert.deepEqual(h.sent, []);
  assert.deepEqual(h.log, [['notice']]);
});

test('readiness is rechecked after a quick screenshot finishes', async () => {
  const h = harness({
    quick: true,
    capture: async () => {
      h.state.credentials.openai = false;
      return 'data:image/png;base64,AAAA';
    },
  });
  await assert.rejects(h.controller.capture(), /Connect an AI provider/);
  assert.deepEqual(h.sent, []);
  assert.equal(h.images().length, 1);
});

test('capture retains its in-flight guard before any screen capture side effect', async () => {
  let release;
  const h = harness({
    capture: async () => assert.fail('Busy capture must not run'),
    generate: () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  });
  const generating = h.controller.run('chat', 'Question');
  await assert.rejects(h.controller.capture(), /Wait for the current response/);
  release('Answer');
  await generating;
});

test('quick capture checks readiness again after session preparation before taking the screenshot', async () => {
  const h = harness({
    quick: true,
    ensureSession: async () => {
      h.state.credentials.openai = false;
    },
    capture: async () => assert.fail('Must not capture after readiness was lost'),
  });
  await assert.rejects(h.controller.capture(), /Connect an AI provider/);
  assert.deepEqual(h.sent, []);
  assert.equal(h.images().length, 1);
});
