import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { MessageKey } from '@/i18n'
import { SettingsIcon } from '@/settings/settings-icon'
import type { SettingsIconName } from '@/settings/icons/glyphs'
import { usePermissionsStatus } from '@/settings/tabs/permissions/use-permissions-status'
import { useWorkspace } from '@/workspace'
import { useT } from '@/use-t'
import { permissionNeeds, type PermissionNeed } from './listening-choices'
import { PermissionClip } from './permission-clip'
import { permissionPlan, type PermissionTone } from './permission-plan'
import './permissions.css'

const ROWS: Record<PermissionNeed, { icon: SettingsIconName; label: MessageKey; detail: MessageKey }> = {
  microphone: {
    icon: 'mic',
    label: 'onboardingFlow.permissionMicrophone',
    detail: 'onboardingFlow.permissionMicrophoneDetail',
  },
  speech: {
    icon: 'record_voice_over',
    label: 'onboardingFlow.permissionSpeech',
    detail: 'onboardingFlow.permissionSpeechDetail',
  },
  screen: {
    icon: 'desktop_windows',
    label: 'onboardingFlow.permissionScreen',
    detail: 'onboardingFlow.permissionScreenDetail',
  },
}
const PILLS: Record<PermissionTone, MessageKey> = {
  done: 'onboardingFlow.allowed',
  now: 'onboardingFlow.permissionNeeded',
  later: 'onboardingFlow.permissionLater',
}

// Only the access the chosen audio and speech to text need, asked one at a time with the System Settings pane it
// lives in. macOS is read again every moment and whenever the window regains focus, so each row turns green on its
// own. Nothing records here; without every permission the person can still try the sample conversation.
export function PermissionsStep({
  busy,
  onBack,
  onContinue,
  onExample,
}: {
  busy: boolean
  onBack: () => void
  onContinue: () => void
  onExample: () => void
}) {
  const ws = useWorkspace()
  const { t } = useT()
  const { status, speech, refresh } = usePermissionsStatus()
  const [asked, setAsked] = useState<PermissionNeed | null>(null)
  const needs = ws.state ? permissionNeeds(ws.state.settings) : []
  const plan = permissionPlan(needs, {
    microphone: status.microphone,
    screen: status.screen,
    speech: speech.authorized,
  })
  const current = plan.current
  useEffect(() => {
    if (!current) return
    const timer = window.setInterval(() => void refresh(), 1500)
    return () => window.clearInterval(timer)
  }, [current, refresh])
  if (!ws.state) return null
  const allow = (need: PermissionNeed) =>
    void ws.act(async () => {
      setAsked(need)
      if (need !== 'microphone' || !(await ws.api.requestMicrophone())) await ws.api.openPrivacyPane(need)
      await refresh()
    })
  const pill = (need: PermissionNeed, tone: PermissionTone) =>
    tone === 'now' && asked === need ? t('onboardingFlow.permissionWaiting') : t(PILLS[tone])
  return (
    <div className="onboarding-step" data-onboarding-step="permissions">
      <h1 tabIndex={-1}>{t('onboardingFlow.permissionsTitle')}</h1>
      <p>{t('onboardingFlow.permissionsDescription')}</p>
      <ul className="onboarding-permission-list">
        {plan.rows.map(({ need, tone }) => (
          <li key={need} className="onboarding-permission-row" data-current={need === current}>
            <SettingsIcon name={ROWS[need].icon} />
            <span className="onboarding-choice-text">
              <strong>{t(ROWS[need].label)}</strong>
              {need === current ? <small>{t(ROWS[need].detail)}</small> : null}
            </span>
            <span className="onboarding-pill" data-tone={tone}>
              {pill(need, tone)}
            </span>
          </li>
        ))}
      </ul>
      {current ? <PermissionClip need={current} /> : null}
      {current === 'screen' ? <p className="onboarding-restart">{t('onboardingFlow.screenRestart')}</p> : null}
      <div className="onboarding-actions">
        <Button variant="secondary" disabled={busy} onClick={onBack}>
          <ArrowLeft aria-hidden="true" />
          {t('onboardingFlow.back')}
        </Button>
        {current ? (
          <span className="onboarding-actions-end">
            <Button variant="ghost" disabled={busy} onClick={onExample}>
              {t('onboardingFlow.continueWithExample')}
            </Button>
            <Button className="onboarding-primary" disabled={busy} onClick={() => allow(current)}>
              {t(current === 'microphone' ? 'onboardingFlow.allowMicrophone' : 'onboardingFlow.openSettings')}
            </Button>
          </span>
        ) : (
          <Button className="onboarding-primary" disabled={busy} onClick={onContinue}>
            {t('onboardingFlow.tryForReal')}
            <ArrowRight aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  )
}
