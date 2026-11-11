import { ActionButton } from '@/components/ui/action-button'
import { useWorkspace } from '@/workspace'
import { useT } from '@/use-t'
import { modelSetup } from '@/features/model-setup'
import './model-setup-notice.css'

export function ModelSetupNotice() {
  const ws = useWorkspace()
  const { t } = useT()
  if (!ws.state) return null
  const setup = modelSetup(ws.state)
  if (setup === 'ready') return null
  const messages = {
    connect: 'setup.connectBeforeQuestion',
    model: 'setup.modelBeforeQuestion',
    provider: 'setup.providerBeforeQuestion',
    local: 'setup.localBeforeQuestion',
  } as const
  const actions = {
    connect: 'setup.connectAI',
    model: 'setup.chooseModel',
    provider: 'setup.chooseModel',
    local: 'setup.chooseModel',
  } as const
  return (
    <div className="model-setup-notice" data-model-setup-notice role="status">
      <span>{t(messages[setup])}</span>
      <ActionButton
        type="button"
        size="sm"
        onClick={() => {
          if (setup === 'connect') ws.openAiSources()
          else
            void ws.act(async () => {
              await ws.api.openAiModels()
            })
        }}
      >
        {t(actions[setup])}
      </ActionButton>
    </div>
  )
}
