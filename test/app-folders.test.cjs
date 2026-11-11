const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createAppFolders } = require('../src/main/infrastructure/electron/app-folders.cjs');

function setup(t, failure = '') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'app-folders-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const paths = { userData: path.join(root, 'Application Support'), logs: path.join(root, 'Logs') };
  const opened = [];
  const folders = createAppFolders({
    app: { getPath: (name) => paths[name] },
    shell: { openPath: async (target) => (opened.push(target), failure) },
  });
  return { folders, paths, opened };
}

test('a logs folder that no error has created yet is made private and opened', async (t) => {
  const { folders, paths, opened } = setup(t);
  assert.equal(await folders.reveal('logs'), true);
  assert.deepEqual(opened, [paths.logs]);
  assert.equal(fs.statSync(paths.logs).mode & 0o777, 0o700);
  await folders.reveal('data');
  assert.deepEqual(opened, [paths.logs, paths.userData]);
});

test('a folder Finder cannot open reports it', async (t) => {
  const { folders } = setup(t, 'Failed to open path');
  await assert.rejects(folders.reveal('data'), /Could not open the folder in Finder/);
});
