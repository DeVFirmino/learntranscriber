const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { notarizationBlockers } = require('./signing/notarization-preflight.cjs');
module.exports = async (context) => {
  if (context.electronPlatformName !== 'darwin') return;
  const profile = process.env.LEARNTRANSCRIBER_NOTARY_PROFILE;
  if (!profile) throw new Error('A notarytool keychain profile is required for release signing.');
  const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  const blockers = notarizationBlockers(app);
  if (blockers.length) throw new Error(`Notarization preflight failed:\n${blockers.join('\n')}`);
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'learntranscriber-notarize-'));
  try {
    const archive = path.join(temporary, 'app.zip');
    execFileSync('ditto', ['-c', '-k', '--keepParent', app, archive]);
    // The accepted ZIP submission creates the app ticket; staple that ticket before the DMG is assembled.
    const submission = JSON.parse(
      execFileSync(
        'xcrun',
        ['notarytool', 'submit', archive, '--keychain-profile', profile, '--wait', '--output-format', 'json'],
        { encoding: 'utf8' },
      ),
    );
    if (submission.status !== 'Accepted') throw new Error('Apple did not accept the app notarization.');
    execFileSync('xcrun', ['stapler', 'staple', app], { stdio: 'inherit' });
    execFileSync('xcrun', ['stapler', 'validate', app], { stdio: 'inherit' });
    execFileSync('spctl', ['--assess', '--type', 'execute', app], { stdio: 'inherit' });
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
};
