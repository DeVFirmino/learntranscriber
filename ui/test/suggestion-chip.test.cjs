const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTsx, elements } = require('./helpers/load-tsx.cjs');
const { SuggestionChip } = loadTsx('src/components/ui/suggestion-chip.tsx', {
  './suggestion-chip.css': {},
  'src/components/ui/button.tsx': { Button: 'Button' },
});

test('suggestions do not submit an enclosing form and preserve the full prompt action', () => {
  let selected = '';
  const chip = SuggestionChip({
    children: 'Plan the next step',
    title: 'What is the next practical step?',
    disabled: false,
    onClick: () => {
      selected = 'What is the next practical step?';
    },
  });
  assert.equal(chip.props.type, 'button');
  assert.equal(chip.props.title, 'What is the next practical step?');
  chip.props.onClick();
  assert.equal(selected, 'What is the next practical step?');
  assert.equal(SuggestionChip({ children: 'Plan', disabled: true }).props.disabled, true);
});

for (const [file, exported] of [
  ['src/components/follow-ups/follow-up-panel.tsx', 'FollowUpPanel'],
  ['src/components/follow-ups/follow-up-compact.tsx', 'FollowUpCompact'],
  ['src/features/notch/notch-follow-up-list.tsx', 'NotchFollowUpList'],
]) {
  test(`${exported} sends the same full suggestion prompt and blocks chips while requesting`, () => {
    let selected = '';
    const { [exported]: render } = loadTsx(file, {
      './follow-up-compact.css': {},
      'src/components/ui/suggestion-chip.tsx': { SuggestionChip: 'SuggestionChip' },
      'src/components/ui/button.tsx': { Button: 'Button' },
      'src/use-t.ts': { useT: () => ({ t: (key) => key }) },
      'src/workspace.ts': { useWorkspace: () => ({ requestId: 'busy' }) },
    });
    const suggestions = [{ text: 'Plan', prompt: 'What is the next practical step?' }];
    const node = render({
      suggestions,
      state: { suggestions, loaded: true },
      responseLength: 100,
      requesting: true,
      onSelect: (prompt) => {
        selected = prompt;
      },
      onAsk: (prompt) => {
        selected = prompt;
      },
    });
    const chips = elements(node, 'SuggestionChip');
    assert.equal(chips.length, 1);
    assert.equal(chips[0].props.disabled, true);
    assert.equal(chips[0].props.title, suggestions[0].prompt);
    chips[0].props.onClick();
    assert.equal(selected, suggestions[0].prompt);
  });
}
