const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');

// A browser stand-in: decoded pictures of a chosen size, and a canvas that records what was drawn.
function browser({ width = 10, height = 10, context = true } = {}) {
  const calls = { closed: 0, drawn: 0 };
  const globals = {
    createImageBitmap: async () => ({ width, height, close: () => calls.closed++ }),
    document: {
      createElement: () => ({
        getContext: () => (context ? { drawImage: () => calls.drawn++ } : null),
        toDataURL: (type) => `data:${type};base64,AAAA`,
      }),
    },
  };
  return { calls, paste: loadTs('src/features/paste-image.ts', globals) };
}

test('the first image in the clipboard is the one pasted', () => {
  const { paste } = browser();
  const items = [{ type: 'text/plain' }, { type: 'image/jpeg', id: 1 }, { type: 'image/png', id: 2 }];
  assert.equal(paste.pastedImageItem(items).id, 1);
  assert.equal(paste.pastedImageItem([{ type: 'text/html' }]), undefined);
});

test('files over 8 MB and pictures over 100 million pixels are refused at the limit, not before', () => {
  const { paste } = browser();
  assert.equal(paste.fileProblem(8_000_000), null);
  assert.equal(paste.fileProblem(8_000_001), 'session.tooLarge');
  assert.equal(paste.pictureProblem(10_000, 10_000), null);
  assert.equal(paste.pictureProblem(10_001, 10_000), 'session.tooBig');
});

test('an accepted image is redrawn as a PNG and its decoded picture is released', async () => {
  const { paste, calls } = browser();
  assert.equal((await paste.pastedImageToPng({ size: 1000 })).image, 'data:image/png;base64,AAAA');
  assert.deepEqual({ ...calls }, { closed: 1, drawn: 1 });
});

test('a refused or undrawable picture names its message and is still released', async () => {
  const huge = browser({ width: 20_000, height: 20_000 });
  assert.equal((await huge.paste.pastedImageToPng({ size: 1000 })).problem, 'session.tooBig');
  assert.equal(huge.calls.closed, 1);
  const noCanvas = browser({ context: false });
  assert.equal((await noCanvas.paste.pastedImageToPng({ size: 1000 })).problem, 'session.notPrepared');
  assert.equal(noCanvas.calls.closed, 1);
  const heavy = browser();
  assert.equal((await heavy.paste.pastedImageToPng({ size: 9_000_000 })).problem, 'session.tooLarge');
  assert.equal(heavy.calls.closed, 0);
});
