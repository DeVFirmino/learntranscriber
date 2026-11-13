// A saved note follows the chosen template's sections, and the setting accepts only the known templates.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { NOTE_TEMPLATE_IDS, noteContract } = require('../src/main/domain/sessions/note-templates.cjs');
const { noteMessages } = require('../src/main/domain/sessions/session-note.cjs');
const { validateSettings } = require('../src/main/domain/settings/validate.cjs');
const { DEFAULTS } = require('../src/main/domain/settings/defaults.cjs');

const session = {
  title: 'Week 3',
  started_at: '2026-11-02T12:05:00.000Z',
  entries: [{ kind: 'transcript', speaker: 'THEY', content: 'Recursion calls itself on a smaller input.' }],
};
const headings = (text) => text.match(/^## .+$/gm);

test('each template asks for its own sections, all starting with the summary', () => {
  const expected = {
    general: ['## Summary', '## Decisions', '## Open items', '## Next steps'],
    standup: ['## Summary', '## Updates by person', '## Blockers', '## Follow-ups'],
    oneOnOne: ['## Summary', '## Topics', '## Feedback', '## Action items', '## For next time'],
    interview: [
      '## Summary',
      '## Questions and answers',
      '## Evidence for the role',
      '## Open questions',
      '## Next steps',
    ],
    lecture: ['## Summary', '## Key terms', '## Main ideas', '## Questions to review', '## Assignments and dates'],
  };
  assert.deepEqual(NOTE_TEMPLATE_IDS, Object.keys(expected));
  for (const [id, sections] of Object.entries(expected)) assert.deepEqual(headings(noteContract(id)), sections, id);
});

test('every template keeps the no-invention rules, and an unknown one falls back to general', () => {
  for (const id of NOTE_TEMPLATE_IDS)
    assert.match(noteContract(id), /do not invent details, decisions, dates or owners/);
  assert.equal(noteContract('nope'), noteContract('general'));
});

test('the note request uses the chosen template', () => {
  const [system] = noteMessages({ session, summaryGuidance: 'TLDR.', language: 'en', template: 'lecture' });
  assert.match(system.content, /## Key terms/);
  assert.doesNotMatch(system.content, /## Decisions/);
});

test('the setting defaults to general and refuses other values', () => {
  assert.equal(DEFAULTS.sessionNoteTemplate, 'general');
  assert.deepEqual(validateSettings({ sessionNoteTemplate: 'standup' }), { sessionNoteTemplate: 'standup' });
  assert.throws(() => validateSettings({ sessionNoteTemplate: 'essay' }), /Choose a supported note template/);
});
