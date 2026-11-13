// The export channel accepts only known formats and short speaker labels from the renderer.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { registerDesktop } = require('../src/main/interface/ipc/desktop.cjs');

function exportHandler() {
  const calls = [];
  const handlers = new Map();
  registerDesktop((channel, handler) => handlers.set(channel, handler), {
    context: {},
    desktop: {},
    capture: {},
    captureImage: () => {},
    exports: { export: (owner, id, format, labels) => calls.push({ id, format, labels }) },
  });
  return { run: (...args) => handlers.get('sessions:export')({ sender: {} }, ...args), calls };
}

test('captions keep their format and the renderer-given speaker labels', () => {
  const { run, calls } = exportHandler();
  run('s1', 'vtt', { me: 'Eu', others: 'Outros' });
  assert.deepEqual(calls, [{ id: 's1', format: 'vtt', labels: { me: 'Eu', others: 'Outros' } }]);
});

test('an unknown format falls back to Markdown, and labels lose markup, line breaks and length', () => {
  const { run, calls } = exportHandler();
  run('s1', '../../etc', { me: '<b>Me</b>\nnow', others: 'x'.repeat(80) });
  run('s2', 'srt', 'not an object');
  assert.equal(calls[0].format, 'markdown');
  assert.deepEqual(calls[0].labels, { me: 'b Me /b  now', others: 'x'.repeat(40) });
  assert.deepEqual(calls[1].labels, {});
});
