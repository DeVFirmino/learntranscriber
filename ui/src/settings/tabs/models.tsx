import { SegmentedTabsList } from '@/components/ui/segmented-tabs'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { useState } from 'react'
import type { Settings } from '@/bridge/types/settings'
import { useWorkspace } from '@/workspace'
import { useT } from '@/use-t'
import { analysisGroups } from '../model-groups/analysis-groups'
import type { Card, Mode } from '../model-groups/cards'
import { transcriptionGroups } from '../model-groups/transcription-groups'
import { useChooseModel, useProviderSetup } from '../model-groups/use-provider-setup'
import { useSettingsT } from '../use-settings-t'
import { SettingsIcon } from '../settings-icon'
import { ProviderGroup } from './models/provider-group'

const MODES: Record<Mode, { title: string; fallback: string; description: string }> = {
  transcription: {
    title: 'settings.models.transcriptionTitle',
    fallback: 'Transcription',
    description: 'settings.models.transcriptionDescription',
  },
  analysis: {
    title: 'settings.models.analysisTitle',
    fallback: 'Analysis',
    description: 'settings.models.analysisDescription',
  },
  translation: {
    title: 'settings.models.translationTitle',
    fallback: 'Translation',
    description: 'settings.models.translationDescription',
  },
}

// Models (5211): Transcription, Analysis and Translation, each listing the configured providers' models.
export function ModelsTab({ initialMode = 'transcription' }: { initialMode?: Mode }) {
  const ws = useWorkspace()
  const { t } = useT()
  const { st } = useSettingsT()
  const [mode, setMode] = useState<Mode>(initialMode)
  const setup = useProviderSetup()
  const chooseModel = useChooseModel()
  if (!setup) return null
  const list = mode === 'transcription' ? transcriptionGroups(setup) : analysisGroups(setup, mode)
  const locked = mode === 'transcription' && ws.audio.recording
  const choose = (patch: Partial<Settings>, model: Card) => chooseModel(list, patch, model)
  return (
    <Tabs
      className="models-tab"
      value={mode}
      onValueChange={(value) => {
        if (value === 'transcription' || value === 'analysis' || value === 'translation') setMode(value)
      }}
    >
      <div className="model-purpose-scroll">
        <SegmentedTabsList
          value={mode}
          label={st('settings.tabs.models', 'Models')}
          segments={(['transcription', 'analysis', 'translation'] as const).map((id) => ({
            value: id,
            label: st(MODES[id].title, MODES[id].fallback),
          }))}
        />
      </div>
      <TabsContent value={mode}>
        <div className="models-tab-section">
          <div className="models-tab-section-header">
            <h3 className="models-tab-section-title">{st(MODES[mode].title, MODES[mode].fallback)}</h3>
            <p className="models-tab-section-description">{st(MODES[mode].description)}</p>
            {mode === 'analysis' ? (
              <p className="models-tab-section-note">{st('settings.models.analysisRoutingNote')}</p>
            ) : null}
            {mode === 'translation' ? (
              <p className="models-tab-section-note">{st('settings.models.translationRoutingNote')}</p>
            ) : null}
            {locked ? (
              <p className="models-tab-section-locked">
                <SettingsIcon name="lock" />
                {st('settings.models.transcriptionLocked', 'Stop transcription to change the transcription model')}
              </p>
            ) : null}
          </div>
          <div className="model-groups">
            {list.length ? (
              list.map((group) => <ProviderGroup key={group.id} group={group} disabled={locked} onChoose={choose} />)
            ) : (
              <p className="models-tab-empty-hint">
                {t('settingsPage.noSources')}{' '}
                <a href="#settings/ai/sources" className="underline underline-offset-4">
                  {t('nav.aiSources')}
                </a>
              </p>
            )}
          </div>
        </div>
      </TabsContent>
    </Tabs>
  )
}
// keys: settings.models.transcriptionTitle settings.models.analysisTitle settings.models.translationTitle
// keys: settings.models.transcriptionDescription settings.models.analysisDescription
// keys: settings.models.translationDescription
