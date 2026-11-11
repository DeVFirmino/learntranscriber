const { test } = require('node:test');
const assert = require('node:assert/strict');
const react = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { loadTsx } = require('./helpers/load-tsx.cjs');
const { loadTs } = require('./helpers/load-ts.cjs');
const { en } = loadTs('src/locales/en.ts');
const t = (key, values = {}) =>
  Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{{${name}}}`, value), en[key] ?? key);
const base = {
  'src/use-t.ts': { useT: () => ({ t }) },
  'src/components/ui/button.tsx': { Button: 'Button' },
  './demo.css': {},
};

test('conversation keeps the other person transcript when comparing General with Note Taker', () => {
  const { DemoConversation } = loadTsx('src/features/onboarding/demo-conversation.tsx', base);
  const frame = { phase: 'insight', transcript: en['onboardingDemo.phrase'], progress: 100 };
  const general = renderToStaticMarkup(react.createElement(DemoConversation, { frame, assistant: 'general' }));
  const notes = renderToStaticMarkup(react.createElement(DemoConversation, { frame, assistant: 'notes' }));
  for (const html of [general, notes]) {
    assert.match(html, /Other person/);
    assert.match(html, /I read the chapter twice/);
    assert.match(html, /data-align="end"/);
  }
  assert.match(general, /Try recalling one idea before rereading/);
  assert.match(notes, /Reading recap/);
  assert.doesNotMatch(notes, /Try recalling one idea before rereading/);
});

test('prepared Progress exposes its numeric value to assistive technology', () => {
  const { Progress } = loadTsx('src/components/ui/progress.tsx');
  const html = renderToStaticMarkup(react.createElement(Progress, { value: 85, 'aria-label': 'Example progress' }));
  assert.match(html, /role="progressbar"/);
  assert.match(html, /aria-valuenow="85"/);
  assert.match(html, /aria-label="Example progress"/);
});
