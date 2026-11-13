import type { WorkspaceApi } from '@/bridge/types/api'
import { permissionGrants, permissionNeeds, type PermissionNeed } from '../onboarding/listening-choices'
import { liveTranscript } from './insight-loop'

export interface ManualInsightHooks {
  api: Pick<WorkspaceApi, 'state' | 'session' | 'speechCapabilities'>
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
      // Capture always opens the microphone, including installations that predate onboarding's audio choice.
      const needs = permissionNeeds({
        ...state.settings,
        onboardingAudioSource: state.settings.onboardingAudioSource || 'microphone',
      })
      const speech = needs.includes('speech') ? await hooks.api.speechCapabilities().catch(() => null) : null
      if ((await hooks.api.state()).activeSessionId !== sessionId) return
      const grants = permissionGrants(state, speech?.authorization)
      // A failed capability read is not proof that macOS denied speech recognition.
      if (!speech) grants.speech = true
      hooks.notice(needs.find((need) => !grants[need]))
    } finally {
      this.running = false
    }
  }
}
