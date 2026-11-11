const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTsx, elements } = require('./helpers/load-tsx.cjs');
const { FollowUpCompact } = loadTsx('src/components/follow-ups/follow-up-compact.tsx', {
  './follow-up-compact.css': {},
  'src/components/ui/button.tsx': { Button: 'Button' },
  'src/components/ui/suggestion-chip.tsx': { SuggestionChip: 'SuggestionChip' },
  'src/use-t.ts': { useT: () => ({ t: (key) => key }) },
});
const render = (props = {}) =>
  FollowUpCompact({
    suggestions: [],
    busy: false,
    loaded: false,
    error: '',
    disabled: false,
    requesting: false,
    onGenerate() {},
    onSelect() {},
    ...props,
  });
test('compact suggestions have one load action, then a refresh with the actual prompt chips', () => {
  let generated = 0;
  const idle = render({ onGenerate: () => generated++ });
  const buttons = elements(idle, 'Button');
  assert.equal(buttons.length, 1);
  buttons[0].props.onClick();
  assert.equal(generated, 1);
  assert.match(JSON.stringify(idle), /followUps.group/);
  const loaded = render({ loaded: true, suggestions: [{ text: 'Why?', prompt: 'Explain your last answer.' }] });
  assert.match(JSON.stringify(loaded), /notch.refresh/);
  assert.equal(elements(loaded, 'SuggestionChip')[0].props.title, 'Explain your last answer.');
});
test('loading is cancellable and empty/error states remain visible', () => {
  let stopped = 0;
  const busy = render({ busy: true, disabled: true, onStop: () => stopped++ });
  const buttons = elements(busy, 'Button');
  assert.equal(buttons[0].props.disabled, true);
  buttons[1].props.onClick();
  assert.equal(stopped, 1);
  assert.match(JSON.stringify(render({ loaded: true })), /followUps.empty/);
  assert.match(JSON.stringify(render({ error: 'Failed' })), /Failed/);
});
