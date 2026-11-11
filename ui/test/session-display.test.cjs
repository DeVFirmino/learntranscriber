const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');

const { summaryPreview, durationMinutes, groupByDay, sessionTime, sessionDate } = loadTs(
  'src/features/sessions/session-display.ts',
);
const plain = (value) => JSON.parse(JSON.stringify(value));

test('a summary preview drops headings and list or emphasis marks', () => {
  assert.equal(
    summaryPreview('## Overview\nThe group chose **Madrid**.\n\n## Decisions\n- Ship on _Friday_\n1. Test `queue`'),
    'The group chose Madrid. Ship on Friday Test queue',
  );
  assert.equal(summaryPreview('## Overview\n\n'), '');
});

test('the duration is whole minutes, at least one, and unknown while the session runs', () => {
  const started = '2026-11-02T16:08:00.000Z';
  assert.equal(durationMinutes({ started_at: started, ended_at: '2026-11-02T16:20:20.000Z' }), 12);
  assert.equal(durationMinutes({ started_at: started, ended_at: '2026-11-02T16:08:10.000Z' }), 1);
  assert.equal(durationMinutes({ started_at: started, ended_at: null }), null);
});

test('sessions are grouped by their local start day in page order, naming today and yesterday', () => {
  const now = new Date(2026, 10, 3, 9, 0);
  const at = (day, hour) => ({ started_at: new Date(2026, 10, day, hour).toISOString(), id: `${day}-${hour}` });
  const groups = groupByDay([at(3, 8), at(2, 22), at(2, 10), at(1, 9)], now);
  assert.deepEqual(plain(groups.map((group) => [group.day, group.sessions.map((session) => session.id)])), [
    ['today', ['3-8']],
    ['yesterday', ['2-22', '2-10']],
    ['earlier', ['1-9']],
  ]);
});

test('a long session ending later does not split its start day into repeated groups', () => {
  const now = new Date(2026, 10, 3, 9);
  const sessions = [
    { id: 'long', started_at: new Date(2026, 10, 2, 23).toISOString() },
    { id: 'today', started_at: new Date(2026, 10, 3, 7).toISOString() },
    { id: 'older', started_at: new Date(2026, 10, 2, 20).toISOString() },
  ];
  const groups = groupByDay(sessions, now);
  assert.deepEqual(plain(groups.map((group) => [group.day, group.sessions.map((session) => session.id)])), [
    ['yesterday', ['long', 'older']],
    ['today', ['today']],
  ]);
});

test('session metadata uses the selected language for local time and compact calendar dates', () => {
  const value = new Date(2026, 10, 3, 16, 8).toISOString();
  assert.equal(sessionTime(value, 'en-GB'), '16:08');
  assert.equal(sessionTime(value, 'en-US').replace(/\s+/g, ' '), '4:08 PM');
  assert.equal(sessionDate(value, 'en-GB').replace(',', ''), 'Tue 3 Nov');
});
