import { SegmentedTabsList } from '@/components/ui/segmented-tabs'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { useWorkspace } from '@/workspace'
import { useT } from '@/use-t'
import { aiLocation } from '@/features/shell/navigation'
import { AiSources } from './ai-sources'
import { ModelsTab } from './models'

// Connections and model choices share one settings section.
export function AiSettings() {
  const ws = useWorkspace()
  const { t } = useT()
  const { view, provider } = aiLocation(ws.route)
  const openSource = (id: string | null) => ws.go(`settings/ai/sources${id ? `/${id}` : ''}`)
  return (
    <Tabs className="ai-settings gap-6" value={view} onValueChange={(next) => ws.go(`settings/ai/${next}`)}>
      <SegmentedTabsList
        value={view}
        label={t('nav.ai')}
        segments={[
          { value: 'sources', label: t('nav.aiSources') },
          { value: 'models', label: t('nav.models') },
        ]}
      />
      <TabsContent value="sources">
        <AiSources initialSection={provider} onNavigate={openSource} />
      </TabsContent>
      <TabsContent value="models">
        <ModelsTab key={provider} initialMode={provider === 'analysis' ? 'analysis' : 'transcription'} />
      </TabsContent>
    </Tabs>
  )
}
