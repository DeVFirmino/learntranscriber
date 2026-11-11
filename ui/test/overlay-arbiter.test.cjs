const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'),
  vm = require('node:vm'),
  ts = require('typescript');
const source = ts.transpileModule(fs.readFileSync('src/overlay-arbiter.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleValue = { exports: {} };
vm.runInNewContext(source, { module: moduleValue, exports: moduleValue.exports });
const { OverlayArbiter } = moduleValue.exports;

test('a late answer from another request cannot end the stream being shown', () => {
  const arbiter = new OverlayArbiter();
  assert.equal(arbiter.decide({ kind: 'delta', requestId: 'current', sessionId: 's1' }, 's1'), 'start');
  assert.equal(arbiter.decide({ kind: 'answer', requestId: 'background', sessionId: 's1' }, 's1'), 'ignore');
  assert.equal(arbiter.streaming, true);
  assert.equal(arbiter.decide({ kind: 'delta', requestId: 'current', sessionId: 's1' }, 's1'), 'append');
  assert.equal(arbiter.decide({ kind: 'answer', requestId: 'current', sessionId: 's1' }, 's1'), 'answer');
  assert.equal(arbiter.streaming, false);
});
test('events for another session and deltas of finished requests are ignored', () => {
  const arbiter = new OverlayArbiter();
  assert.equal(arbiter.decide({ kind: 'delta', requestId: 'r1', sessionId: 'old' }, 'new'), 'ignore');
  assert.equal(arbiter.decide({ kind: 'delta', requestId: 'r1', sessionId: 'new' }, 'new'), 'start');
  assert.equal(arbiter.decide({ kind: 'finished', requestId: 'r1', sessionId: 'new' }, 'new'), 'finish');
  assert.equal(
    arbiter.decide({ kind: 'delta', requestId: 'r1', sessionId: 'new' }, 'new'),
    'ignore',
    'a delta after finish cannot restart the stream',
  );
  assert.equal(arbiter.decide({ kind: 'finished', requestId: 'unknown' }, 'new'), 'ignore');
});
test('answers without request identity still display when nothing is streaming', () => {
  const arbiter = new OverlayArbiter();
  assert.equal(arbiter.decide({ kind: 'answer' }, 's1'), 'answer');
  assert.equal(arbiter.decide({ kind: 'answer', sessionId: 's1' }, null), 'answer');
});
test('with admission sequences the newest generation wins over interleaved and late output', () => {
  const arbiter = new OverlayArbiter();
  const A = { requestId: 'A', sessionId: 's1', sequence: 1 },
    B = { requestId: 'B', sessionId: 's1', sequence: 2 };
  const decisions = [
    ['delta', A],
    ['delta', B],
    ['delta', A],
    ['answer', B],
    ['finished', B],
    ['answer', A],
    ['finished', A],
  ].map(([kind, event]) => arbiter.decide({ kind, ...event }, 's1'));
  assert.deepEqual(decisions, ['start', 'start', 'ignore', 'answer', 'finish', 'ignore', 'ignore']);
  assert.equal(arbiter.streaming, false);
});
test('the display revision changes only when output is shown', () => {
  const arbiter = new OverlayArbiter();
  const before = arbiter.revision;
  arbiter.decide({ kind: 'delta', requestId: 'r1', sessionId: 'other', sequence: 1 }, 's1');
  assert.equal(arbiter.revision, before);
  arbiter.decide({ kind: 'delta', requestId: 'r1', sessionId: 's1', sequence: 1 }, 's1');
  assert.equal(arbiter.revision, before + 1, 'a slow initial load can see that newer output arrived');
});
