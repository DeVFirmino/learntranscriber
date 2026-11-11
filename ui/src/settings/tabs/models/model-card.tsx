import { Badge } from '@/components/ui/badge'
import { onActivationKey } from '@/features/keyboard-activation'
import { ProviderIcon, SettingsIcon } from '../../settings-icon'
import { TRANSCRIPTION_COST } from '../../model-catalog'
import type { Card } from '../../model-groups/cards'
import { useSettingsT } from '../../use-settings-t'

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

// One model to choose, as a compact row: a radio mark, its name, what it does, and what a 30-minute two-source call
// would cost when it has a price. A provider with a single model shows it with the provider's logo instead.
export function ModelCard({
  model,
  selected,
  disabled,
  onSelect,
  withLogo = false,
}: {
  model: Card
  selected: boolean
  disabled: boolean
  onSelect: () => void
  withLogo?: boolean
}) {
  const { st } = useSettingsT()
  const unavailable = Boolean(model.unavailable)
  const blocked = disabled || unavailable
  const cost = TRANSCRIPTION_COST[model.id]
  let description = model.description
  if (model.id === 'gpt-live-transcribe')
    description = st(
      'settings.models.gptLiveTranscribeDescription',
      'Latest low-latency streaming transcription with context and language hints.',
    )
  else if (unavailable)
    description = model.note || st('settings.models.lockedDescription', 'Locked — requires a higher OpenAI usage tier.')
  return (
    <div
      role="radio"
      tabIndex={blocked ? -1 : 0}
      aria-checked={selected}
      aria-disabled={blocked}
      className="model-option"
      data-selected={selected || undefined}
      data-blocked={blocked || undefined}
      onClick={() => !blocked && onSelect()}
      onKeyDown={onActivationKey(() => !blocked && onSelect())}
    >
      {withLogo ? (
        <span className="model-option-logo">
          <ProviderIcon providerId={model.icon} />
        </span>
      ) : (
        <span aria-hidden="true" className="model-option-radio" />
      )}
      <span className="model-option-copy">
        <span className="model-option-name">
          {model.name}
          {model.new ? <Badge variant="secondary">{st('settings.models.newBadge', 'New')}</Badge> : null}
        </span>
        <span className="model-option-description">{description}</span>
        {Number.isFinite(cost) ? (
          <span className="model-option-cost">
            {st('settings.models.estimatedCallCost', {
              minutes: 30,
              sources: 2,
              cost: money.format(cost * 30 * 2),
            })}
          </span>
        ) : null}
      </span>
      {unavailable ? <SettingsIcon name="lock" className="model-option-state" /> : null}
      {selected && !unavailable ? <SettingsIcon name="check_circle" className="model-option-state" /> : null}
    </div>
  )
}
