const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createGenerationRequest } = require('../src/main/application/sessions/generation-request.cjs');
const metadata = { id: 'r', sessionId: 's', owner: 1, mode: 'chat', sequence: 3 };

for (const reason of ['success', 'error', 'cancelled', 'timeout']) {
  test(`generation completion reports ${reason} from the actual request signal`, async () => {
    const controller = new AbortController();
    const events = [];
    let completion;
    const run = createGenerationRequest({
      requests: { run: (_metadata, work) => work(controller.signal) },
      finished: (event) => events.push(event),
    });
    const work = async () => {
      if (reason === 'cancelled') controller.abort();
      if (reason === 'timeout') controller.abort(new DOMException('Timeout', 'TimeoutError'));
      if (reason !== 'success') throw new Error('Provider echoed private material');
      return 'Answer';
    };
    const result = run(metadata, work, (value) => {
      completion = value;
    });
    if (reason === 'success') assert.equal(await result, 'Answer');
    else await assert.rejects(result, /private material/);
    const outcome = ['error', 'timeout'].includes(reason) ? 'error' : reason;
    assert.equal(completion.outcome, outcome);
    assert.equal(events.length, 1);
    assert.deepEqual(events[0], { requestId: 'r', sessionId: 's', mode: 'chat', sequence: 3, ...completion });
    assert.equal(completion.errorCode, { error: 'generationFailed', timeout: 'timeout' }[reason]);
    assert.doesNotMatch(JSON.stringify(events), /private material/);
  });
}

test('a provider resolving after cancellation cannot report success', async () => {
  const controller = new AbortController();
  let completion;
  const run = createGenerationRequest({
    requests: { run: (_metadata, work) => work(controller.signal) },
    finished: () => {},
  });
  await assert.rejects(
    run(
      metadata,
      async () => {
        controller.abort();
        return 'Late answer';
      },
      (value) => {
        completion = value;
      },
    ),
  );
  assert.equal(completion.outcome, 'cancelled');
});
