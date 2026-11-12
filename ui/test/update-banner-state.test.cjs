const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { updateBannerView } = loadTs('src/features/home/update-banner-state.ts');

// The module runs in its own vm context, so its return values carry that context's Object prototype; spreading
// into a plain object here, as home-overview.test.cjs does, keeps deepEqual comparing structure, not realms.
const view = (status) => ({ ...updateBannerView(status) });

test('the banner is hidden while loading and when nothing is available', () => {
  assert.deepEqual(view(null), { visible: false, version: '', phase: 'idle', percent: null, error: null });
  assert.deepEqual(view({ available: false }), {
    visible: false,
    version: '',
    phase: 'idle',
    percent: null,
    error: null,
  });
});

test('the banner shows the parsed version when one is available', () => {
  assert.deepEqual(view({ available: true, version: '1.5.0', tagName: 'v1.5.0' }), {
    visible: true,
    version: '1.5.0',
    phase: 'idle',
    percent: null,
    error: null,
  });
});

test('a missing version falls back to the tag with its v-prefix dropped, case-insensitively', () => {
  assert.deepEqual(view({ available: true, tagName: 'v2.0.0' }), {
    visible: true,
    version: '2.0.0',
    phase: 'idle',
    percent: null,
    error: null,
  });
  assert.deepEqual(view({ available: true, tagName: 'V2.0.0' }), {
    visible: true,
    version: '2.0.0',
    phase: 'idle',
    percent: null,
    error: null,
  });
});

test('with neither a version nor a tag, the banner still shows but with an empty version', () => {
  assert.deepEqual(view({ available: true }), {
    visible: true,
    version: '',
    phase: 'idle',
    percent: null,
    error: null,
  });
});

test('a running download shows its whole percent, clamped, or none while the size is unknown', () => {
  const at = (progress) =>
    view({ available: true, version: '2.0.0', download: { phase: 'downloading', progress, error: null } });
  assert.equal(at(0.426).percent, 43);
  assert.equal(at(1.4).percent, 100);
  assert.equal(at(null).percent, null);
  assert.equal(at(0.5).phase, 'downloading');
});

test('only a failed download carries its message', () => {
  const failed = view({ available: true, download: { phase: 'failed', progress: null, error: 'Checksum mismatch.' } });
  assert.equal(failed.error, 'Checksum mismatch.');
  assert.equal(view({ available: true, download: { phase: 'ready', progress: 1, error: 'stale' } }).error, null);
});
