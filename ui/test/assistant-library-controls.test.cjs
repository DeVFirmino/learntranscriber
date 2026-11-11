const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTsx, elements } = require('./helpers/load-tsx.cjs');
const t = (key) => key;

test('search preserves the controlled query and clearing returns focus to its input', () => {
  const calls = [];
  const { SearchField } = loadTsx('src/components/ui/search-field.tsx', {
    './search-field.css': {},
    './input': { Input: 'Input' },
    './button': { Button: 'Button' },
    react: { useRef: () => ({ current: { focus: () => calls.push('focus') } }) },
  });
  const props = {
    value: 'Math',
    label: 'Find assistants',
    clearLabel: 'Clear search',
    onValueChange: (q) => calls.push(q),
  };
  const view = SearchField(props);
  const input = elements(view, 'Input')[0];
  assert.equal(input.props.type, 'search');
  assert.equal(input.props['aria-label'], 'Find assistants');
  assert.equal(input.props.value, 'Math');
  input.props.onChange({ target: { value: 'English' } });
  const clear = elements(view, 'Button')[0];
  assert.equal(clear.props['aria-label'], 'Clear search');
  clear.props.onClick();
  assert.deepEqual(calls, ['English', '', 'focus']);
  assert.equal(elements(SearchField({ ...props, value: '' }), 'Button').length, 0);
});

test('category filters retain counts and the selected category when the extra categories collapse', () => {
  const calls = [];
  const { AssistantFilters } = loadTsx('src/features/assistants/assistant-filters.tsx', {
    './assistant-library.css': {},
    'src/components/ui/button.tsx': { Button: 'Button' },
    'src/components/ui/search-field.tsx': { SearchField: 'SearchField' },
    'src/components/ui/selection-track.tsx': { SelectionTrack: 'SelectionTrack' },
    'src/use-t.ts': { useT: () => ({ t }) },
    './use-category-label': { useCategoryLabel: () => (name) => name },
    'radix-ui': { ToggleGroup: { Root: 'Group', Item: 'Item' } },
    react: { useState: () => [false, () => {}] },
  });
  const categories = Array.from({ length: 8 }, (_, index) => [`Category ${index}`, index + 1]);
  const view = AssistantFilters({
    query: '',
    category: 'Category 7',
    total: 36,
    categories,
    onQuery: () => {},
    onCategory: (value) => calls.push(value),
  });
  const group = elements(view, 'Group')[0];
  assert.equal(group.props.value, 'Category 7');
  group.props.onValueChange('');
  assert.deepEqual(calls, []);
  group.props.onValueChange('all');
  assert.deepEqual(calls, ['all']);
  const options = elements(view, 'Item');
  assert.equal(options.length, 8);
  assert.equal(options[0].props.children[1].props.children, 36);
  const selected = options.find((option) => option.props.value === 'Category 7');
  assert.equal(selected.props['data-selected'], true);
  assert.equal(selected.props.children[1].props.children, 8);
});

test('instructions disclosure preserves the complete prompt and labels its scroll region', () => {
  let expanded = false;
  const { AssistantPrompt } = loadTsx('src/features/assistants/assistant-prompt.tsx', {
    'src/components/ui/button.tsx': { Button: 'Button' },
    'src/use-t.ts': { useT: () => ({ t }) },
    'radix-ui': { Collapsible: { Root: 'Disclosure', Content: 'Content', Trigger: 'Trigger' } },
    react: {
      useState: () => [
        expanded,
        (value) => {
          expanded = value;
        },
      ],
    },
  });
  const prompt = 'First instruction.\n'.repeat(80);
  const props = { name: 'Planning', prompt };
  const basic = AssistantPrompt(props);
  assert.equal(elements(basic, 'p')[0].props.children, prompt.trim().split('\n').join(' '));
  assert.equal(elements(basic, 'Button')[0].props.children[0], 'assistants.showInstructions');
  basic.props.onOpenChange(true);
  const open = AssistantPrompt(props);
  assert.equal(elements(open, 'p')[0].props.hidden, true);
  const content = elements(open, 'Content')[0];
  const text = elements(content, 'p')[0];
  assert.equal(text.props.children, prompt);
  assert.equal(text.props['aria-label'], 'Planning');
  assert.equal(text.props.tabIndex, 0);
  assert.equal(elements(open, 'Button')[0].props.children[0], 'assistants.hideInstructions');
});

test('the card action and its menu use the same existing assistant-selection callback', async () => {
  const saved = [];
  const dialogs = [];
  const ws = {
    state: { settings: { assistantId: 'other' } },
    act: (task) => task(),
    api: { settings: async (patch) => saved.push(patch) },
    setDialog: (dialog) => dialogs.push(dialog),
  };
  const { AssistantCard } = loadTsx('src/features/assistants/assistant-card.tsx', {
    './assistant-library.css': {},
    'src/components/library-card.tsx': { LibraryCard: 'LibraryCard' },
    'src/components/card-menu.tsx': { CardMenu: 'Menu' },
    'src/components/ui/button.tsx': { Button: 'Button' },
    'src/components/ui/badge.tsx': { Badge: 'Badge' },
    './assistant-prompt': { AssistantPrompt: 'Prompt' },
    './assistant-glyph': { AssistantGlyph: 'Glyph' },
    './use-category-label': { useCategoryLabel: () => (name) => name },
    'src/workspace.ts': { useWorkspace: () => ws },
    'src/use-t.ts': { useT: () => ({ t }) },
  });
  const assistant = { id: 'general', name: 'Planning', category: 'General', prompt: 'Help plan clearly.' };
  const card = AssistantCard({ assistant });
  const actions = card.props.menu.props.items;
  card.props.footer.props.onClick();
  actions.find((item) => item.id === 'use').onSelect();
  actions.find((item) => item.id === 'edit').onSelect();
  await Promise.resolve();
  assert.equal(saved.length, 2);
  assert.ok(saved.every((patch) => patch.assistantId === 'general'));
  assert.equal(dialogs[0].type, 'assistant');
  assert.equal(dialogs[0].id, 'general');
  ws.state.settings.assistantId = 'general';
  const selected = AssistantCard({ assistant });
  assert.equal(selected.props.footer.props.disabled, true);
  assert.equal(selected.props['data-active'], true);
  assert.ok(!selected.props.menu.props.items.some((item) => item.id === 'use'));
  assert.equal(selected.props.children.props.prompt, assistant.prompt);
});
