const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseSignature, readSignature } = require('../scripts/signing/code-signature.cjs');
test('codesign details map to the facts notarization checks', () => {
  assert.deepEqual(
    parseSignature({
      details: 'CodeDirectory v=20500 size=1 flags=0x10000(runtime) hashes=1\nTimestamp=30 Oct 2026 at 12:00:00',
      entitlements: '',
      kind: 'Mach-O 64-bit executable arm64',
    }),
    { signed: true, executable: true, hardenedRuntime: true, timestamped: true, debuggable: false },
  );
  assert.deepEqual(
    parseSignature({
      details: 'CodeDirectory v=20400 size=1 flags=0x0(none) hashes=1',
      entitlements: '<key>com.apple.security.get-task-allow</key><true/>',
      kind: 'Mach-O 64-bit dynamically linked shared library arm64',
    }),
    { signed: true, executable: false, hardenedRuntime: false, timestamped: false, debuggable: true },
  );
  assert.equal(
    parseSignature({ details: 'App: code object is not signed at all', entitlements: '', kind: '' }).signed,
    false,
  );
});
test(
  'the real codesign output is read from stderr for signed and unsigned binaries',
  { skip: process.platform !== 'darwin' },
  (t) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'code-signature-'));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    const binary = path.join(directory, 'true');
    fs.copyFileSync('/usr/bin/true', binary);
    execFileSync('codesign', ['--remove-signature', binary]);
    assert.equal(readSignature(binary).signed, false);
    execFileSync('codesign', ['--sign', '-', '--options', 'runtime', binary]);
    assert.deepEqual(readSignature(binary), {
      signed: true,
      executable: true,
      hardenedRuntime: true,
      timestamped: false,
      debuggable: false,
    });
  },
);
