// Apple Speech languages are named in the interface language with their region's flag, listed by name, and the
// recognition language reads as ready, downloadable, downloading or unsupported.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const locales = loadTs('src/settings/tabs/apple-speech/speech-locales.ts', { Intl, String });
const plain = (value) => JSON.parse(JSON.stringify(value));

const assets = {
  assetManagementAvailable: true,
  reservedLocales: ['pt_BR', 'en_US'],
  installedLocales: ['en_US', 'pt_BR'],
  maximumReservedLocales: 4,
  locales: ['en_US', 'pt_BR', 'fr_FR', 'de_DE'],
};

test('a locale is named in the interface language and flagged by its region', () => {
  assert.deepEqual(plain(locales.describeLocale('pt_BR', 'en')), {
    identifier: 'pt_BR',
    displayName: 'Brazilian Portuguese',
    flag: '🇧🇷',
  });
  assert.equal(locales.describeLocale('fr_FR', 'pt-BR').displayName, 'francês (França)');
  assert.equal(locales.describeLocale('zz', 'en').flag, '');
  assert.equal(locales.sameLocale('pt_BR', 'PT-br'), true);
});

test('only languages not yet installed can be downloaded, and both lists go by name', () => {
  assert.deepEqual(plain(locales.downloadableLocales(assets, 'en').map((item) => item.identifier)), ['fr_FR', 'de_DE']);
  assert.deepEqual(plain(locales.reservedLocales(assets, 'en').map((item) => item.identifier)), ['en_US', 'pt_BR']);
  assert.deepEqual(plain(locales.downloadableLocales(null, 'en')), []);
});

test('the recognition language reads as downloading, ready, downloadable or unsupported', () => {
  const capable = (locale) => ({ locale, supportsOnDeviceRecognition: true, authorization: 'authorized' });
  assert.equal(locales.speechStatus(capable('en_US'), assets, 'fr_FR'), 'downloading');
  assert.equal(locales.speechStatus(capable('en-US'), assets, ''), 'ready');
  assert.equal(locales.speechStatus(capable('fr_FR'), assets, ''), 'downloadable');
  assert.equal(locales.speechStatus(capable('ja_JP'), assets, ''), 'unsupported');
  assert.equal(
    locales.speechStatus({ ...capable('en_US'), supportsOnDeviceRecognition: false }, assets, ''),
    'unsupported',
  );
  assert.equal(locales.statusTone('ready'), 'ready');
  assert.equal(locales.statusTone('downloading'), 'warn');
  assert.equal(locales.statusTone('unsupported'), 'neutral');
  assert.equal(locales.STATUS_KEYS.downloadable, 'settings.api.localModels.appleSpeechAssetDownloadable');
});
