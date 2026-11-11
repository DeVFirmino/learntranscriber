const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { finishSession } = loadTs('src/features/finish-session.ts', { Error });
function fixture({ summary = '', failed = 0, generateError } = {}) {
  const calls = [],
    session = { id: 'session', summary, ended_at: null };
  const ports = {
    stopAudio: async () => {
      calls.push('flush');
    },
    failedSegments: () => failed,
    cancelGeneration: async () => {
      calls.push('cancel');
    },
    endSession: async (id) => {
      assert.equal(id, session.id);
      calls.push('end');
      session.ended_at = 'ended';
      return { ...session };
    },
    generateSummary: async (id) => {
      assert.equal(id, session.id);
      calls.push('summary');
      if (generateError) throw generateError;
      session.summary = 'Generated after flush';
    },
    session: async () => ({ ...session }),
    pendingAudioMessage: 'Retry pending audio',
  };
  return { calls, session, ports };
}
test('ending with a summary flushes before persistence and generates only from the ended session', async () => {
  const f = fixture();
  const ended = await finishSession('session', true, f.ports);
  assert.deepEqual(f.calls, ['flush', 'cancel', 'end', 'summary']);
  assert.equal(ended.ended_at, 'ended');
  assert.equal(ended.summary, 'Generated after flush');
});
test('failed audio prevents ending while summary failure preserves the ended session for retry', async () => {
  const audio = fixture({ failed: 1 });
  await assert.rejects(finishSession('session', true, audio.ports), /Retry pending audio/);
  assert.equal(audio.session.ended_at, null);
  assert.deepEqual(audio.calls, ['flush']);
  const model = fixture({ generateError: new Error('Provider unavailable') });
  await assert.rejects(finishSession('session', true, model.ports), /Provider unavailable/);
  assert.equal(model.session.ended_at, 'ended');
  assert.equal(model.session.summary, '');
});
test('ending without delivery never invokes inference and an existing reviewed summary is retained', async () => {
  const plain = fixture();
  await finishSession('session', false, plain.ports);
  assert.ok(!plain.calls.includes('summary'));
  const existing = fixture({ summary: 'Manually reviewed summary' });
  const ended = await finishSession('session', true, existing.ports);
  assert.equal(ended.summary, 'Manually reviewed summary');
  assert.ok(!existing.calls.includes('summary'));
});
