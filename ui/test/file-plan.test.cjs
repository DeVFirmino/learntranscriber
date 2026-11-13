// An audio file is cut into chunks of at most 30 seconds that cover it once, and its session is named after it.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { chunkRanges, fileSessionTitle, chunkSegmentId, FILE_SAMPLE_RATE } = loadTs(
  'src/features/file-transcription/file-plan.ts',
);

const plain = (value) => JSON.parse(JSON.stringify(value));

test('chunks are 30 seconds long, the last one shorter, and they cover every sample once', () => {
  const ranges = plain(chunkRanges(FILE_SAMPLE_RATE * 75));
  assert.deepEqual(ranges, [
    { start: 0, end: 480000 },
    { start: 480000, end: 960000 },
    { start: 960000, end: 1200000 },
  ]);
});

test('an empty file has no chunks, and a short one has one', () => {
  assert.deepEqual(plain(chunkRanges(0)), []);
  assert.deepEqual(plain(chunkRanges(100)), [{ start: 0, end: 100 }]);
});

test('the session is named after the file, without its extension', () => {
  assert.equal(fileSessionTitle('Lecture 4 - Recursion.m4a'), 'Lecture 4 - Recursion');
  assert.equal(fileSessionTitle('meeting.final.mp4'), 'meeting.final');
  assert.equal(fileSessionTitle('.mp3'), 'Audio file');
  assert.equal(fileSessionTitle('x'.repeat(120) + '.wav').length, 80);
});

test('each chunk has a stable segment id within the 100-character limit', () => {
  assert.equal(chunkSegmentId('session-1', 3), 'file-session-1-3');
  assert.ok(chunkSegmentId('s'.repeat(100), 9999).length <= 100);
});
