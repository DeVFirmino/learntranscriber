const { test } = require('node:test');
const assert = require('node:assert/strict');
const { commandMatchesExecutable } = require('../src/main/domain/providers/process-reap.cjs');

test('a command matches only as the whole line or the executable followed by its own arguments', () => {
  assert.equal(commandMatchesExecutable('/opt/homebrew/bin/llama-server', '/opt/homebrew/bin/llama-server'), true);
  assert.equal(
    commandMatchesExecutable(
      '/opt/homebrew/bin/llama-server -m model.gguf --port 1234',
      '/opt/homebrew/bin/llama-server',
    ),
    true,
  );
  assert.equal(
    commandMatchesExecutable('  /opt/homebrew/bin/llama-server -m model.gguf  ', '/opt/homebrew/bin/llama-server'),
    true,
    'surrounding whitespace from ps output is trimmed',
  );
});

test('a reused pid now running something else, or a mere path prefix, never matches', () => {
  assert.equal(
    commandMatchesExecutable('/opt/homebrew/bin/whisper-server --port 1234', '/opt/homebrew/bin/llama-server'),
    false,
  );
  assert.equal(commandMatchesExecutable('/opt/homebrew/bin/llama-server-old', '/opt/homebrew/bin/llama-server'), false);
  assert.equal(commandMatchesExecutable('', '/opt/homebrew/bin/llama-server'), false);
  assert.equal(commandMatchesExecutable(undefined, '/opt/homebrew/bin/llama-server'), false);
  assert.equal(commandMatchesExecutable(null, '/opt/homebrew/bin/llama-server'), false);
});
