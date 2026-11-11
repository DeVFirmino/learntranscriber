import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { analysisGroups } from '@/settings/model-groups/analysis-groups'
import { useChooseModel, useProviderSetup } from '@/settings/model-groups/use-provider-setup'
import { useT } from '@/use-t'
import { useWorkspace } from '@/workspace'

const key = (group: string, model: string) => `${group}\n${model}`

// The analysis model the builder asks, chosen in its prompt box from the configured providers' models, grouped by
// provider. The choice is the app's analysis model, the same one Settings › Models saves. With nothing configured it
// names the saved route and links to the AI sources.
export function BuilderModelPicker({ disabled }: { disabled?: boolean }) {
  const ws = useWorkspace()
  const { t } = useT()
  const setup = useProviderSetup()
  const chooseModel = useChooseModel()
  const groups = setup ? analysisGroups(setup, 'analysis') : []
  if (!setup || !groups.some((group) => group.models.length)) {
    if (ws.mode === 'mock') return <span className="builder-composer-model">{t('builder.simulated')}</span>
    return (
      <a href="#settings/ai/sources" className="builder-composer-model underline underline-offset-4">
        {t('builder.chooseModel')}
      </a>
    )
  }
  const saved = groups.flatMap((group) => group.models.filter(group.selected).map((model) => key(group.id, model.id)))
  const route = setup.settings.provider === 'local' ? t('builder.localModel') : setup.settings.provider
  return (
    <Select
      value={saved[0] ?? ''}
      disabled={disabled}
      onValueChange={(value) => {
        for (const group of groups) {
          const model = group.models.find((item) => key(group.id, item.id) === value)
          const patch = model && group.choose(model)
          if (model && patch) return chooseModel(groups, patch, model)
        }
      }}
    >
      <SelectTrigger size="sm" aria-label={t('builder.model')} className="builder-model-trigger">
        <SelectValue
          placeholder={setup.settings.model ? `${route} · ${setup.settings.model}` : t('builder.chooseModel')}
        />
      </SelectTrigger>
      <SelectContent position="popper" align="start">
        {groups.map((group) =>
          group.models.length ? (
            <SelectGroup key={group.id}>
              <SelectLabel>{group.title}</SelectLabel>
              {group.models.map((model) => (
                <SelectItem key={model.id} value={key(group.id, model.id)} disabled={model.unavailable}>
                  {model.name}
                </SelectItem>
              ))}
            </SelectGroup>
          ) : null,
        )}
      </SelectContent>
    </Select>
  )
}
