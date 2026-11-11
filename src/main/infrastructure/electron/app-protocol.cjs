// The renderer is served from app://renderer/ instead of file://, as Electron's security checklist recommends
// (https://www.electronjs.org/docs/latest/tutorial/security#18-avoid-usage-of-the-file-protocol-and-prefer-usage-of-custom-protocols):
// only files inside the built renderer folder can be read, and the page gets no file-protocol privileges.
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const SCHEME = 'app';
const HOST = 'renderer';
const RENDERER_URL = `${SCHEME}://${HOST}/index.html`;

// Must run before the app is ready. A standard, secure scheme keeps relative URLs, the media and fetch APIs and the
// microphone working as they did on file://; stream lets packaged video play.
function registerAppScheme(protocol) {
  protocol.registerSchemesAsPrivileged([
    { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
  ]);
}

// The file an app://renderer/ URL names inside root, or null for another host or a path that leaves root.
function rendererFile(root, requestUrl) {
  let url;
  try {
    url = new URL(requestUrl);
  } catch {
    return null;
  }
  if (url.protocol !== `${SCHEME}:` || url.host !== HOST) return null;
  let relative;
  try {
    relative = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  } catch {
    return null;
  }
  const file = path.resolve(root, relative || 'index.html');
  return file.startsWith(root + path.sep) ? file : null;
}

function handleAppScheme({ protocol, net, root }) {
  protocol.handle(SCHEME, (request) => {
    const file = rendererFile(root, request.url);
    return file ? net.fetch(pathToFileURL(file).href) : new Response('Not found', { status: 404 });
  });
}

module.exports = { RENDERER_URL, registerAppScheme, rendererFile, handleAppScheme };
