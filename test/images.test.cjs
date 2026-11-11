const test = require('node:test');
const assert = require('node:assert/strict');
const { requestImages } = require('../src/main/domain/sessions/images.cjs');
const a =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2NofoAAAAASUVORK5CYII=';
const b = a.replace('x8AA', 'x8AB');

test('ordered screenshots and legacy single image are accepted without mutation', () => {
  const source = [a, b],
    result = requestImages({ images: source });
  assert.deepEqual(result, [a, b]);
  assert.notEqual(result, source);
  assert.deepEqual(requestImages({ image: a }), [a]);
  assert.deepEqual(requestImages({}), []);
});

const jpeg =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';

test('a JPEG screenshot is accepted beside PNG ones, and a broken JPEG is refused', () => {
  assert.deepEqual(requestImages({ images: [a, jpeg] }), [a, jpeg]);
  assert.deepEqual(requestImages({ image: jpeg }), [jpeg]);
  assert.throws(() => requestImages({ image: 'data:image/jpeg;base64,/9j/YQ==' }), /Invalid JPEG screenshot/);
  const noFrame = 'data:image/jpeg;base64,' + Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString('base64');
  assert.throws(() => requestImages({ image: noFrame }), /Invalid JPEG screenshot/);
});

test('invalid, oversized and ambiguous screenshot requests fail before provider transport', () => {
  assert.throws(() => requestImages({ images: [a, b, a, b, a] }), /at most 4/);
  assert.throws(() => requestImages({ images: ['data:image/svg+xml;base64,YQ=='] }), /Invalid screen image/);
  assert.throws(() => requestImages({ images: ['data:image/png;base64,YQ=='] }), /Invalid PNG screenshot/);
  assert.throws(() => requestImages({ images: [a], image: b }), /either images/);
  assert.throws(() => requestImages({ images: [42] }), /Invalid screen image/);
});
