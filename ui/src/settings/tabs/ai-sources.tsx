import { useEffect, useState } from 'react'
import { SegmentedTabsList } from '@/components/ui/segmented-tabs'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { useWorkspace } from '@/workspace'
import { providerFromSection, type ProviderId } from '../ai-providers'
import { useSettingsT } from '../use-settings-t'
import { CloudSources } from './ai-sources/cloud-sources'
import { connectedSources } from './ai-sources/connected-sources'
import { LocalSources } from './ai-sources/local-sources'
import { ProviderPage } from './ai-sources/provider-page'
import { useLocalServerScan } from './ai-sources/use-local-server-scan'

type Filter = 'all' | 'local' | 'cloud'

// AI Sources (6862): the provider card grid, then one provider's page behind a breadcrumb.
export function AiSources({
  initialSection,
  onNavigate,
}: {
  initialSection: string | null
  onNavigate: (section: string | null) => void
}) {
  const ws = useWorkspace()
  const { st } = useSettingsT()
  const [filter, setFilter] = useState<Filter>('all')
  const [speechAuthorized, setSpeechAuthorized] = useState(false)
  const provider = providerFromSection(initialSection)
  const openProvider = (id: ProviderId) => onNavigate(id)
  const scan = useLocalServerScan(() => openProvider('custom'))
  useEffect(() => {
    let current = true
    void ws.api
      .speechCapabilities()
      .then((value) => current && setSpeechAuthorized(value.authorization === 'authorized'))
      .catch(() => current && setSpeechAuthorized(false))
    return () => {
      current = false
    }
  }, [ws.api])
  const state = ws.state
  if (!state) return null
  const connected = connectedSources(state, speechAuthorized)
  if (provider)
    return (
      <ProviderPage
        id={provider}
        connected={provider === 'openai' ? connected.openai || connected.chatgpt : connected[provider]}
        onBack={() => onNavigate(null)}
        onOpen={openProvider}
      />
    )
  const filterLabel = (id: Filter) => {
    if (id === 'all') return st('settings.api.cardGrid.filterAll', 'All')
    if (id === 'local') return st('settings.api.cardGrid.filterLocal', 'Local')
    return st('settings.api.cardGrid.filterCloud', 'Cloud')
  }
  return (
    <Tabs value={filter} onValueChange={(next) => setFilter(next as Filter)}>
      <div className="api-tab-container">
        <div className="api-tab-scroll api-tab-scroll-grid">
          <div className="api-grid-header">
            <div className="api-grid-header-text">
              <h2 className="api-grid-title">{st('settings.api.cardGrid.title', 'AI Providers')}</h2>
              <p className="api-grid-subtitle">
                {st(
                  'settings.api.cardGrid.subtitle',
                  'Connect your favorite cloud APIs or run models privately on your device.',
                )}
              </p>
            </div>
            <SegmentedTabsList
              value={filter}
              label={st('settings.api.cardGrid.title', 'AI Providers')}
              segments={(['all', 'local', 'cloud'] as const).map((id) => ({ value: id, label: filterLabel(id) }))}
            />
          </div>
          <TabsContent value={filter}>
            {filter !== 'local' ? <CloudSources state={state} connected={connected} onOpen={openProvider} /> : null}
            {filter !== 'cloud' ? <LocalSources connected={connected} scan={scan} onOpen={openProvider} /> : null}
          </TabsContent>
        </div>
      </div>
    </Tabs>
  )
}
