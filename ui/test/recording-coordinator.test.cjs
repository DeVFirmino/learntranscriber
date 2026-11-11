const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/load-ts.cjs');
const { RecordingCoordinator } = loadTs('src/features/workspace/recording-coordinator.ts');

function audio() {
  return {
    recording: false,
    paused: false,
    stopping: false,
    failed: [],
    started: [],
    async start(id) {
      this.started.push(id);
      this.recording = true;
    },
    async stop() {
      this.recording = false;
    },
    async togglePause() {
      this.paused = !this.paused;
    },
  };
}
const state = (over = {}) => ({
  activeSessionId: 's1',
  credentials: { openai: true },
  settings: { transcriptionProvider: 'openai', autoInsights: true },
  ...over,
});

test('listening is refused during dictation and without a usable transcription key', async () => {
  const capture = audio(),
    coordinator = new RecordingCoordinator(capture);
  coordinator.dictating = true;
  await assert.rejects(
    coordinator.toggle(
      async () => {},
      async () => state(),
    ),
    /Stop history voice or dictation/,
  );
  coordinator.dictating = false;
  await assert.rejects(
    coordinator.toggle(
      async () => {},
      async () => state({ credentials: { openai: false } }),
    ),
    /Add an OpenAI key/,
  );
  await assert.rejects(
    coordinator.toggle(
      async () => {},
      async () => state({ activeSessionId: null }),
    ),
    /Start or resume a session before listening/,
  );
  await coordinator.toggle(
    async () => {},
    async () => state(),
  );
  assert.deepEqual([...capture.started], ['s1']);
  await coordinator.toggle(
    async () => {
      throw new Error('not called');
    },
    async () => state(),
  );
  assert.equal(capture.recording, false);
});

test('the reminder runs only while recording in the workspace, and leaving is blocked while audio could be lost', () => {
  const capture = audio(),
    coordinator = new RecordingCoordinator(capture);
  assert.equal(coordinator.timerShouldRun(false, true), false);
  capture.recording = true;
  assert.equal(coordinator.timerShouldRun(false, true), true);
  assert.equal(coordinator.timerShouldRun(true, true), false);
  assert.equal(coordinator.timerShouldRun(false, false), false);
  capture.paused = true;
  assert.equal(coordinator.timerShouldRun(false, true), false);
  assert.equal(coordinator.blocksUnload(), true);
  capture.recording = false;
  assert.equal(coordinator.blocksUnload(), false);
  capture.failed.push({});
  assert.equal(coordinator.blocksUnload(), true);
  capture.failed.length = 0;
  coordinator.dictating = true;
  assert.equal(coordinator.blocksUnload(), true);
});

test('an expired reminder pauses without ending the recording and never resumes an already paused capture', async () => {
  const capture = audio(),
    coordinator = new RecordingCoordinator(capture);
  capture.recording = true;
  capture.stop = async () => assert.fail('the reminder must preserve the recording');
  assert.equal(await coordinator.pauseForReminder(), true);
  assert.equal(capture.paused, true);
  assert.equal(capture.recording, true);
  assert.equal(await coordinator.pauseForReminder(), false);
  assert.equal(capture.paused, true);
  capture.recording = false;
  capture.paused = false;
  assert.equal(await coordinator.pauseForReminder(), false);
});

test('startup stays pending until audio is ready and repeated shortcuts cannot start it twice', async () => {
  const capture = audio(),
    statuses = [];
  let ready;
  capture.start = async () => {
    capture.recording = true;
    await new Promise((resolve) => {
      ready = resolve;
    });
  };
  const coordinator = new RecordingCoordinator(capture);
  const start = coordinator.toggle(
    async () => {},
    async () => state(),
    (value) => statuses.push(value),
  );
  await new Promise(setImmediate);
  assert.equal(coordinator.starting, true);
  assert.deepEqual(statuses, [true]);
  await coordinator.toggle(
    async () => {
      throw new Error('must not start twice');
    },
    async () => state(),
  );
  assert.equal(capture.recording, true, 'the second shortcut cannot stop an incomplete startup');
  ready();
  await start;
  assert.equal(coordinator.starting, false);
  assert.deepEqual(statuses, [true, false]);
});

test('a startup failure clears the pending status and permits a retry', async () => {
  const capture = audio(),
    statuses = [];
  const coordinator = new RecordingCoordinator(capture);
  await assert.rejects(
    coordinator.toggle(
      async () => {
        throw new Error('Permission required');
      },
      async () => state(),
      (value) => statuses.push(value),
    ),
    /Permission required/,
  );
  assert.equal(coordinator.starting, false);
  assert.deepEqual(statuses, [true, false]);
  await coordinator.toggle(
    async () => {},
    async () => state(),
    (value) => statuses.push(value),
  );
  assert.equal(capture.recording, true);
  assert.deepEqual(statuses, [true, false, true, false]);
});
