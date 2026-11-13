const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, readFileSync, rmSync, existsSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { createActiveSession } = require('../src/main/application/runtime/active-session.cjs');
const { createContextCapture } = require('../src/main/application/context/capture.cjs');
const { createSessionExport } = require('../src/main/application/sessions/export.cjs');
const { writeFileAtomic } = require('../src/main/infrastructure/files/atomic-file.cjs');
const { electronDesktop } = require('../src/main/infrastructure/electron/desktop.cjs');

test('screen text is discarded when the live session changes during OCR', async () => {
  const active = createActiveSession();
  const capture = createContextCapture({
    active,
    screenshot: async () => ({ toPNG: () => Buffer.from('png') }),
    nativeContext: {
      ocr: async () => {
        active.set('s2');
        return { text: 'Hello' };
      },
    },
  });
  await assert.rejects(capture.ocr(), /Start a session before extracting screen text/);
  active.set('s1');
  await assert.rejects(capture.ocr(), /The session changed during text extraction/);
});

test('selected text is tagged with the session that was live', async () => {
  const active = createActiveSession();
  active.set('s1');
  const capture = createContextCapture({
    active,
    screenshot: async () => {
      throw new Error('unused');
    },
    nativeContext: { selection: async () => ({ text: 'Selected' }) },
  });
  assert.deepEqual(await capture.selection(), { text: 'Selected', sessionId: 's1' });
});

test('an unavailable display fails OCR before any text is read', async () => {
  const active = createActiveSession();
  active.set('s1');
  let read = false;
  const capture = createContextCapture({
    active,
    screenshot: async () => {
      throw new Error('Screen capture unavailable.');
    },
    nativeContext: {
      ocr: async () => {
        read = true;
      },
    },
  });
  await assert.rejects(capture.ocr(), /Screen capture unavailable/);
  assert.equal(read, false);
});

test('a cancelled export writes nothing; a chosen path receives the Markdown', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'learntranscriber-export-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const file = join(directory, 'session.md');
  let choice = null;
  const asked = [];
  const exporter = createSessionExport({
    build: (id, format) => (format === 'srt' ? '1\n00:00:00,000 --> 00:00:01,000\nHi\n' : '# Planning\n'),
    destination: {
      choose: async (_owner, format) => {
        asked.push(format);
        return choice;
      },
      write: writeFileAtomic,
    },
  });
  assert.equal(await exporter.export({}, 's1', 'markdown'), false);
  assert.equal(existsSync(file), false);
  choice = file;
  assert.equal(await exporter.export({}, 's1', 'markdown'), true);
  assert.equal(readFileSync(file, 'utf8'), '# Planning\n');
  assert.equal(await exporter.export({}, 's1', 'srt'), true);
  assert.match(readFileSync(file, 'utf8'), /^1\n00:00:00,000 --> /);
  assert.deepEqual(asked, ['markdown', 'markdown', 'srt']);
});

test('only safe response links are opened and oversized copies are refused', async () => {
  const opened = [];
  const desktop = electronDesktop({
    clipboard: { writeText: () => {} },
    shell: { openExternal: async (url) => opened.push(url) },
    systemPreferences: {},
  });
  assert.throws(() => desktop.openLink('javascript:alert(1)'));
  await desktop.openLink('https://example.com/docs');
  assert.deepEqual(opened, ['https://example.com/docs']);
  assert.throws(() => desktop.writeResponse('x'.repeat(100001)), /Code is too large to copy/);
});

test('the Permissions tab opens only the known privacy panes and asks only for the microphone', async () => {
  const opened = [];
  const asked = [];
  const desktop = electronDesktop({
    clipboard: {},
    shell: { openExternal: async (url) => opened.push(url) },
    systemPreferences: { askForMediaAccess: async (media) => asked.push(media) && true },
    app: { getVersion: () => '9.9.9' },
  });
  await desktop.openPrivacyPane('microphone');
  await desktop.openPrivacyPane('speech');
  assert.deepEqual(opened, [
    'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone',
    'x-apple.systempreferences:com.apple.preference.security?Privacy_SpeechRecognition',
  ]);
  assert.throws(() => desktop.openPrivacyPane('camera'), /Unknown privacy setting/);
  assert.throws(() => desktop.openPrivacyPane('https://example.com'), /Unknown privacy setting/);
  assert.equal(await desktop.requestMicrophone(), true);
  assert.deepEqual(asked, ['microphone']);
  assert.equal(desktop.version(), '9.9.9');
});

test('desktop clipboard awaits text reads and write completion and propagates failures', async () => {
  let complete;
  const desktop = electronDesktop({
    clipboard: {
      readText: async () => 'x'.repeat(100001),
      writeText: () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    },
  });
  assert.equal((await desktop.readText()).length, 100000);
  let finished = false;
  const copying = desktop.writeResponse('Code').then((value) => {
    finished = true;
    return value;
  });
  await new Promise(setImmediate);
  assert.equal(finished, false);
  complete();
  assert.equal(await copying, true);
  const failing = electronDesktop({
    clipboard: {
      writeText: async () => {
        throw new Error('Clipboard denied');
      },
    },
  });
  await assert.rejects(failing.writeResponse('Code'), /Clipboard denied/);
});

test('desktop clipboard reads PNG items through the asynchronous Electron clipboard API', async () => {
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2NofoAAAAASUVORK5CYII=';
  const desktop = electronDesktop({
    clipboard: {
      read: async () => [
        {
          types: ['image/png'],
          getType: async (type) => {
            assert.equal(type, 'image/png');
            return new Blob([Buffer.from(png, 'base64')]);
          },
        },
      ],
    },
  });
  assert.equal(await desktop.readImage(), `data:image/png;base64,${png}`);
  const empty = electronDesktop({ clipboard: { read: async () => [{ types: ['text/plain'] }] } });
  assert.equal(await empty.readImage(), null);
});

test('oversized clipboard images are refused before their bytes are read', async () => {
  const desktop = electronDesktop({
    clipboard: {
      read: async () => [
        {
          types: ['image/png'],
          getType: async () => ({ size: 8000001, arrayBuffer: () => assert.fail('Must not read oversized data') }),
        },
      ],
    },
  });
  await assert.rejects(desktop.readImage(), /8 MB/);
});

test('JPEG clipboard data is converted to the PNG screenshot contract', async () => {
  const jpeg = Buffer.from('fixture-jpeg');
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2NofoAAAAASUVORK5CYII=',
    'base64',
  );
  const desktop = electronDesktop({
    clipboard: { read: async () => [{ types: ['image/jpeg'], getType: async () => new Blob([jpeg]) }] },
    nativeImage: {
      createFromBuffer: (bytes) => {
        assert.deepEqual(bytes, jpeg);
        return { toPNG: () => png };
      },
    },
  });
  assert.equal(await desktop.readImage(), `data:image/png;base64,${png.toString('base64')}`);
});

test('permission status is read without prompting for accessibility', () => {
  const prompts = [];
  const desktop = electronDesktop({
    systemPreferences: {
      getMediaAccessStatus: (media) => (media === 'microphone' ? 'granted' : 'denied'),
      isTrustedAccessibilityClient: (prompt) => prompts.push(prompt) && false,
    },
  });
  assert.deepEqual(desktop.permissions(), { microphone: 'granted', screen: 'denied', accessibility: false });
  assert.deepEqual(prompts, [false]);
});
