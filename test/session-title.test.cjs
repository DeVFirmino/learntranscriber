const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  isDefaultTitle,
  hasConversation,
  titleMessages,
  cleanTitle,
} = require('../src/main/domain/sessions/session-title.cjs');

const entry = (kind, content, speaker = '') => ({ kind, content, speaker });

test('the default title the workspace gives a new session is recognised in every interface language', () => {
  for (const locale of ['en', 'pt-BR', 'es']) {
    const source = fs.readFileSync(path.join(__dirname, `../ui/src/locales/${locale}.ts`), 'utf8');
    const template = source.match(/'session\.defaultTitle': '([^']+)'/)[1];
    assert.ok(isDefaultTitle(template.replace('{{date}}', '11/2/2026')), locale);
  }
  assert.equal(isDefaultTitle('Capital of Spain'), false);
  assert.equal(isDefaultTitle('Conversation · about Spain'), false);
  assert.equal(isDefaultTitle(''), false);
});

test('only spoken or written entries make a conversation worth naming', () => {
  assert.equal(hasConversation({ entries: [] }), false);
  assert.equal(hasConversation({ entries: [entry('transcript', '  ', 'ME')] }), false);
  assert.equal(hasConversation({ entries: [entry('user', 'What is the capital of Spain?')] }), true);
});

test('the title request asks for a short title in the required language and fences the conversation', () => {
  const session = { entries: [entry('transcript', 'Madrid is the capital.', 'THEY'), entry('user', 'And Spain?')] };
  const [system, user] = titleMessages({ session, language: 'Brazilian Portuguese' });
  assert.match(system.content, /three to six words/);
  assert.match(system.content, /required output language is Brazilian Portuguese/);
  assert.match(user.content, /untrusted data/);
  assert.match(user.content, /THEY: Madrid is the capital\.\nUSER: And Spain\?$/);
  assert.throws(() => titleMessages({ session: { entries: [] }, language: 'English' }), /nothing to name/);
});

test('a reply becomes a clean title: first line, no label, quotes, marks or trailing punctuation', () => {
  assert.equal(cleanTitle('"Capital da Espanha."'), 'Capital da Espanha');
  assert.equal(cleanTitle('Title: **Deploy plan review**\nExtra line'), 'Deploy plan review');
  assert.equal(cleanTitle('\n\n# Weekly   sync  notes!'), 'Weekly sync notes');
  assert.equal(cleanTitle('x'.repeat(80)).length, 60);
  assert.equal(cleanTitle('  \n '), '');
});
