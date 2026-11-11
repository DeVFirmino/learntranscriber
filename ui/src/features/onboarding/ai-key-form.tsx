import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { providerKeyUrl } from '@/features/provider-key-url'
import { useWorkspace } from '@/workspace'
import { useT } from '@/use-t'
import { KEY_PROVIDERS, type KeyProvider } from './ai-choice'

const NAMES: Record<KeyProvider, string> = { openai: 'OpenAI', gemini: 'Google Gemini', openrouter: 'OpenRouter' }

// The provider and its key, on the card itself; Enter connects like the primary button. With one provider there is
// nothing to pick, so only the key shows.
export function AiKeyForm({
  providers = KEY_PROVIDERS,
  provider,
  value,
  disabled,
  onProvider,
  onChange,
  onSubmit,
}: {
  providers?: KeyProvider[]
  provider: KeyProvider
  value: string
  disabled: boolean
  onProvider: (provider: KeyProvider) => void
  onChange: (value: string) => void
  onSubmit: () => void
}) {
  const ws = useWorkspace()
  const { t } = useT()
  const label = t('onboardingFlow.aiKeyLabel', { provider: NAMES[provider] })
  return (
    <div className="onboarding-ai-key">
      {providers.length > 1 ? (
        <fieldset className="onboarding-chips" disabled={disabled}>
          <legend className="sr-only">{t('onboardingFlow.aiKeyProvider')}</legend>
          {providers.map((item) => (
            <label key={item} data-selected={item === provider}>
              <input
                type="radio"
                name="onboarding-key-provider"
                value={item}
                checked={item === provider}
                onChange={() => onProvider(item)}
              />
              {NAMES[item]}
            </label>
          ))}
        </fieldset>
      ) : null}
      <div className="onboarding-ai-key-row">
        <Input
          type="password"
          autoComplete="off"
          spellCheck={false}
          aria-label={label}
          placeholder={label}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && value.trim()) onSubmit()
          }}
        />
        <Button
          size="sm"
          variant="secondary"
          disabled={disabled}
          onClick={() =>
            void ws.act(async () => {
              const url = providerKeyUrl(provider)
              if (url) await ws.api.openResponseLink(url)
            })
          }
        >
          {t('onboardingFlow.aiGetKey')}
        </Button>
      </div>
    </div>
  )
}
