const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { ScrollFollowing } = loadTs('src/features/scroll-following.ts');
test('content growth does not disable following before resize observation can catch up', () => {
  const follow = new ScrollFollowing();
  assert.equal(follow.scrolled({ scrollHeight: 500, clientHeight: 200, scrollTop: 300 }), true);
  assert.equal(follow.scrolled({ scrollHeight: 900, clientHeight: 200, scrollTop: 300 }), true);
});
test('explicit reader scrolling pauses following and reaching the bottom resumes it', () => {
  const follow = new ScrollFollowing();
  follow.pause();
  assert.equal(follow.scrolled({ scrollHeight: 900, clientHeight: 200, scrollTop: 100 }), false);
  assert.equal(follow.scrolled({ scrollHeight: 1200, clientHeight: 200, scrollTop: 100 }), false);
  assert.equal(follow.scrolled({ scrollHeight: 1200, clientHeight: 200, scrollTop: 1000 }), true);
});
