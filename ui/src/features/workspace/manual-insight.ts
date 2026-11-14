import type { WorkspaceApi } from '@/bridge/types/api'
import type { PermissionNeed } from '../onboarding/listening-choices'
import { missingListeningPermission } from './listening-permission'
import { liveTranscript } from './insight-loop'

export interface ManualInsightHooks {
  api: Pick<WorkspaceApi, 'state' | 'session' | 'speechCapabilities' | 'systemAudioStatus'>
  generating(): boolean
  captions(): Record<string, string>
  insight(transcript: string | undefined): Promise<unknown>
  notice(permission?: PermissionNeed): void
}

// The panel owns manual analysis. Check the current listening session, not the workspace's selected history item;
// silence needs guidance, not a provider request. The guard also covers the asynchronous permission/session reads.
export class ManualInsight {
  private running = false

  async run(hooks: ManualInsightHooks): Promise<void> {
    if (this.running || hooks.generating()) return
    this.running = true
    try {
      const sessionId = (await hooks.api.state()).activeSessionId
      if (!sessionId) return
      const session = await hooks.api.session(sessionId)
      const transcript = liveTranscript(hooks.captions())
      const heard =
        transcript.trim() || session.entries.some((entry) => entry.kind === 'transcript' && entry.content.trim())
      // A session may end or change while its entries are loading.
      const state = await hooks.api.state()
      if (state.activeSessionId !== sessionId) return
      if (heard) {
        if (!hooks.generating()) await hooks.insight(transcript || undefined)
        return
      }
      const permission = await missingListeningPermission(hooks.api, state)
      if ((await hooks.api.state()).activeSessionId !== sessionId) return
      hooks.notice(permission)
    } finally {
      this.running = false
    }
  }
}
