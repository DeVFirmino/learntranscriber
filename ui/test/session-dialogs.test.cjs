const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTsx, elements } = require('./helpers/load-tsx.cjs');

function fixture({ draft = 'New title', rename = async () => {} } = {}) {
  const calls = [];
  const ws = {
    act: async (task) => {
      try {
        await task();
      } catch (error) {
        calls.push(['error', error.message]);
      }
    },
    setDialog: (value) => calls.push(['dialog', value]),
    api: {
      renameSession: async (input) => {
        await rename(input);
        calls.push(['rename', input]);
      },
      deleteSession: async (id) => calls.push(['delete', id]),
      deleteSessions: async (ids) => calls.push(['delete-many', ids]),
    },
  };
  const mocks = {
    react: { ...require('react'), useState: () => [draft, () => {}] },
    'src/workspace.ts': { useWorkspace: () => ws },
    'src/use-t.ts': { useT: () => ({ t: (key) => key }) },
    'src/components/chrome.tsx': { Field: 'Field' },
    'src/components/ui/button.tsx': { Button: 'Button' },
    'src/components/ui/action-button.tsx': { ActionButton: 'Button' },
    'src/components/ui/input.tsx': { Input: 'Input' },
    'src/components/ui/dialog.tsx': new Proxy({}, { get: (_target, name) => name }),
  };
  return { calls, mocks };
}

test('renaming submits the session id and edited title before closing review', async () => {
  const { calls, mocks } = fixture();
  const { SessionRenameDialog } = loadTsx('src/features/dialogs/session-rename-dialog.tsx', mocks);
  const form = SessionRenameDialog({ id: 's1', title: 'Old title' });
  assert.equal(elements(form, 'Button')[1].props.disabled, false);
  form.props.onSubmit({ preventDefault() {} });
  await new Promise(setImmediate);
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    ['rename', { id: 's1', title: 'New title' }],
    ['dialog', null],
  ]);
});

test('rename disables empty and unchanged titles, and cancellation performs no write', () => {
  for (const draft of ['  ', 'Old title']) {
    const { calls, mocks } = fixture({ draft });
    const { SessionRenameDialog } = loadTsx('src/features/dialogs/session-rename-dialog.tsx', mocks);
    const form = SessionRenameDialog({ id: 's1', title: 'Old title' });
    assert.equal(elements(form, 'Button')[1].props.disabled, true);
    elements(form, 'Button')[0].props.onClick();
    assert.deepEqual(calls, [['dialog', null]]);
  }
});

test('deletion waits for confirmation and closes review only after the named session is deleted', async () => {
  const { calls, mocks } = fixture();
  const { SessionDeleteDialog } = loadTsx('src/features/dialogs/session-delete-dialog.tsx', mocks);
  const dialog = SessionDeleteDialog({ ids: ['s1'], title: 'Planning' });
  assert.deepEqual(calls, []);
  elements(dialog, 'Button')[1].props.onClick();
  await new Promise(setImmediate);
  assert.deepEqual(calls, [
    ['delete', 's1'],
    ['dialog', null],
  ]);
});

test('deleting a selection removes every chosen session together, then closes review', async () => {
  const { calls, mocks } = fixture();
  const { SessionDeleteDialog } = loadTsx('src/features/dialogs/session-delete-dialog.tsx', mocks);
  const dialog = SessionDeleteDialog({ ids: ['s1', 's2'] });
  elements(dialog, 'Button')[1].props.onClick();
  await new Promise(setImmediate);
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    ['delete-many', ['s1', 's2']],
    ['dialog', null],
  ]);
});

test('a failed rename keeps the review dialog open', async () => {
  const { calls, mocks } = fixture({
    rename: async () => {
      throw new Error('Session not found.');
    },
  });
  const { SessionRenameDialog } = loadTsx('src/features/dialogs/session-rename-dialog.tsx', mocks);
  SessionRenameDialog({ id: 'missing', title: 'Old title' }).props.onSubmit({ preventDefault() {} });
  await new Promise(setImmediate);
  assert.deepEqual(calls, [['error', 'Session not found.']]);
});
