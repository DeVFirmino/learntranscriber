import type { Settings } from '@/bridge/types/settings'
import { Badge } from '@/components/ui/badge'
import { useWorkspace } from '@/workspace'
import { ProviderIcon, SettingsIcon } from '../../settings-icon'
import type { Card, Group } from '../../model-groups/cards'
import { useSettingsT } from '../../use-settings-t'
import { ModelCard } from './model-card'
import './model-list.css'

// One configured provider and its models as one choice list, with the usage-tier hint when OpenAI locks some of them.
// A provider with a single model is that one row, not a card around a card.
export function ProviderGroup({
  group,
  disabled,
  onChoose,
}: {
  group: Group
  disabled: boolean
  onChoose: (patch: Partial<Settings>, model: Card) => void
}) {
  const { st } = useSettingsT()
  const ws = useWorkspace()
  const selected = group.models.find((model) => group.selected(model)) || null
  const choose = (model: Card) => {
    const patch = group.choose(model)
    if (patch) onChoose(patch, model)
  }
  const single = group.models.length === 1
  return (
    <section className="model-group" data-selected={selected ? true : undefined} aria-label={group.title}>
      {single ? null : (
        <header className="model-group-header">
          <span className="model-option-logo">
            <ProviderIcon providerId={group.icon} />
          </span>
          <span className="min-w-0">
            <span className="model-group-title">
              {group.title}
              {group.badge ? <Badge variant="outline">{group.badge}</Badge> : null}
            </span>
            {group.description ? <span className="model-option-description">{group.description}</span> : null}
          </span>
        </header>
      )}
      {group.tierHint ? (
        <p className="model-group-hint">
          <SettingsIcon name="info" />
          <span>
            {st('settings.models.tierHintPrefix', 'OpenAI locks some models behind')}{' '}
            <button
              type="button"
              className="models-tab-tier-link"
              onClick={() => void ws.api.openResponseLink('https://platform.openai.com/settings/organization/limits')}
            >
              {st('settings.models.usageTiers', 'usage tiers')}
              <SettingsIcon name="open_in_new" />
            </button>
            {st('settings.models.tierHintSuffix', '. Check your organization Limits page to see your current tier.')}
          </span>
        </p>
      ) : null}
      <div role="radiogroup" aria-label={group.title} className="model-group-options">
        {group.models.map((model) => (
          <ModelCard
            key={model.id}
            model={model}
            withLogo={single}
            selected={selected?.id === model.id}
            disabled={disabled}
            onSelect={() => choose(model)}
          />
        ))}
      </div>
    </section>
  )
}
