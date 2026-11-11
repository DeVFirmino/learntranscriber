// The window's address names its page and its role; the overlay and the Notch are the overlay windows.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');

const at = (hash, search) =>
  loadTs('src/features/workspace/window-location.ts', { window: { location: { hash, search } }, URLSearchParams });

test('the page comes after the hash, and home without one', () => {
  assert.equal(at('#settings/audio', '').readRoute(), 'settings/audio');
  assert.equal(at('', '').readRoute(), 'home');
});

test('the window role comes from the address, and main without one', () => {
  assert.equal(at('', '?window=notch').readWindowRole(), 'notch');
  assert.equal(at('', '').readWindowRole(), 'main');
  assert.equal(at('', '?window=overlay').readOverlay(), true);
  assert.equal(at('', '?window=notch').readOverlay(), true);
  assert.equal(at('', '?window=main').readOverlay(), false);
  assert.equal(at('', '').readOverlay(), false);
});
