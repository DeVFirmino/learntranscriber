const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const plain = (value) => JSON.parse(JSON.stringify(value));
const { PointerGesture } = loadTs('src/features/notch-geometry.ts');

const bounds = { x: 100, y: 40, width: 360, height: 240 };
const at = (screenX, screenY, pointerId = 1) => ({ pointerId, screenX, screenY });

test('a press that stays within 4 pixels is a click, not a drag', () => {
  const gesture = new PointerGesture(at(500, 60), bounds);
  assert.equal(gesture.move(at(503, 60)), null);
  assert.equal(gesture.move(at(502, 62)), null);
  assert.equal(gesture.end(at(503, 60)), null);
});

test('once the pointer travels 4 pixels the gesture follows it, back to its origin too', () => {
  const gesture = new PointerGesture(at(500, 60), bounds);
  assert.deepEqual(plain(gesture.move(at(500, 64))), { dx: 0, dy: 4 });
  assert.deepEqual(plain(gesture.move(at(501, 60))), { dx: 1, dy: 0 });
  assert.deepEqual(plain(gesture.move(at(500, 60))), { dx: 0, dy: 0 });
  assert.deepEqual(plain(gesture.end(at(520, 50))), { dx: 20, dy: -10 });
});

test('another pointer neither moves nor owns the gesture', () => {
  const gesture = new PointerGesture(at(500, 60), bounds);
  assert.equal(gesture.owns(at(600, 60, 2)), false);
  assert.equal(gesture.move(at(600, 60, 2)), null);
  assert.equal(gesture.owns(at(600, 60)), true);
  assert.equal(gesture.end(at(600, 60)), null);
});

test('the offset moves the starting position or grows the starting size', () => {
  const gesture = new PointerGesture(at(500, 60), bounds);
  assert.deepEqual(plain(gesture.position({ dx: 30, dy: -20 })), { x: 130, y: 20 });
  assert.deepEqual(plain(gesture.size({ dx: -60, dy: 15 })), { width: 300, height: 255 });
  assert.deepEqual(gesture.bounds, bounds);
});
