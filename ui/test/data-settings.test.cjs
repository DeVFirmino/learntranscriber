const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTsx, elements } = require('./helpers/load-tsx.cjs');
const shell = new Proxy({}, { get: (_target, name) => name });
const stats = { totalSessions: 62, totalMessages: 178, totalTranscriptions: 242, activeSessions: 61 };

function fixture(file, name, ws, props = {}) {
  const values = [],
    refs = [],
    effects = [];
  let cursor = 0,
    ref = 0,
    mounted = false;
  const mocks = {
    react: {
      useState: (initial) => {
        const index = cursor++;
        if (!(index in values)) values[index] = initial;
        return [
          values[index],
          (value) => {
            values[index] = value;
          },
        ];
      },
      useRef: (initial) => {
        const index = ref++;
        return (refs[index] ||= { current: initial });
      },
      useCallback: (fn) => fn,
      useEffect: (fn) => {
        if (!mounted) effects.push(fn);
      },
    },
    'src/components/ui/button.tsx': { Button: 'Button' },
    'src/components/ui/card.tsx': shell,
    'src/components/ui/badge.tsx': { Badge: 'Badge' },
    'src/settings/tabs/profile/clear-history.tsx': { ClearHistory: 'ClearHistory' },
    'src/settings/tabs/profile/clear-confirmation.tsx': { ClearConfirmation: 'ClearConfirmation' },
    'src/settings/tabs/profile/app-folders.tsx': { AppFolders: 'AppFolders' },
    './data-settings.css': {},
    'src/use-t.ts': { useT: () => ({ t: (key, vars) => (vars ? `${key}:${JSON.stringify(vars)}` : key) }) },
    'src/workspace.ts': { useWorkspace: () => ws },
  };
  delete mocks[file];
  const module = loadTsx(file, mocks);
  const render = () => {
    cursor = 0;
    ref = 0;
    const tree = module[name](props);
    mounted = true;
    return tree;
  };
  return { render, effects };
}

test('Data shows lifetime sessions/messages/transcript counts and a loading dash, never unfinished sessions as live processes', async () => {
  const f = fixture('src/settings/tabs/profile/data-management.tsx', 'DataManagement', {
    api: { historyStats: async () => stats },
  });
  let tree = f.render();
  assert.deepEqual(
    elements(tree, 'dd').map((e) => e.props.children),
    ['—', '—', '—'],
  );
  for (const effect of f.effects) effect();
  await new Promise(setImmediate);
  tree = f.render();
  assert.deepEqual(
    elements(tree, 'dd').map((e) => e.props.children),
    [62, 178, 242],
  );
  assert.deepEqual(
    elements(tree, 'dt').map((e) => e.props.children),
    ['data.sessions', 'data.messages', 'data.transcripts'],
  );
  assert.equal(elements(tree, 'AppFolders').length, 1);
});

test('failed stats loading offers retry and disables destructive access until counts load', async () => {
  let failed = true;
  const f = fixture('src/settings/tabs/profile/data-management.tsx', 'DataManagement', {
    api: {
      historyStats: async () => {
        if (failed) throw Error('Read failed');
        return stats;
      },
    },
  });
  f.render();
  for (const effect of f.effects) effect();
  await new Promise(setImmediate);
  assert.equal(elements(f.render(), 'ClearHistory')[0].props.unavailable, true);
  failed = false;
  elements(f.render(), 'Button')[0].props.onClick();
  await new Promise(setImmediate);
  assert.equal(elements(f.render(), 'ClearHistory')[0].props.unavailable, false);
});

test('opening and cancelling confirmation never clears history; confirming clears once and refreshes', async () => {
  let clears = 0,
    refreshes = 0,
    release;
  const f = fixture(
    'src/settings/tabs/profile/clear-history.tsx',
    'ClearHistory',
    {
      state: { activeSessionId: null },
      api: {
        clearHistory: () => {
          clears++;
          return new Promise((resolve) => {
            release = resolve;
          });
        },
      },
    },
    {
      stats,
      unavailable: false,
      onCleared: async () => {
        refreshes++;
      },
    },
  );
  elements(f.render(), 'Button')[0].props.onClick();
  assert.equal(clears, 0);
  assert.equal(elements(f.render(), 'ClearConfirmation')[0].props.open, true);
  elements(f.render(), 'ClearConfirmation')[0].props.onOpenChange(false);
  assert.equal(clears, 0);
  elements(f.render(), 'Button')[0].props.onClick();
  const confirm = elements(f.render(), 'ClearConfirmation')[0].props.onClear;
  confirm();
  confirm();
  assert.equal(clears, 1);
  release();
  await new Promise(setImmediate);
  assert.equal(refreshes, 1);
  assert.match(JSON.stringify(f.render()), /data.deleted/);
});

test('active sessions and empty history disable deletion; backend refusal leaves counts and retry available', async () => {
  const ws = {
    state: { activeSessionId: 'active' },
    api: {
      clearHistory: async () => {
        throw Error('Refused');
      },
    },
  };
  const props = { stats, unavailable: false, onCleared: async () => assert.fail('Do not refresh failed clears') };
  const f = fixture('src/settings/tabs/profile/clear-history.tsx', 'ClearHistory', ws, props);
  assert.equal(elements(f.render(), 'Button')[0].props.disabled, true);
  ws.state.activeSessionId = null;
  elements(f.render(), 'ClearConfirmation')[0].props.onClear();
  await new Promise(setImmediate);
  assert.match(JSON.stringify(f.render()), /data.deleteFailed/);
  assert.equal(elements(f.render(), 'Button')[0].props.disabled, false);
  props.stats = { ...stats, totalSessions: 0 };
  assert.equal(elements(f.render(), 'Button')[0].props.disabled, true);
});

test('folder actions use only their named destinations and expose failures', async () => {
  const calls = [];
  const f = fixture('src/settings/tabs/profile/app-folders.tsx', 'AppFolders', {
    api: {
      revealAppFolder: async (name) => {
        calls.push(name);
        if (name === 'logs') throw Error('Unavailable');
      },
    },
  });
  for (const button of elements(f.render(), 'Button')) button.props.onClick();
  await new Promise(setImmediate);
  assert.deepEqual(calls, ['data', 'logs']);
  assert.match(JSON.stringify(f.render()), /data.folderFailed/);
});

test('confirmation is a modal alert with plain interpolated counts and separate cancel/action controls', () => {
  let cleared = 0,
    restored = 0;
  const { ClearConfirmation } = loadTsx('src/settings/tabs/profile/clear-confirmation.tsx', {
    'radix-ui': { AlertDialog: shell },
    'src/components/ui/button.tsx': { Button: 'Button' },
    'src/use-t.ts': { useT: () => ({ t: (key, vars) => (vars ? `${key}:${JSON.stringify(vars)}` : key) }) },
  });
  const tree = ClearConfirmation({
    open: true,
    onOpenChange() {},
    onRestoreFocus: () => {
      restored++;
    },
    stats,
    disabled: false,
    onClear: () => {
      cleared++;
    },
  });
  assert.equal(elements(tree, 'Root')[0].props.open, true);
  assert.equal(elements(tree, 'Cancel').length, 1);
  assert.equal(elements(tree, 'Action').length, 1);
  const description = elements(tree, 'Description')[0].props;
  assert.equal(description.dangerouslySetInnerHTML, undefined);
  assert.match(description.children, /"transcripts":242/);
  assert.equal(cleared, 0);
  let prevented = false;
  elements(tree, 'Content')[0].props.onCloseAutoFocus({
    preventDefault: () => {
      prevented = true;
    },
  });
  assert.equal(prevented, true);
  assert.equal(restored, 1);
});
