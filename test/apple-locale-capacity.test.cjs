const { test } = require('node:test');
const assert = require('node:assert/strict');
const { NativeSpeech } = require('../src/main/infrastructure/native/speech-helper.cjs');
const { openDatabase } = require('../src/main/infrastructure/sqlite/database.cjs');
const { createRepositories } = require('../src/main/infrastructure/sqlite/repositories.cjs');
const { appleLocaleUsage } = require('../src/main/infrastructure/sqlite/apple-locale-usage.cjs');

function fixture({
  reserved = ['en-US', 'pt-BR'],
  usage = { 'en-us': 20, 'pt-br': 10 },
  failRelease = false,
  failInstall = false,
} = {}) {
  const calls = [];
  let maximum = 0,
    active = 0;
  const native = new NativeSpeech(
    '/fixture/helper',
    async (_file, args, { signal }) => {
      signal?.throwIfAborted();
      active++;
      maximum = Math.max(active, maximum);
      calls.push(args);
      await new Promise(setImmediate);
      try {
        if (args.includes('--list-assets'))
          return {
            stdout: JSON.stringify({
              assetManagementAvailable: true,
              maximumReservedLocales: 2,
              reservedLocales: [...reserved],
            }),
          };
        const locale = args[args.indexOf('--locale') + 1];
        if (args.includes('--release-locale')) {
          if (failRelease) return { stdout: '{"released":false}' };
          reserved.splice(reserved.indexOf(locale), 1);
          return { stdout: JSON.stringify({ released: true, locale }) };
        }
        if (failInstall) return { stdout: '{"error":"Fixture download failed"}' };
        if (!reserved.includes(locale)) reserved.push(locale);
        return { stdout: JSON.stringify({ locale, assetStatus: 'installed' }) };
      } finally {
        active--;
      }
    },
    {
      usage: {
        read: () => usage,
        write: (value) => {
          usage = value;
        },
      },
      now: () => 100,
    },
  );
  return { native, calls, reserved, usage: () => usage, maximum: () => maximum };
}

test('full Apple capacity evicts the least recently used reservation and records only the successful replacement', async () => {
  const f = fixture();
  const result = await f.native.manageLocale('install', 'es-ES');
  assert.equal(result.replacedLocale, 'pt-BR');
  assert.deepEqual(f.reserved, ['en-US', 'es-ES']);
  assert.deepEqual(f.usage(), { 'en-us': 20, 'es-es': 100 });
  assert.deepEqual(
    f.calls.map((args) => args[0]),
    ['--list-assets', '--release-locale', '--install-locale'],
  );
});

test('already reserved language and preserve-existing capacity failures never release another language', async () => {
  const f = fixture();
  assert.equal((await f.native.manageLocale('install', 'en_US')).replacedLocale, null);
  await assert.rejects(f.native.manageLocale('install', 'es-ES', { preserveExisting: true }), {
    code: 'apple-speech-locale-capacity',
  });
  assert.equal(
    f.calls.some((args) => args.includes('--release-locale')),
    false,
  );
});

test('unknown usage is older than tracked usage and equivalent locale names share one operation', async () => {
  const f = fixture({ usage: { en_US: 20 } });
  const first = f.native.manageLocale('install', 'es-ES');
  const second = f.native.manageLocale('install', 'ES_es');
  assert.equal(first, second);
  assert.throws(
    () => f.native.manageLocale('install', 'es-ES', { preserveExisting: true }),
    /different capacity policy/,
  );
  await first;
  assert.equal(f.calls.filter((args) => args.includes('--install-locale')).length, 1);
  assert.equal(f.calls.find((args) => args.includes('--release-locale'))[2], 'pt-BR');
});

test('different concurrent installs recheck capacity serially and leave no duplicate reservation', async () => {
  const f = fixture();
  await Promise.all([f.native.manageLocale('install', 'es-ES'), f.native.manageLocale('install', 'fr-FR')]);
  assert.deepEqual(f.reserved, ['es-ES', 'fr-FR']);
  assert.equal(f.maximum(), 1);
  assert.deepEqual(
    f.calls.filter((args) => args[0] === '--release-locale').map((args) => args[2]),
    ['pt-BR', 'en-US'],
  );
});

test('failed release prevents download and keeps usage; failed download never records the new locale', async () => {
  const release = fixture({ failRelease: true });
  await assert.rejects(release.native.manageLocale('install', 'es-ES'), /Unable to release/);
  assert.equal(
    release.calls.some((args) => args[0] === '--install-locale'),
    false,
  );
  assert.deepEqual(release.usage(), { 'en-us': 20, 'pt-br': 10 });
  const install = fixture({ failInstall: true });
  await assert.rejects(install.native.manageLocale('install', 'es-ES'), {
    message: 'Fixture download failed',
    replacedLocale: 'pt-BR',
  });
  assert.deepEqual(install.usage(), { 'en-us': 20 });
});

test('cancellation before the queued capacity check does not release any reservation', async () => {
  const f = fixture();
  const first = f.native.manageLocale('install', 'es-ES');
  const second = f.native.manageLocale('install', 'fr-FR');
  f.native.cancelAssetOperation();
  const results = await Promise.allSettled([first, second]);
  assert.deepEqual(
    results.map((value) => value.reason.name),
    ['AbortError', 'AbortError'],
  );
  assert.equal(f.calls.length, 0);
  assert.deepEqual(f.reserved, ['en-US', 'pt-BR']);
  await f.native.manageLocale('install', 'es-ES');
});

test('locale usage persists separately from user settings and malformed historical values are ignored', () => {
  const repos = createRepositories(openDatabase(':memory:'));
  try {
    const first = appleLocaleUsage(repos.db);
    first.write({ en_US: 50, 'pt-BR': 30, bad: -1 });
    const second = appleLocaleUsage(repos.db);
    assert.deepEqual(second.read(), { 'en-us': 50, 'pt-br': 30 });
    assert.equal(Object.hasOwn(repos.settings.read(), 'apple_speech_locale_usage'), false);
    repos.db.prepare('UPDATE settings SET value=? WHERE key=?').run('{bad', 'apple_speech_locale_usage');
    assert.deepEqual(second.read(), {});
  } finally {
    repos.db.close();
  }
});
