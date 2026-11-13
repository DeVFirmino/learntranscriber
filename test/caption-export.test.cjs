// A session's transcript exports as SRT or WebVTT captions timed from the session start.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { captionCues, sessionCaptions } = require('../src/main/domain/sessions/caption-export.cjs');

const start = '2026-11-12T10:00:00.000Z';
const at = (seconds) => new Date(Date.parse(start) + seconds * 1000).toISOString();
const entry = (seconds, speaker, content, kind = 'transcript') => ({
  id: `e${seconds}`,
  kind,
  speaker,
  content,
  created_at: at(seconds),
});
const session = (entries) => ({ started_at: start, entries });
const labels = { me: 'Me', others: 'Others' };

test('each utterance ends at its saved time and starts where the previous one ended', () => {
  const cues = captionCues(session([entry(3, 'THEY', 'Good morning.'), entry(5, 'ME', 'Hi.')]), labels);
  assert.deepEqual(
    cues.map(({ start, end, speaker }) => [start, end, speaker]),
    [
      [0, 3000, 'Others'],
      [3000, 5000, 'Me'],
    ],
  );
});

test('a cue starts at most eight seconds before it ends, and lasts at least one second', () => {
  const cues = captionCues(session([entry(30, 'THEY', 'Late.'), entry(30.2, 'THEY', 'Right after.')]), labels);
  assert.deepEqual([cues[0].start, cues[0].end], [22000, 30000]);
  assert.deepEqual([cues[1].start, cues[1].end], [30000, 31000]);
});

test('questions and answers are left out, and only the transcript is captioned', () => {
  const cues = captionCues(
    session([entry(2, 'ME', 'What is a gerund?', 'user'), entry(4, 'THEY', 'Open your books.')]),
    labels,
  );
  assert.equal(cues.length, 1);
  assert.deepEqual(cues[0].lines, ['Open your books.']);
});

test('a long utterance splits into cues of two lines of at most 42 characters', () => {
  const words = 'the present perfect connects a past action to now and we use it with for and since every day';
  const cues = captionCues(session([entry(8, 'THEY', `${words} ${words}`)]), labels);
  assert.ok(cues.length > 1);
  for (const cue of cues) {
    assert.ok(cue.lines.length <= 2);
    for (const line of cue.lines) assert.ok(line.length <= 42, line);
  }
  assert.equal(cues[0].start, 0);
  assert.equal(cues.at(-1).end, 8000);
  for (let i = 1; i < cues.length; i++) assert.equal(cues[i].start, cues[i - 1].end);
});

test('SRT numbers its cues, uses a comma before milliseconds and puts the speaker first', () => {
  const srt = sessionCaptions(session([entry(3723.5, 'THEY', 'Welcome back.')]), 'srt', labels);
  assert.equal(srt, '1\n01:01:55,500 --> 01:02:03,500\nOthers: Welcome back.\n');
});

test('WebVTT has its header, a voice span and escaped markup', () => {
  const vtt = sessionCaptions(session([entry(2, 'ME', 'a < b & c')]), 'vtt', labels);
  assert.equal(vtt, 'WEBVTT\n\n00:00:00.000 --> 00:00:02.000\n<v Me>a &lt; b &amp; c\n');
});

test('an empty transcript gives an empty caption file', () => {
  assert.equal(sessionCaptions(session([]), 'srt', labels), '');
  assert.equal(sessionCaptions(session([]), 'vtt', labels), 'WEBVTT\n\n');
});
