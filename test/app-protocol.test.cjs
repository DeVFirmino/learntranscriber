const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const {
  RENDERER_URL,
  registerAppScheme,
  rendererFile,
  handleAppScheme,
} = require('../src/main/infrastructure/electron/app-protocol.cjs');

const root = path.resolve('/opt/app/ui/dist');

test('the renderer URL and the scheme privileges keep the page a secure, standard origin', () => {
  assert.equal(RENDERER_URL, 'app://renderer/index.html');
  let schemes;
  registerAppScheme({ registerSchemesAsPrivileged: (value) => (schemes = value) });
  assert.deepEqual(schemes, [
    { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
  ]);
});

test('app://renderer/ URLs map to files inside the built renderer only', () => {
  assert.equal(rendererFile(root, 'app://renderer/index.html'), path.join(root, 'index.html'));
  assert.equal(rendererFile(root, 'app://renderer/'), path.join(root, 'index.html'));
  assert.equal(
    rendererFile(root, 'app://renderer/assets/index.js?window=main#home'),
    path.join(root, 'assets', 'index.js'),
  );
  assert.equal(
    rendererFile(root, 'app://renderer/fonts/Geist%20Variable.woff2'),
    path.join(root, 'fonts', 'Geist Variable.woff2'),
  );
  assert.equal(rendererFile(root, 'app://renderer/%2e%2e%2f%2e%2e%2fsecret.txt'), null);
  assert.equal(rendererFile(root, 'app://renderer/..%2Fdist-copy/index.html'), null);
  assert.equal(rendererFile(root, 'app://elsewhere/index.html'), null);
  assert.equal(rendererFile(root, 'file:///etc/passwd'), null);
  assert.equal(rendererFile(root, 'app://renderer/%E0%A4%A'), null);
  assert.equal(rendererFile(root, 'not a url'), null);
});

test('the handler serves renderer files and refuses anything else with 404', async () => {
  let handler;
  const fetched = [];
  handleAppScheme({
    protocol: { handle: (scheme, value) => scheme === 'app' && (handler = value) },
    net: { fetch: async (url) => (fetched.push(url), new Response('ok')) },
    root,
  });
  const served = await handler({ url: 'app://renderer/assets/index.css' });
  assert.equal(await served.text(), 'ok');
  assert.deepEqual(fetched, [pathToFileURL(path.join(root, 'assets', 'index.css')).href]);
  const refused = await handler({ url: 'app://renderer/%2e%2e%2fpackage.json' });
  assert.equal(refused.status, 404);
  assert.equal(fetched.length, 1);
});
