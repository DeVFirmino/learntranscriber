import { useFollowUpSuggestions } from './follow-ups/use-follow-up-suggestions'
import { FollowUpCompact } from './follow-ups/follow-up-compact'
import { FollowUpPanel } from './follow-ups/follow-up-panel'

// Suggested follow-up questions for an answer. `auto` generates them as soon as the answer is complete and `compact`
// shows them as a Follow-up box with the questions inline.
export function FollowUpSuggestions({
  sessionId,
  entryId,
  responseLength,
  auto = false,
  compact = false,
  limit = 5,
}: {
  sessionId: string
  entryId: string
  responseLength: number
  auto?: boolean
  compact?: boolean
  limit?: number
}) {
  const state = useFollowUpSuggestions({ sessionId, entryId, responseLength, auto, limit })
  if (compact)
    return (
      <FollowUpCompact
        suggestions={state.suggestions}
        busy={state.busy}
        loaded={state.loaded}
        responseLength={responseLength}
        onStop={state.stop}
        error={state.error}
        disabled={state.disabled}
        requesting={state.requesting}
        onGenerate={state.generate}
        onSelect={state.select}
      />
    )
  return (
    <FollowUpPanel
      suggestions={state.suggestions}
      busy={state.busy}
      loaded={state.loaded}
      error={state.error}
      disabled={state.disabled}
      requesting={state.requesting}
      responseLength={responseLength}
      onGenerate={state.generate}
      onStop={state.stop}
      onSelect={state.select}
    />
  )
}
