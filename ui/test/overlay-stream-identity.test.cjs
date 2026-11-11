const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTsx } = require('./helpers/load-tsx.cjs');

function fixture(entries = []) {
  let state;
  const { useOverlayStream: createStream } = loadTsx('src/features/workspace/use-overlay-stream.ts', {
    react: {
      useRef: (value) => ({ current: value }),
      useState: (initial) => {
        state = initial;
        return [
          state,
          (update) => {
            state = update(state);
          },
        ];
      },
    },
  });
  const stream = createStream({ session: async () => ({ entries }) }, () => 's');
  return { ...stream, state: () => state };
}

test('overlay event wiring carries insight identity through streaming and interruption', () => {
  const f = fixture();
  f.events.overlayDelta({
    requestId: 'insight-r',
    sessionId: 's',
    mode: 'screenInsight',
    sequence: 1,
    delta: 'Context',
  });
  assert.equal(f.state().mode, 'screenInsight');
  assert.equal(f.state().responseId, 'insight-r');
  f.events.overlayFinished({ requestId: 'insight-r', sessionId: 's', mode: 'screenInsight', sequence: 1 });
  assert.equal(f.state().mode, 'screenInsight');
  assert.equal(f.state().outcome, 'interrupted');
});

test('reopening an overlay restores saved identity while accepting legacy entries without it', async () => {
  for (const metadata of [{ generation_mode: 'insight', request_id: 'saved-r' }, {}]) {
    const f = fixture([{ id: 'entry', kind: 'assistant', content: 'Saved response', ...metadata }]);
    await f.showLatest('s', () => true);
    assert.equal(f.state().mode, metadata.generation_mode);
    assert.equal(f.state().responseId, metadata.request_id || 'entry');
    assert.equal(f.state().answer, 'Saved response');
  }
});

test('overlay completion wiring carries the error code and discards a late failure from an older request', () => {
  const f = fixture();
  f.events.overlayDelta({ requestId: 'old', sessionId: 's', mode: 'chat', sequence: 1, delta: 'Old' });
  f.events.overlayDelta({ requestId: 'new', sessionId: 's', mode: 'chat', sequence: 2, delta: 'New' });
  f.events.overlayFinished({
    requestId: 'old',
    sessionId: 's',
    sequence: 1,
    outcome: 'error',
    errorCode: 'generationFailed',
  });
  assert.equal(f.state().outcome, 'running');
  assert.equal(f.state().answer, 'New');
  f.events.overlayFinished({ requestId: 'new', sessionId: 's', sequence: 2, outcome: 'error', errorCode: 'timeout' });
  assert.equal(f.state().outcome, 'error');
  assert.equal(f.state().errorCode, 'timeout');
  assert.equal(f.state().answer, 'New');
});
