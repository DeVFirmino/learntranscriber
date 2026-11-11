export class RecordingTimer {
  private reminder: ReturnType<typeof setTimeout> | null = null
  private pause: ReturnType<typeof setTimeout> | null = null
  private active = false
  private prompt: (open: boolean) => void
  private pauseRecording: () => void
  private interval: number
  private grace: number
  constructor(prompt: (open: boolean) => void, pauseRecording: () => void, interval = 30 * 60000, grace = 60000) {
    this.prompt = prompt
    this.pauseRecording = pauseRecording
    this.interval = interval
    this.grace = grace
  }
  start() {
    if (this.active) return
    this.active = true
    this.schedule()
  }
  private schedule() {
    this.reminder = setTimeout(() => {
      if (!this.active) return
      this.prompt(true)
      this.pause = setTimeout(() => {
        if (!this.active) return
        this.stop()
        this.pauseRecording()
      }, this.grace)
    }, this.interval)
  }
  continue() {
    if (!this.active) return
    if (this.pause) clearTimeout(this.pause)
    if (this.reminder) clearTimeout(this.reminder)
    this.prompt(false)
    this.schedule()
  }
  stop() {
    this.active = false
    if (this.pause) clearTimeout(this.pause)
    if (this.reminder) clearTimeout(this.reminder)
    this.reminder = this.pause = null
    this.prompt(false)
  }
}
