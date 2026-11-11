import { useWorkspace } from '@/workspace'
import { useT } from '@/use-t'
import { useSettingsT } from '../use-settings-t'
import { SettingsIcon } from '../settings-icon'
import { PermissionRow } from './permissions/permission-row'
import './permissions/permissions-list.css'
import { usePermissionsStatus } from './permissions/use-permissions-status'

// Permissions: microphone, screen capture, accessibility and Apple Speech rows, and the restart notice.
export function PermissionsTab() {
  const ws = useWorkspace()
  const { t } = useT()
  const { st } = useSettingsT()
  const { status, speech, checking, refresh, restartNeeded } = usePermissionsStatus()
  const openSettings = st('settings.permissions.openSettings', 'Open Settings')
  const grantAccess = st('settings.permissions.grantAccess', 'Grant Access')
  const label = (granted: boolean) => (granted ? openSettings : grantAccess)
  const act = (task: () => Promise<unknown>) =>
    void ws.act(async () => {
      await task()
      await refresh()
    })
  return (
    <>
      <ul className="permissions-list">
        <PermissionRow
          icon="mic"
          granted={status.microphone}
          label={st('settings.permissions.microphoneAccess', 'Microphone Access')}
          description={st('settings.permissions.microphoneDescription')}
          actionLabel={label(status.microphone)}
          onClick={() =>
            act(async () => {
              if (status.microphone || !(await ws.api.requestMicrophone())) await ws.api.openPrivacyPane('microphone')
            })
          }
        />
        <PermissionRow
          icon="desktop_windows"
          granted={status.screen}
          label={st('settings.permissions.screenCapture', 'Screen Capture')}
          description={st('settings.permissions.screenDescription')}
          actionLabel={label(status.screen)}
          onClick={() => act(() => ws.api.openPrivacyPane('screen'))}
        />
        <PermissionRow
          icon="accessibility_new"
          granted={status.accessibility}
          label={st('settings.permissions.accessibilityAccess', 'Accessibility Access')}
          description={st('settings.permissions.accessibilityDescription')}
          actionLabel={label(status.accessibility)}
          onClick={() =>
            act(async () => {
              if (status.accessibility || !(await ws.api.contextPermission()))
                await ws.api.openPrivacyPane('accessibility')
            })
          }
        />
        <PermissionRow
          icon="record_voice_over"
          granted={speech.authorized}
          label={st('settings.permissions.appleSpeechAccess', 'Apple Speech Recognition')}
          description={
            speech.denied
              ? st('settings.permissions.appleSpeechDeniedDescription')
              : st('settings.permissions.appleSpeechDescription')
          }
          actionLabel={
            checking
              ? st('settings.permissions.checkingPermission', 'Checking...')
              : speech.authorized || speech.denied
                ? openSettings
                : st('settings.permissions.requestPermission', 'Request Permission')
          }
          actionIcon={checking ? 'sync' : speech.authorized || speech.denied ? 'open_in_new' : 'record_voice_over'}
          actionDisabled={checking}
          // The speech helper asks for authorization only when it transcribes, so an undecided status opens the
          // Speech Recognition pane instead of a standalone prompt.
          onClick={() => act(() => ws.api.openPrivacyPane('speech'))}
        />
      </ul>
      {restartNeeded ? (
        <div className="stealth-mode-bar">
          <SettingsIcon name="info_outline" className="stealth-mode-icon" style={{ pointerEvents: 'none' }} />
          <span className="stealth-mode-text">{t('settingsPage.restartPermissions')}</span>
        </div>
      ) : null}
    </>
  )
}
