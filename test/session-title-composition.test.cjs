const { test } = require('node:test');
const assert = require('node:assert/strict');
const { composeSessionTitles } = require('../src/main/composition/session-titles.cjs');
const { createRequestRegistry } = require('../src/main/application/runtime/requests.cjs');

test('closing title composition cancels its delayed backfill before it can read the closed workspace', async () => {
  let run, cleared;
  const requests = createRequestRegistry({ timers: { setTimeout, clearTimeout } });
  const titles = composeSessionTitles({
    sessions: {},
    sessionSearch: { page: () => assert.fail('database must not be read') },
    settings: { read: () => assert.fail('database must not be read') },
    activeId: () => null,
    providers: {},
    route: {},
    requests,
    changed: () => {},
    schedule: true,
    timers: {
      setTimeout: (work, delay) => {
        run = work;
        assert.equal(delay, 20000);
        return 7;
      },
      clearTimeout: (id) => {
        cleared = id;
      },
    },
    log: () => {},
  });
  titles.close();
  assert.equal(cleared, 7);
  await assert.rejects(titles.title('s1'), { name: 'AbortError' });
  run();
  await new Promise(setImmediate);
  assert.equal(requests.pending(), 0);
});
