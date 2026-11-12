const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseRuntimeVersion } = require('../src/main/domain/providers/runtime-version.cjs');

test('a recognised version line is kept without its label, from either stream', () => {
  assert.equal(
    parseRuntimeVersion('version: 0.7.0 (build 11669, commit 620d2225c)\nbuilt with AppleClang for Darwin arm64\n'),
    '0.7.0 (build 11669, commit 620d2225c)',
  );
  assert.equal(parseRuntimeVersion('version:    0.6.1'), '0.6.1');
  assert.equal(parseRuntimeVersion('noise before\nVERSION: 1.0.0\nnoise after'), '1.0.0');
});

test('backend init lines, a usage error and empty or missing output report unknown rather than a guess', () => {
  const whisperOutput = [
    'load_backend: loaded BLAS backend from /opt/homebrew/Cellar/ggml/0.27.0/libexec/libggml-blas.so',
    'ggml_metal_device_init: tensor API disabled for pre-M5 and pre-A19 devices',
    'error: unknown argument: --version',
    '',
    'usage: whisper-server [options]',
    '',
    'options:',
    '  -h,        --help                      [default] show this help message and exit',
  ].join('\n');
  assert.equal(parseRuntimeVersion(whisperOutput), 'unknown');
  assert.equal(parseRuntimeVersion(''), 'unknown');
  assert.equal(parseRuntimeVersion(undefined), 'unknown');
  assert.equal(parseRuntimeVersion('version:\n'), 'unknown', 'a label with nothing after it is not a version');
});
