const hooked = new WeakSet();
// A window's leases end with it: when it is destroyed, its renderer crashes, or its main frame navigates away.
function releaseWithOwner(sender, leases) {
  if (hooked.has(sender)) return;
  hooked.add(sender);
  const owner = sender.id;
  const release = () => void leases.releaseOwner(owner);
  sender.once('destroyed', release);
  sender.on('render-process-gone', release);
  sender.on('did-start-navigation', (_event, _url, sameDocument, mainFrame) => {
    if (mainFrame && !sameDocument) release();
  });
}

function registerAudio(handle, { systemAudio, leases, driver, live, segments, speech }) {
  handle('audio:native-status', () => systemAudio.status());
  // The recording path's single lease, kept for callers that start and stop without naming one.
  handle('audio:native-start', (event, id) => {
    releaseWithOwner(event.sender, leases);
    return leases.acquire(event.sender.id, 'recording', id);
  });
  handle('audio:native-stop', (event) => leases.release(event.sender.id, 'recording'));
  handle('audio:output-acquire', (event, lease, id) => {
    if (typeof id !== 'string' || !id) throw new Error('Choose a session for incoming audio.');
    releaseWithOwner(event.sender, leases);
    return leases.acquire(event.sender.id, lease, id);
  });
  handle('audio:output-release', (event, lease) => leases.release(event.sender.id, lease));
  handle('audio:output-abandon', (event, lease) => leases.release(event.sender.id, lease, { stopIfLast: false }));
  handle('audio:output-switch', () => leases.restart());
  handle('audio:output-devices', () => systemAudio.devices());
  handle('audio:output-status', async () => {
    const devices = await systemAudio.devices().catch(() => ({ devices: [], defaultOutputUID: null }));
    return { ...leases.status(), ...devices, driver: driver(devices.devices) };
  });
  handle('live:start', (event, id) => live.start(event.sender.id, id));
  handle('live:push', (event, input) => live.push(event.sender.id, input));
  handle('live:stop', (event) => live.stop(event.sender.id));
  handle('live:set-paused', (event, paused) => live.setPaused(event.sender.id, paused));
  handle('live:update-language', (event, input) => live.updateLanguage(event.sender.id, input));
  handle('audio:transcribe', (_event, input) => segments.transcribe(input));
  handle('speech:assets', () => speech.assets());
  handle('speech:manage-locale', (_event, input) => speech.manageLocale(input));
  handle('speech:cancel-assets', () => speech.cancel());
  handle('speech:capabilities', () => speech.capabilities());
}
module.exports = { registerAudio };
