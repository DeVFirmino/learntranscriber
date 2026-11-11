import type { SessionDetail } from '@/bridge/types/sessions'
import type { PublicState } from '@/bridge/types/state'

export interface SessionApi {
  session(id: string): Promise<SessionDetail>
  createSession(title: string): Promise<SessionDetail>
  state(): Promise<PublicState>
}

export interface SessionHooks {
  state(): PublicState | null
  show(session: SessionDetail): void
  setState(state: PublicState): void
  clearImages(): void
  navigate(): void
}

// Which session the workspace shows. A selected past session wins over the live one; a refresh that
// finishes after a newer one started is dropped, so a slow response never replaces fresher content.
export class SessionController {
  selectedId: string | null = null
  private version = 0
  private api: SessionApi
  private hooks: SessionHooks

  constructor(api: SessionApi, hooks: SessionHooks) {
    this.api = api
    this.hooks = hooks
  }

  async refresh() {
    const id = this.selectedId || this.hooks.state()?.activeSessionId
    if (!id) return
    const version = ++this.version
    const value = await this.api.session(id)
    if (version !== this.version) return
    this.selectedId = id
    this.hooks.show(value)
  }

  // Switching to another session drops screenshots attached to the previous one.
  async open(id: string, navigate = true) {
    if (this.selectedId !== id) this.hooks.clearImages()
    this.selectedId = id
    await this.refresh()
    if (navigate) this.hooks.navigate()
  }

  // Opens the live session, or starts one when none is live.
  async ensure(title: () => string, navigate = true) {
    const current = this.hooks.state()
    if (!current) throw new Error('The workspace is still opening.')
    if (current.activeSessionId) {
      await this.open(current.activeSessionId, navigate)
      return
    }
    const created = await this.api.createSession(title())
    this.hooks.clearImages()
    this.selectedId = created.id
    this.hooks.show(created)
    this.hooks.setState(await this.api.state())
    if (navigate) this.hooks.navigate()
  }
}
