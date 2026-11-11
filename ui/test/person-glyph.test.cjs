const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { loadTs } = require('./helpers/load-ts.cjs');
const { loadTsx } = require('./helpers/load-tsx.cjs');
const { PersonGlyph } = loadTsx('src/components/person-glyph.tsx');
const { SessionGlyph } = loadTsx('src/features/sessions/session-glyph.tsx');
const { CUSTOM_MARKS, ROLE_MARKS, randomMark } = loadTs('src/features/assistants/assistant-glyphs.ts');

const paths = (markup) =>
  [...markup.matchAll(/<path d="([^"]+)" stroke="([^"]+)"/g)].map(([, d, stroke]) => ({ d, stroke }));

test('the person glyph draws the person in the text colour and the given mark in the blue accent', () => {
  const markup = renderToStaticMarkup(
    React.createElement(PersonGlyph, { mark: ROLE_MARKS.math, className: 'size-5', 'data-test': 'math' }),
  );
  assert.match(markup, /aria-hidden="true"/);
  assert.match(markup, /focusable="false"/);
  assert.match(markup, /class="brand-icon size-5"/);
  assert.match(markup, /data-test="math"/);
  const [person, mark] = paths(markup);
  assert.equal(person.stroke, 'currentColor');
  assert.deepEqual(mark, { d: ROLE_MARKS.math, stroke: 'var(--brand-icon-accent, #2581ff)' });
});

test('a session shows a mark picked from its own id, and keeps it on every render', () => {
  const id = '6f1c2d3e-4b5a-4c7d-8e9f-0a1b2c3d4e5f';
  const markup = renderToStaticMarkup(React.createElement(SessionGlyph, { id, className: 'size-6' }));
  assert.match(markup, new RegExp(`data-session-glyph="${id}"`));
  assert.match(markup, /class="brand-icon size-6"/);
  const [, mark] = paths(markup);
  assert.equal(mark.d, randomMark(id));
  assert.ok(CUSTOM_MARKS.includes(mark.d));
  assert.equal(markup, renderToStaticMarkup(React.createElement(SessionGlyph, { id, className: 'size-6' })));
});

test('sessions spread across the sixteen avatars and never borrow a built-in role mark', () => {
  const marks = new Set(Array.from({ length: 200 }, (_, index) => randomMark(`session-${index}`)));
  assert.equal(marks.size, CUSTOM_MARKS.length);
  for (const mark of Object.values(ROLE_MARKS)) assert.ok(!marks.has(mark));
});
