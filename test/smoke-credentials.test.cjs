const test = require('node:test');
const assert = require('node:assert/strict');
const { runCredentialSmoke } = require('../src/main/smoke-credentials.cjs');

function fixture({ plaintext = false, fail = false } = {}) {
  let value = null;
  const commands = [],
    checks = [],
    progress = [];
  return {
    commands,
    checks,
    progress,
    deps: {
      async evaluate(command) {
        commands.push(command);
        if (command === 'new Promise(resolve=>setTimeout(resolve,100))') return;
        if (command === 'window.__credentialProbe')
          return fail ? { error: 'Credential write failed' } : { saved: true };
        if (command === 'window.workspace.state()') return { credentials: { openai: true } };
        if (command.includes("key:''")) {
          value = null;
          return;
        }
        value = Buffer.from(plaintext ? 'native-credential-probe-fixture' : 'encrypted fixture');
        return true;
      },
      stored: () => value,
      read: async () => 'native-credential-probe-fixture',
      check(name, condition) {
        assert.ok(condition, name);
        checks.push(name);
      },
      progress: (message) => progress.push(message),
    },
  };
}
test('credential smoke reaches the actual save IPC, checks encryption and availability, then removes its fixture', async () => {
  const f = fixture();
  await runCredentialSmoke(f.deps);
  assert.equal(f.commands.length, 6);
  assert.ok(f.commands[0].includes('window.workspace.saveKey'));
  assert.equal(f.checks.length, 6);
  assert.deepEqual(f.progress, ['Credential fixture write started', 'Credential fixture write resolved']);
});
test('a plaintext storage regression is detected and still removes the probe credential', async () => {
  const f = fixture({ plaintext: true });
  await assert.rejects(runCredentialSmoke(f.deps), /does not contain/);
  assert.ok(f.commands.at(-1).includes("key:''"));
});
test('a rejected write is preserved as a failure while cleanup is attempted', async () => {
  const f = fixture({ fail: true });
  await assert.rejects(runCredentialSmoke(f.deps), /Credential write failed/);
  assert.ok(f.commands.at(-1).includes("key:''"));
  assert.deepEqual(f.progress, ['Credential fixture write started']);
});
