import { useWorkspace } from '@/workspace'
import type { Settings } from '@/bridge/types/settings'
import { Toggle } from '../controls'
import { useSettingsT } from '../use-settings-t'
import { SessionNotesCard } from './features/session-notes-card'

const OPTIONS = [
  ['autoScroll', 'autoScroll'],
  ['copyToPrompt', 'selectToPrompt'],
  ['sessionTimer', 'sessionTimer'],
  ['notchEnabled', 'notchExperience'],
  ['quickScreenshot', 'screenshotAutoAnalyze'],
] as const

export function FeaturesTab() {
  const ws = useWorkspace()
  const { st } = useSettingsT()
  const settings = ws.state?.settings
  if (!settings) return null
  const save = (patch: Partial<Settings>) =>
    void ws.act(async () => {
      await ws.api.settings(patch)
    })
  return (
    <div>
      {OPTIONS.map(([key, label]) => (
        <div key={key} className="behavior-option">
          <div>
            <strong>{st(`settings.features.interaction.${label}Title`)}</strong>
            <p>{st(`settings.features.interaction.${label}Description`)}</p>
          </div>
          <Toggle
            ariaLabel={st(`settings.features.interaction.${label}Title`)}
            checked={Boolean(settings[key])}
            onChange={(checked) => save({ [key]: checked })}
          />
        </div>
      ))}
      <SessionNotesCard folder={settings.sessionNotesFolder} />
    </div>
  )
}
