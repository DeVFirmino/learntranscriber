const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { updateBannerView } = loadTs('src/features/home/update-banner-state.ts');

// The module runs in its own vm context, so its return values carry that context's Object prototype; spreading
// into a plain object here, as home-overview.test.cjs does, keeps deepEqual comparing structure, not realms.
const view = (status) => ({ ...updateBannerView(status) });

test('the banner is hidden while loading and when nothing is available', () => {
  assert.deepEqual(view(null), { visible: false, version: '' });
  assert.deepEqual(view({ available: false }), { visible: false, version: '' });
});

test('the banner shows the parsed version when one is available', () => {
  assert.deepEqual(view({ available: true, version: '1.5.0', tagName: 'v1.5.0', url: 'https://x' }), {
    visible: true,
    version: '1.5.0',
  });
});

test('a missing version falls back to the tag with its v-prefix dropped, case-insensitively', () => {
  assert.deepEqual(view({ available: true, tagName: 'v2.0.0', url: 'https://x' }), {
    visible: true,
    version: '2.0.0',
  });
  assert.deepEqual(view({ available: true, tagName: 'V2.0.0', url: 'https://x' }), {
    visible: true,
    version: '2.0.0',
  });
});

test('with neither a version nor a tag, the banner still shows but with an empty version', () => {
  assert.deepEqual(view({ available: true }), { visible: true, version: '' });
});
