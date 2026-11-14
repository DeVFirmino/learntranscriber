// A stopped session's summary and handoff, saved as a Markdown note only when the user asks.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { noteMessages, noteFileName, noteDocument } = require('../src/main/domain/sessions/session-note.cjs');
const { createSessionNotes } = require('../src/main/application/sessions/session-notes.cjs');
const { sessionNoteFiles } = require('../src/main/infrastructure/files/session-note-files.cjs');

const SESSION = {
  id: 's1',
  title: 'Planning: Q4/roadmap?',
  started_at: '2026-11-02T12:05:00.000Z',
  assistant_id: null,
  entries: [
    { kind: 'transcript', speaker: 'THEY', content: 'We ship on Friday.' },
    { kind: 'assistant', speaker: null, content: 'Noted.' },
    { kind: 'transcript', speaker: 'ME', content: 'I will write the release notes.' },
  ],
};

test('the note asks for the summary guidance plus decisions, open items and next steps, from the transcript only', () => {
  const [system, user] = noteMessages({
    session: SESSION,
    summaryGuidance: 'TLDR first.',
    language: 'pt-BR',
    template: 'general',
  });
  for (const section of ['## Summary', '## Decisions', '## Open items', '## Next steps'])
    assert.ok(system.content.includes(section));
  assert.match(system.content, /Summary guidance:\nTLDR first\./);
  assert.match(user.content, /THEY: We ship on Friday\.\nME: I will write the release notes\.$/);
  assert.doesNotMatch(user.content, /Noted\./);
  assert.throws(
    () => noteMessages({ session: { ...SESSION, entries: [] }, summaryGuidance: '', language: 'en' }),
    /nothing to save/,
  );
});

test('the automatic note asks for detailed notes shaped to the session, with no summary guidance when there is none', () => {
  const [system] = noteMessages({ session: SESSION, summaryGuidance: '', language: 'en' });
  assert.match(system.content, /Write detailed notes of this session/);
  assert.match(system.content, /Class or lecture:/);
  assert.doesNotMatch(system.content, /Summary guidance:/);
  assert.doesNotMatch(system.content, /## Decisions/);
});

test('the file name sorts by local time and keeps the title safe for any file system', () => {
  const date = new Date(2026, 10, 2, 9, 7);
  assert.equal(noteFileName(SESSION, date), '2026-11-02 09-07 Planning Q4 roadmap.md');
  assert.equal(noteFileName({ title: '' }, date), '2026-11-02 09-07 Session.md');
  assert.match(
    noteDocument(SESSION, '## Summary\nShip Friday.', date),
    /^# Planning: Q4\/roadmap\?\n\n\d{4}-\d\d-\d\d \d\d:\d\d\n\n## Summary\nShip Friday\.\n$/,
  );
});

test('saving writes the generated note into the folder without replacing an earlier one, and opens only saved notes', async () => {
  const documents = fs.mkdtempSync(path.join(os.tmpdir(), 'notes-'));
  const opened = [];
  const files = sessionNoteFiles({ documents: () => documents, openPath: async (target) => (opened.push(target), '') });
  const notes = createSessionNotes({
    settings: () => ({ sessionNotesFolder: '', uiLanguage: 'en' }),
    sessions: { get: () => SESSION },
    assistants: { forSession: () => null },
    providers: { checkContext: async () => {}, stream: async () => '## Summary\nShip Friday.' },
    route: { run: (settings, work) => work(settings) },
    files,
    now: () => new Date(2026, 10, 2, 9, 7),
  });
  const signal = new AbortController().signal;
  const first = await notes.save({ sessionId: 's1' }, signal);
  const second = await notes.save({ sessionId: 's1' }, signal);
  assert.equal(path.dirname(first.path), path.join(documents, 'LearnTranscriber', 'Sessions'));
  assert.notEqual(first.path, second.path);
  assert.match(fs.readFileSync(first.path, 'utf8'), /## Summary\nShip Friday\./);
  await notes.open(first.path);
  assert.deepEqual(opened, [first.path]);
  assert.throws(() => notes.open('/etc/hosts'), /Only a note saved/);
  fs.rmSync(documents, { recursive: true, force: true });
});
