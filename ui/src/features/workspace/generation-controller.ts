import { requireModelReady } from '../model-setup'
import type { PublicState } from '@/bridge/types/state'
import type { PendingImage } from './attachments'

export interface ReviewedText {
  text: string
  sessionId: string
  label: string
}

export interface GenerationHooks {
  generate(input: Record<string, unknown>): Promise<unknown>
  capture(): Promise<string>
  state(): PublicState | null
  overlay(): boolean
  selectedId(): string | null
  shownSessionId(): string | undefined
  reviewedText(): ReviewedText | null
  clearReviewedText(sent: ReviewedText): void
  images(): PendingImage[]
  replaceImages(images: PendingImage[]): void
  attach(image: string): void
  began(requestId: string, question: string): void
  ended(): void
  refresh(): Promise<void>
  ensureSession(): Promise<void>
  attachedNotice(): void
  newId(): string
}

// What is asked about a screenshot sent without a question of its own.
export const SCREENSHOT_QUESTION = 'Analyze this screenshot and give a concise useful answer.'
// One answer at a time per window. A chat question waits for a screenshot still being captured, sends the
// queued screenshots and reviewed text, and removes them only after the request succeeds.
export class GenerationController {
  requestId: string | null = null
  private capturing: Promise<string> | null = null
  private hooks: GenerationHooks

  constructor(hooks: GenerationHooks) {
    this.hooks = hooks
  }

  async run(
    mode: string,
    question?: string,
    image?: string,
    liveTranscript?: string,
    // What started a live insight, by its trigger name; Command-D is "manual".
    trigger?: string,
  ): Promise<string> {
    const hooks = this.hooks
    if (mode === 'chat' && this.capturing) await this.capturing
    if (this.requestId) throw new Error('Wait for the current response, or cancel it.')
    if (mode === 'chat') requireModelReady(hooks.state())
    // Automatic insights belong to the session that is listening, whatever the main window shows.
    const sessionId =
      hooks.overlay() || mode === 'insight'
        ? hooks.state()?.activeSessionId
        : hooks.selectedId() || hooks.shownSessionId()
    if (!sessionId) throw new Error('Start or resume a session in the workspace.')
    const id = hooks.newId()
    this.requestId = id
    hooks.began(id, mode === 'chat' ? question || '' : '')
    const pending = hooks.reviewedText()
    const reviewed = mode === 'chat' && pending?.sessionId === sessionId ? pending : null
    const queued = mode === 'chat' && !image ? hooks.images().slice() : []
    try {
      const text = await hooks.generate({
        requestId: id,
        sessionId,
        mode,
        question,
        ...(mode === 'insight' && liveTranscript?.trim() ? { liveTranscript } : {}),
        ...(mode === 'insight' && trigger ? { trigger } : {}),
        ...(mode === 'chat' && (image || queued.length)
          ? { images: image ? [image] : queued.map((item) => item.data) }
          : {}),
        ...(reviewed?.text ? { context: reviewed.text } : {}),
      })
      if (mode === 'chat') {
        if (queued.length) {
          const sent = new Set(queued.map((item) => item.id))
          hooks.replaceImages(hooks.images().filter((item) => !sent.has(item.id)))
        }
        if (reviewed) hooks.clearReviewedText(reviewed)
      }
      return typeof text === 'string' ? text : ''
    } finally {
      if (this.requestId === id) this.requestId = null
      hooks.ended()
      if (!hooks.overlay()) await hooks.refresh()
    }
  }

  // A second capture request joins the one in progress. Quick mode asks about the screenshot at once;
  // otherwise it is attached to the session that was open when capture started.
  async capture() {
    const hooks = this.hooks
    if (this.capturing) {
      await this.capturing
      return
    }
    if (this.requestId) throw new Error('Wait for the current response, or cancel it.')
    if (hooks.state()?.settings.quickScreenshot) requireModelReady(hooks.state())
    let quick = false
    const capture = (async () => {
      await hooks.ensureSession()
      const target = hooks.selectedId()
      quick = Boolean(hooks.state()?.settings.quickScreenshot)
      if (quick) requireModelReady(hooks.state())
      const image = await hooks.capture()
      if (hooks.selectedId() !== target)
        throw new Error('The session changed during screen capture. Capture again in this session.')
      if (!quick) hooks.attach(image)
      return image
    })()
    this.capturing = capture
    let image: string
    try {
      image = await capture
    } finally {
      if (this.capturing === capture) this.capturing = null
    }
    if (quick) await this.run('chat', SCREENSHOT_QUESTION, image)
    else hooks.attachedNotice()
  }
}
