const { test } = require('node:test');
const assert = require('node:assert/strict');
const { githubReleases } = require('../src/main/infrastructure/integrations/github-releases.cjs');

function fakeFetch(respond) {
  const calls = [];
  return {
    calls,
    fetch: async (url, init) => {
      calls.push({ url: String(url), init });
      return respond();
    },
  };
}

test('a successful response is normalized from the GitHub release fields, with the right request shape', async () => {
  const { fetch, calls } = fakeFetch(() => ({
    ok: true,
    status: 200,
    json: async () => ({
      tag_name: 'v1.4.0',
      html_url: 'https://github.com/x/y/releases/tag/v1.4.0',
      draft: false,
      prerelease: false,
    }),
  }));
  const release = await githubReleases({ fetch }).latestRelease('DeVFirmino/learntranscriber', {
    userAgent: 'LearnTranscriber/1.0.0',
  });
  assert.deepEqual(release, {
    tagName: 'v1.4.0',
    draft: false,
    prerelease: false,
  });
  assert.equal(calls[0].url, 'https://api.github.com/repos/DeVFirmino/learntranscriber/releases/latest');
  assert.equal(calls[0].init.headers.Accept, 'application/vnd.github+json');
  assert.equal(calls[0].init.headers['User-Agent'], 'LearnTranscriber/1.0.0');
});

test('a non-OK response throws with its status, covering the private-repo 404 and a rate-limit 403', async () => {
  for (const status of [403, 404, 500]) {
    const { fetch } = fakeFetch(() => ({ ok: false, status, json: async () => ({}) }));
    await assert.rejects(
      githubReleases({ fetch }).latestRelease('DeVFirmino/learntranscriber', { userAgent: 'x' }),
      new RegExp(String(status)),
    );
  }
});

test('a body that is not valid JSON propagates as a rejection', async () => {
  const { fetch } = fakeFetch(() => ({
    ok: true,
    status: 200,
    json: async () => {
      throw new SyntaxError('Unexpected token');
    },
  }));
  await assert.rejects(githubReleases({ fetch }).latestRelease('DeVFirmino/learntranscriber', { userAgent: 'x' }));
});

test('a network failure from fetch itself propagates as a rejection', async () => {
  const fetch = async () => {
    throw new Error('getaddrinfo ENOTFOUND');
  };
  await assert.rejects(githubReleases({ fetch }).latestRelease('DeVFirmino/learntranscriber', { userAgent: 'x' }));
});

test('a release missing its flags normalizes draft and prerelease to false', async () => {
  const { fetch } = fakeFetch(() => ({
    ok: true,
    status: 200,
    json: async () => ({ tag_name: 'v1.0.0', html_url: 'https://x' }),
  }));
  const release = await githubReleases({ fetch }).latestRelease('o/r', { userAgent: 'x' });
  assert.equal(release.draft, false);
  assert.equal(release.prerelease, false);
});
