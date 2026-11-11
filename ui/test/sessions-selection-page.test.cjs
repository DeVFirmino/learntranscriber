const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTsx, elements } = require('./helpers/load-tsx.cjs');

test('a paged-away selection stays cleared on return and single selection confirmation names the session', () => {
  const values = [],
    dialogs = [];
  let cursor = 0,
    dirty = false;
  const ws = { state: {}, query: '', setDialog: (dialog) => dialogs.push(dialog) };
  const page = { page: 0, rows: [{ id: 's1', title: 'Planning' }], includeTranscript: false };
  const { Sessions: renderSessions } = loadTsx('src/pages/sessions.tsx', {
    react: {
      ...require('react'),
      useState: (initial) => {
        const index = cursor++;
        if (!(index in values)) values[index] = typeof initial === 'function' ? initial() : initial;
        return [
          values[index],
          (next) => {
            values[index] = typeof next === 'function' ? next(values[index]) : next;
            dirty = true;
          },
        ];
      },
    },
    'src/workspace.ts': { useWorkspace: () => ws },
    'src/use-t.ts': { useT: () => ({ t: (key) => key }) },
    'src/features/sessions/use-sessions-page.ts': { useSessionsPage: () => page },
    'src/features/sessions/session-groups.tsx': { SessionGroups: 'Groups' },
    'src/features/sessions/pagination-footer.tsx': { PaginationFooter: 'Pager' },
    'src/components/ui/button.tsx': { Button: 'Button' },
    'src/components/ui/action-button.tsx': { ActionButton: 'Button' },
    'src/components/ui/search-field.tsx': { SearchField: 'SearchField' },
    'src/components/ui/checkbox.tsx': { Checkbox: 'Checkbox' },
    'src/components/chrome.tsx': new Proxy({}, { get: (_target, key) => key }),
  });
  const render = () => {
    let result;
    do {
      cursor = 0;
      dirty = false;
      result = renderSessions();
    } while (dirty);
    return result;
  };
  elements(render(), 'Button')
    .find((button) => button.props.children === 'sessions.select')
    .props.onClick();
  elements(render(), 'Groups')[0].props.onToggle('s1');
  const selected = render();
  elements(selected, 'Button')
    .find((button) => button.props.variant === 'destructive')
    .props.onClick();
  assert.deepEqual(JSON.parse(JSON.stringify(dialogs)), [{ type: 'session-delete', ids: ['s1'], title: 'Planning' }]);
  page.page = 1;
  page.rows = [{ id: 's2' }];
  render();
  page.page = 0;
  page.rows = [{ id: 's1' }];
  assert.equal(elements(render(), 'Groups')[0].props.selected.size, 0);
});
