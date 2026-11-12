const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  isConnectionFailure,
  unreachableMessage,
  DROPPED_MESSAGE,
} = require('../src/main/domain/shared/connection-failure.cjs');
const { reachingFetch } = require('../src/main/infrastructure/providers/reaching-fetch.cjs');
const { sse } = require('../src/main/infrastructure/providers/sse.cjs');

const fetchFailed = (cause) => new TypeError('fetch failed', { cause });

test('Node fetch errors that never reached the server are connection failures', () => {
  for (const code of ['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT'])
    assert.equal(isConnectionFailure(fetchFailed({ code })), true, code);
  const dualStack = Object.assign(new AggregateError([{ code: 'ECONNREFUSED' }, { code: 'ECONNREFUSED' }]), {});
  assert.equal(isConnectionFailure(fetchFailed(dualStack)), true);
  assert.equal(isConnectionFailure(new TypeError('terminated', { cause: { code: 'UND_ERR_SOCKET' } })), true);
});

test('a refused redirect, an abort or any other error keeps its own meaning', () => {
  assert.equal(isConnectionFailure(fetchFailed(new Error('unexpected redirect'))), false);
  assert.equal(isConnectionFailure(Object.assign(new Error('aborted'), { name: 'AbortError' })), false);
  assert.equal(isConnectionFailure(new Error('HTTP 500')), false);
  assert.equal(isConnectionFailure(undefined), false);
});

test('a loopback address points at the local server, anything else at the internet', () => {
  assert.match(unreachableMessage('http://127.0.0.1:8080/v1/chat/completions'), /local server on this Mac/);
  assert.match(unreachableMessage('http://localhost:11434/v1/models'), /local server on this Mac/);
  assert.match(unreachableMessage('https://api.openai.com/v1/chat/completions'), /internet connection/);
  assert.match(unreachableMessage('not a url'), /internet connection/);
});

test('reachingFetch passes responses through and explains a request that never arrived', async () => {
  const response = { ok: true };
  assert.equal(await reachingFetch(async () => response)('https://api.openai.com/v1/models', {}), response);
  const offline = reachingFetch(async () => {
    throw fetchFailed({ code: 'ENOTFOUND' });
  });
  await assert.rejects(offline('https://api.openai.com/v1/models', {}), (error) => {
    assert.match(error.message, /Could not reach the AI service/);
    assert.equal(error.cause.message, 'fetch failed');
    return true;
  });
  const other = new Error('unexpected');
  await assert.rejects(
    reachingFetch(async () => {
      throw other;
    })('https://api.openai.com', {}),
    (error) => error === other,
  );
});

function droppingResponse(failure) {
  const chunks = [new TextEncoder().encode('data: {"delta":"Hi"}\n\n')];
  return {
    body: {
      getReader: () => ({
        read: async () => {
          if (chunks.length) return { done: false, value: chunks.shift() };
          throw failure;
        },
        cancel: async () => {},
        releaseLock: () => {},
      }),
    },
  };
}

test('a connection that drops mid-answer is reported as a drop, after the events that arrived', async () => {
  const events = [];
  const read = async () => {
    for await (const event of sse(droppingResponse(new TypeError('terminated', { cause: { code: 'UND_ERR_SOCKET' } }))))
      events.push(event);
  };
  await assert.rejects(read, (error) => error.message === DROPPED_MESSAGE);
  assert.deepEqual(events, [{ delta: 'Hi' }]);
});

test('any other stream error is left as it was', async () => {
  const failure = new Error('decoder broke');
  const read = async () => {
    for await (const event of sse(droppingResponse(failure))) void event;
  };
  await assert.rejects(read, (error) => error === failure);
});
