// Errors reach the user as a toast; the two setup errors add a button that opens AI sources.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const fs = require('node:fs'),
  vm = require('node:vm'),
  ts = require('typescript');

function reporter(api) {
  const toasts = [];
  const source = ts.transpileModule(fs.readFileSync('src/features/workspace/error-reporter.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const imports = {
    '../model-setup': loadTs('src/features/model-setup.ts', { Error }),
    './error-toast': { showError: (message, action) => toasts.push({ message, options: { action } }) },
    '@/format': { errorMessage: (error) => (error instanceof Error ? error.message : String(error)) },
    '@/i18n': { documentT: (key) => key },
  };
  const moduleValue = { exports: {} };
  vm.runInNewContext(source, {
    module: moduleValue,
    exports: moduleValue.exports,
    require: (name) => imports[name],
    Error,
    Set,
    Promise,
  });
  return { toasts, errors: moduleValue.exports.errorReporter(api) };
}

test('a setup error offers to open AI sources; other errors are only shown', async () => {
  let opened = 0;
  const { toasts, errors } = reporter({ openAiSources: async () => opened++ });
  errors.report(new Error('Add a provider key in AI sources.'));
  errors.report(new Error('The provider is unavailable.'));
  assert.equal(toasts[0].options.action.label, 'setup.connectAI');
  toasts[0].options.action.onClick();
  assert.equal(opened, 1);
  assert.equal(toasts[1].message, 'The provider is unavailable.');
  assert.equal(toasts[1].options.action, undefined);
});

test('act reports what the action throws instead of throwing it', async () => {
  const { toasts, errors } = reporter({ openAiSources: async () => true });
  await errors.act(async () => {
    throw new Error('Choose an assistant model in AI sources.');
  });
  await errors.act(async () => {});
  assert.equal(toasts.length, 1);
  assert.ok(toasts[0].options.action);
});

test('AI sources that cannot open are reported too', async () => {
  const { toasts, errors } = reporter({
    openAiSources: async () => {
      throw new Error('The window is closed.');
    },
  });
  errors.openAiSources();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(toasts[0].message, 'The window is closed.');
});

test('ChatGPT account access and missing-key errors include a working connection action', async () => {
  let opened = 0;
  const { toasts, errors } = reporter({
    openAiSources: async () => {
      opened++;
    },
  });
  for (const message of ['Continue with ChatGPT in AI sources first.', 'Add a provider key first.']) {
    errors.report(new Error(message));
    const action = toasts.at(-1).options.action;
    assert.equal(action.label, 'setup.connectAI');
    action.onClick();
  }
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(opened, 2);
});

test('the shared readiness guard produces an actionable setup error', async () => {
  const { requireModelReady } = loadTs('src/features/model-setup.ts', { Error });
  const { toasts, errors } = reporter({ openAiSources: async () => true });
  await errors.act(async () => requireModelReady(null));
  assert.equal(toasts.length, 1);
  assert.equal(toasts[0].options.action.label, 'setup.connectAI');
  assert.match(toasts[0].message, /Connect an AI provider/);
});
