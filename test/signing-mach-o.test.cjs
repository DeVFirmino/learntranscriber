const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { machOFiles } = require('../scripts/signing/mach-o.cjs');
test('only Mach-O binaries are listed, each once, regardless of extension or framework links', (t) => {
  const app = fs.mkdtempSync(path.join(os.tmpdir(), 'mach-o-'));
  t.after(() => fs.rmSync(app, { recursive: true, force: true }));
  const write = (name, bytes) => {
    fs.mkdirSync(path.dirname(path.join(app, name)), { recursive: true });
    fs.writeFileSync(path.join(app, name), Buffer.from(bytes));
  };
  write('Contents/MacOS/App', [0xcf, 0xfa, 0xed, 0xfe, 0x0c]);
  write('Contents/Frameworks/Core.framework/Versions/A/Core', [0xca, 0xfe, 0xba, 0xbe, 0x00]);
  write('Contents/Resources/app.asar', [0x04, 0x00, 0x00, 0x00]);
  write('Contents/Resources/empty', []);
  fs.symlinkSync('A', path.join(app, 'Contents/Frameworks/Core.framework/Versions/Current'));
  assert.deepEqual(
    machOFiles(app)
      .map((file) => path.relative(app, file))
      .sort(),
    ['Contents/Frameworks/Core.framework/Versions/A/Core', 'Contents/MacOS/App'],
  );
});
