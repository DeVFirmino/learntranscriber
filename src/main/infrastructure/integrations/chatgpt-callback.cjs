const { createServer } = require('node:http');
const { timingSafeEqual } = require('node:crypto');
const { issuedClient } = require('../../domain/integrations/chatgpt-identity.cjs');

function matchState(left, right) {
  const a = Buffer.from(left || ''),
    b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Listens on loopback for the ChatGPT authorization redirect of `flow`. `callback` resolves with the code and the
 * issued client id; a decline or an incomplete registration rejects it through `flow.reject`, which `flow` gets here.
 */
async function listenForAuthorization({ flow, clientId }) {
  let resolveCallback;
  const callback = new Promise((resolve, reject) => {
    resolveCallback = resolve;
    flow.reject = reject;
  });
  callback.catch(() => {});
  const server = createServer((req, res) => {
    res.setHeader('cache-control', 'no-store');
    res.setHeader('content-type', 'text/plain');
    res.setHeader('referrer-policy', 'no-referrer');
    res.setHeader('content-security-policy', "default-src 'none'; frame-ancestors 'none'");
    const url = new URL(req.url, 'http://127.0.0.1');
    if (req.method !== 'GET' || url.pathname !== '/auth/callback') {
      res.writeHead(404);
      res.end();
      return;
    }
    if (!matchState(url.searchParams.get('state'), flow.state)) {
      res.writeHead(400);
      res.end('Invalid authorization state.');
      return;
    }
    if (url.searchParams.has('error')) {
      res.end('Authorization was declined.');
      flow.reject(new Error('ChatGPT authorization was declined.'));
      return;
    }
    const code = url.searchParams.get('code'),
      issued = issuedClient(url.searchParams.get('client_id'), clientId);
    if (!code || code.length > 10000 || !issued) {
      res.writeHead(400);
      res.end('Incomplete registration.');
      flow.reject(new Error('ChatGPT registration was incomplete. Start sign-in again.'));
      return;
    }
    res.end('Authorization received. Return to LearnTranscriber.');
    resolveCallback({ code, issued });
  });
  const close = async () => {
    server.closeAllConnections();
    await new Promise((resolve) => (server.listening ? server.close(resolve) : resolve()));
  };
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
  } catch (error) {
    await close();
    throw error;
  }
  return { callback, close, redirect: `http://127.0.0.1:${server.address().port}/auth/callback` };
}

module.exports = { listenForAuthorization };
