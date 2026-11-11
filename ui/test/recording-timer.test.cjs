const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  vm = require('node:vm'),
  ts = require('typescript');
function fixture() {
  let now = 0,
    next = 0;
  const tasks = new Map(),
    prompts = [];
  let stops = 0;
  const module = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync('src/audio/recording-timer.ts', 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      module,
      exports: module.exports,
      setTimeout: (fn, delay) => {
        const id = ++next;
        tasks.set(id, { fn, at: now + delay });
        return id;
      },
      clearTimeout: (id) => tasks.delete(id),
    },
  );
  const timer = new module.exports.RecordingTimer(
    (open) => prompts.push(open),
    () => stops++,
  );
  return {
    timer,
    prompts,
    get stops() {
      return stops;
    },
    get pending() {
      return tasks.size;
    },
    advance(ms) {
      const target = now + ms;
      while (true) {
        const due = [...tasks].filter(([, t]) => t.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        now = due[1].at;
        tasks.delete(due[0]);
        due[1].fn();
      }
      now = target;
    },
  };
}
test('the recording reminder waits 30 minutes then pauses after 60 unanswered seconds', () => {
  const f = fixture();
  f.timer.start();
  f.advance(30 * 60000 - 1);
  assert.equal(f.prompts.length, 0);
  f.advance(1);
  assert.equal(f.prompts.at(-1), true);
  f.advance(59999);
  assert.equal(f.stops, 0);
  f.advance(1);
  assert.equal(f.stops, 1);
  assert.equal(f.prompts.at(-1), false);
  assert.equal(f.pending, 0);
});
test('capture updates do not reset the clock, Continue renews it, and stopping cancels all pending work', () => {
  const f = fixture();
  f.timer.start();
  f.advance(20 * 60000);
  f.timer.start();
  f.advance(10 * 60000);
  assert.equal(f.prompts.at(-1), true);
  f.timer.continue();
  f.advance(60000);
  assert.equal(f.stops, 0);
  f.advance(29 * 60000);
  assert.equal(f.prompts.at(-1), true);
  f.timer.stop();
  f.advance(60000);
  assert.equal(f.stops, 0);
  assert.equal(f.pending, 0);
});

test('the workspace timer is wired to pause capture, preserve its session, and report only a successful pause', async () => {
  const { loadTsx } = require('./helpers/load-tsx.cjs');
  const messages = [];
  let expired;
  class Capture {
    recording = true;
    paused = false;
    stopping = false;
    failed = [];
    async togglePause() {
      this.paused = !this.paused;
    }
    async stop() {
      assert.fail('the timer must not stop recording');
    }
  }
  const { useWorkspaceAudio } = loadTsx('src/features/workspace/use-workspace-audio.ts', {
    react: {
      ...require('react'),
      useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
      useEffect: () => {},
    },
    sonner: { toast: { message: (value) => messages.push(value), error: assert.fail } },
    'src/audio/aec3-module.ts': { echoReduction: {} },
    'src/audio/capture.ts': { AudioCapture: Capture },
    'src/audio/recording-timer.ts': {
      RecordingTimer: class {
        constructor(_prompt, pause) {
          expired = pause;
        }
      },
    },
    'src/features/workspace/use-recording.tsx': { useRecording: () => {} },
    'src/format.ts': { errorMessage: String, localizeMessage: (value) => value },
  });
  const recording = useWorkspaceAudio({}, { overlay: false, echoReductionEnabled: false, sessionTimer: true });
  expired();
  await new Promise(setImmediate);
  assert.equal(recording.audio.recording, true);
  assert.equal(recording.audio.paused, true);
  assert.equal(messages.length, 1);
  expired();
  await new Promise(setImmediate);
  assert.equal(recording.audio.paused, true);
  assert.equal(messages.length, 1);
});
