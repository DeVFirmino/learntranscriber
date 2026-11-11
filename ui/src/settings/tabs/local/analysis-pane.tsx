import { useState } from 'react'
import { draftOf, type Tuning } from '../../local-launch'
import { useSettingsT } from '../../use-settings-t'
import { SettingsIcon } from '../../settings-icon'
import { LlmPerformance } from './llm-performance'
import { LlmServerCard } from './llm-server-card'
import { ModelList } from './model-list'
import { useLocalLaunch } from './use-local-launch'

// The Analysis pane: the local language models, their server and its performance settings. The open section, the
// tuning panel and the typed values survive closing the section; the values follow the model's when those change.
export function AnalysisPane({
  downloading,
  onDownload,
}: {
  downloading: string | null
  onDownload: (id: string) => void
}) {
  const { st } = useSettingsT()
  const launch = useLocalLaunch()
  const [expanded, setExpanded] = useState(false)
  const [tuning, setTuning] = useState(false)
  const [draft, setDraft] = useState<Tuning>(() => draftOf(launch.effective))
  // A new model or new effective settings start a fresh draft, in the same render.
  const draftKey = `${launch.selected?.id ?? ''}|${JSON.stringify(launch.effective)}`
  const [draftFor, setDraftFor] = useState(draftKey)
  if (draftFor !== draftKey) {
    setDraftFor(draftKey)
    setDraft(draftOf(launch.effective))
  }
  return (
    <>
      <div>
        <ModelList kind="llm" downloading={downloading} onDownload={onDownload} />
      </div>
      <LlmServerCard launch={launch} />
      <div className="local-llm-tuning-actions-row">
        <button
          className="glass-button-small local-llm-tuning-toggle"
          onClick={() => setExpanded((value) => !value)}
          disabled={!launch.selected}
        >
          <SettingsIcon name="tune" />
          <span>
            {st(
              expanded
                ? 'settings.api.localModels.hidePerformanceDetails'
                : 'settings.api.localModels.customizePerformance',
            )}
          </span>
        </button>
      </div>
      {expanded && launch.selected ? (
        <LlmPerformance launch={launch} tuning={tuning} onTuning={setTuning} draft={draft} onDraft={setDraft} />
      ) : null}
    </>
  )
}
// keys: settings.api.localModels.customizePerformance settings.api.localModels.hidePerformanceDetails
