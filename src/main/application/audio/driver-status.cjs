// Incoming audio uses ScreenCaptureKit or a process tap, so no virtual driver needs installing or restarting.
// Devices that both play and record can instead be offered as loopback inputs.
function processTapAvailable(platform, systemVersion) {
  if (platform !== 'darwin') return false;
  const [major = 0, minor = 0] = String(systemVersion || '')
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0);
  return major > 14 || (major === 14 && minor >= 2);
}

function driverStatus({ platform, systemVersion, devices = [] }) {
  return {
    required: false,
    installed: false,
    installable: false,
    supported: platform === 'darwin',
    processTapSupported: processTapAvailable(platform, systemVersion),
    reason: 'Incoming audio uses ScreenCaptureKit or a Core Audio process tap; neither needs a virtual audio driver.',
    blocker: 'No owned, signed audio driver ships with this build, so driver installation and removal are not offered.',
    loopbackDevices: devices.filter((device) => device.hasInput).map(({ uid, name }) => ({ uid, name })),
  };
}

module.exports = { driverStatus, processTapAvailable };
