import { helperRoute, type AudioSettings } from './capture-settings'
import { openDisplayAudio, openLoopback } from './incoming-streams'
import type { NativeSystemAudio } from './native-system-audio'
import type { RecordingSources } from './recording-sources'

type EnsureCurrent = (stream?: MediaStream) => void

// The recording's incoming (THEY) side: the native helper's routes, a loopback input, or the shared screen's audio.
export class IncomingSource {
  private parts: {
    native: NativeSystemAudio
    sources: RecordingSources
    add: (stream: MediaStream, owner: MediaStream) => void
    follow: (settings: AudioSettings) => void
    sessionId: () => string
    notify: (message?: string) => void
  }

  constructor(parts: IncomingSource['parts']) {
    this.parts = parts
  }

  // Starts the source the settings name, if any, for the current session.
  async start(settings: AudioSettings, ensureCurrent: EnsureCurrent) {
    if (!settings.systemAudio) return
    if (helperRoute(settings.systemAudioSource)) await this.parts.native.start(this.parts.sessionId(), ensureCurrent)
    else if (settings.systemAudioSource === 'input-device') {
      const loopback = await openLoopback(settings.systemAudioInputDevice, ensureCurrent)
      this.parts.add(loopback, loopback)
    } else {
      const display = await openDisplayAudio(ensureCurrent)
      this.parts.add(display.stream, display.owner)
    }
  }

  // The source drains into the same session and is released.
  async stop() {
    await this.parts.native.release()
    await this.parts.sources.detachIncoming()
  }

  // Choosing another incoming source during a recording applies it at once: the old source's
  // audio is drained into the same session, the new source starts, and the microphone and the recording continue.
  // A source that cannot start leaves the recording on the microphone alone.
  async replace(settings: AudioSettings, ensureCurrent: EnsureCurrent, current: () => boolean) {
    await this.stop()
    this.parts.follow(settings)
    try {
      await this.start(settings, ensureCurrent)
    } catch (error) {
      if (!current()) return
      await this.stop()
      const message = error instanceof Error ? error.message : 'Incoming audio could not start.'
      this.parts.notify(message)
      return message
    }
    this.parts.notify()
    return ''
  }
}
