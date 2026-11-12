import { microphoneFailure } from './microphone-failure'

// The streams this window records. A stream that arrives after its recording was stopped or replaced is stopped by
// ensureCurrent, which also ends that startup.
type EnsureCurrent = (stream?: MediaStream) => void

export async function openMicrophone(microphoneId: string, ensureCurrent: EnsureCurrent) {
  const mic = await navigator.mediaDevices
    .getUserMedia({
      audio: {
        deviceId: microphoneId === 'default' ? undefined : { exact: microphoneId },
        echoCancellation: true,
        noiseSuppression: true,
      },
      video: false,
    })
    .catch((error: unknown) => {
      throw microphoneFailure(error)
    })
  ensureCurrent(mic)
  return mic
}

// A loopback input (a virtual device that also plays) carries the other side; it is recorded as is.
export async function openLoopback(deviceId: string | undefined, ensureCurrent: EnsureCurrent) {
  if (!deviceId) throw new Error('Choose the input device that carries incoming audio.')
  const loopback = await navigator.mediaDevices.getUserMedia({
    audio: { deviceId: { exact: deviceId }, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    video: false,
  })
  ensureCurrent(loopback)
  return loopback
}

// Screen sharing with its audio; the small video track is required by the browser and not recorded.
export async function openDisplayAudio(ensureCurrent: EnsureCurrent) {
  const display = await navigator.mediaDevices.getDisplayMedia({
    audio: true,
    video: { width: 320, height: 180, frameRate: 1 },
  })
  ensureCurrent(display)
  if (!display.getAudioTracks().length) {
    display.getTracks().forEach((track) => track.stop())
    throw new Error('System audio was not provided. Check macOS system-audio permission or disable incoming audio.')
  }
  return { stream: new MediaStream(display.getAudioTracks()), owner: display }
}
