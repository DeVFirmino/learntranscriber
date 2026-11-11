const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const load = (file, context = {}) => {
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const moduleValue = { exports: {} };
  vm.runInNewContext(source, {
    ...context,
    module: moduleValue,
    exports: moduleValue.exports,
    require: (name) => load('src/' + name.replace(/^@\//, '') + '.ts', context),
  });
  return moduleValue.exports;
};
const { normalizeLanguage, translate, resolveLanguage } = load('src/i18n.ts');
const catalogs = {
  en: load('src/locales/en.ts').en,
  es: load('src/locales/es.ts').es,
  'pt-BR': load('src/locales/pt-BR.ts').ptBR,
};

test('locales normalize case-insensitively, then by base language, then to English', () => {
  assert.equal(normalizeLanguage('PT-br'), 'pt-BR');
  assert.equal(normalizeLanguage('pt-PT'), 'pt-BR');
  assert.equal(normalizeLanguage('es_MX'), 'es');
  assert.equal(normalizeLanguage('fr-FR'), 'en');
  assert.equal(normalizeLanguage(''), 'en');
  assert.equal(resolveLanguage('', 'pt-PT'), 'pt-BR');
  assert.equal(resolveLanguage('es', 'pt-BR'), 'es');
});
test('translation falls back from locale to English to the key and interpolates variables', () => {
  assert.equal(translate('pt-BR', 'nav.sessions'), 'Sessões');
  assert.equal(translate('es', 'notch.position', { current: 2, total: 5 }), '2 / 5');
  assert.equal(translate('pt-BR', 'unknown.key'), 'unknown.key');
  assert.equal(translate('en', 'overlay.current', {}), 'Current: ');
  assert.equal(translate('pt-BR', 'overlay.current', { assistant: 'Estudo' }), 'Atual: Estudo');
});
test('every translated entry exists in English and keeps its placeholders', () => {
  for (const locale of ['es', 'pt-BR'])
    for (const key of Object.keys(catalogs[locale])) assert.ok(key in catalogs.en, `${locale} has unknown key ${key}`);
  for (const key of Object.keys(catalogs.en)) {
    const english = translate('en', key);
    assert.notEqual(english, key, `${key} is missing in English`);
    const placeholders = (value) =>
      [...value.matchAll(/\{\{(\w+)\}\}/g)]
        .map((match) => match[1])
        .sort()
        .join();
    for (const locale of ['es', 'pt-BR'])
      assert.equal(placeholders(translate(locale, key)), placeholders(english), `${locale} ${key}`);
  }
});

test('every interface message exists in Spanish and Portuguese', () => {
  for (const locale of ['es', 'pt-BR'])
    assert.deepEqual(
      Object.keys(catalogs.en).filter((key) => !(key in catalogs[locale])),
      [],
      locale,
    );
});
test('known English errors from the main process are shown in the interface language', () => {
  const document = { documentElement: { lang: 'pt-BR' } };
  const { localizeMessage, errorMessage } = load('src/format.ts', { document, globalThis: { document } });
  assert.equal(localizeMessage('End the active session first.'), 'Encerre a sessão ativa primeiro.');
  assert.equal(localizeMessage('Session not found.'), 'Sessão não encontrada.');
  assert.equal(errorMessage('not an error'), 'Algo deu errado.');
  assert.equal(localizeMessage('Unlisted provider detail'), 'Unlisted provider detail');
  document.documentElement.lang = 'en';
  assert.equal(localizeMessage('End the active session first.'), 'End the active session first.');
});

test('session and assistant ranges interpolate without stray braces', () => {
  for (const language of ['en', 'pt-BR', 'es']) {
    const result = translate(language, 'sessions.showing', { from: 1, to: 3, total: 3 });
    assert.doesNotMatch(result, /[{}]/);
    assert.match(result, /1.*3.*3/);
  }
});
