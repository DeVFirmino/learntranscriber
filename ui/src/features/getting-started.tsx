import { Check, ChevronRight } from 'lucide-react'
import { BrandModels, BrandAudio, BrandAssistants } from '@/components/brand-icon'
import { Button } from '@/components/ui/button'
import { useWorkspace } from '@/workspace'
import { useT } from '@/use-t'
import { SETUP_STEP_LABELS, setupProgress, type SetupStepKey } from './setup-progress'
import { SetupProgressBar } from './setup-progress-bar'

const ICONS = { model: BrandModels, audio: BrandAudio, assistant: BrandAssistants } as const satisfies Record<
  SetupStepKey,
  unknown
>

export function GettingStarted({ persistent = false }: { persistent?: boolean } = {}) {
  const ws = useWorkspace()
  const { t } = useT()
  if (!ws.state) return null
  const state = ws.state
  const dismiss = (onboardingDismissed: boolean) =>
    void ws.act(async () => {
      await ws.api.settings({ onboardingDismissed })
    })
  if (state.settings.onboardingDismissed && !persistent)
    return (
      <Button variant="outline" className="w-fit" onClick={() => dismiss(false)}>
        {t('onboarding.review')}
      </Button>
    )
  const progress = setupProgress(state)
  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">{t('onboarding.hint')}</p>
      <SetupProgressBar completed={progress.completed} total={progress.steps.length} />
      <ul className="grid divide-y divide-border">
        {progress.steps.map(({ key, ready, route }) => {
          const Icon = ICONS[key]
          return (
            <li key={key}>
              <a
                href={route}
                className="flex min-h-12 items-center gap-3 rounded-md py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <Icon className="size-5 shrink-0" />
                <span className="min-w-0 flex-1 text-sm">{t(SETUP_STEP_LABELS[key])}</span>
                <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                  {ready ? <Check className="size-3.5" aria-hidden="true" /> : null}
                  {t(ready ? 'onboarding.configured' : 'onboarding.configure')}
                  <ChevronRight className="size-3.5" aria-hidden="true" />
                </span>
              </a>
            </li>
          )
        })}
      </ul>
      {progress.complete ? (
        <p role="status" className="text-sm">
          {t('onboarding.complete')}
        </p>
      ) : null}
      <Button
        variant="ghost"
        size="sm"
        className="w-fit px-0"
        onClick={() => dismiss(!state.settings.onboardingDismissed)}
      >
        {t(state.settings.onboardingDismissed ? 'onboarding.review' : 'onboarding.dismiss')}
      </Button>
    </div>
  )
}
