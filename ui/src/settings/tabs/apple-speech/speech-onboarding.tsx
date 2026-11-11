import { ProviderIcon, SettingsIcon } from '../../settings-icon'
import { useSettingsT } from '../../use-settings-t'

// Before Speech Recognition is allowed: what Apple Speech needs, and either the button that asks or, once denied, the
// way to System Settings.
export function SpeechOnboarding({
  denied,
  loading,
  onGrant,
  onOpenSettings,
}: {
  denied: boolean
  loading: boolean
  onGrant: () => void
  onOpenSettings: () => void
}) {
  const { st } = useSettingsT()
  return (
    <div className="setting-group compact">
      <div className="local-provider-content">
        <div className="apple-speech-onboarding">
          <div className="apple-speech-onboarding-card">
            <div className="apple-speech-onboarding-card-header">
              <div className="apple-speech-onboarding-logo">
                <ProviderIcon providerId="apple_speech" />
              </div>
              <div className="apple-speech-onboarding-header-text">
                <h3 className="apple-speech-onboarding-title">
                  {st('settings.api.appleSpeech.onboardingTitle', 'Enable Apple Speech Recognition')}
                </h3>
                <p className="apple-speech-onboarding-description">
                  {st(
                    'settings.api.appleSpeech.onboardingDescription',
                    'Grant permission to use on-device speech recognition. Your audio stays on your Mac — nothing is sent to the cloud.',
                  )}
                </p>
              </div>
            </div>
            <div className="apple-speech-onboarding-card-footer">
              {denied ? (
                <>
                  <p className="apple-speech-onboarding-denied-hint">
                    {st(
                      'settings.api.appleSpeech.permissionDeniedHint',
                      'Permission was denied. Open System Settings to enable Speech Recognition for this app.',
                    )}
                  </p>
                  <button className="glass-button apple-speech-onboarding-button" onClick={onOpenSettings}>
                    <SettingsIcon name="settings" style={{ pointerEvents: 'none' }} />
                    <span>{st('settings.api.localModels.appleSpeechOpenSystemSettings')}</span>
                  </button>
                </>
              ) : (
                <button
                  className="glass-button apple-speech-onboarding-button primary"
                  disabled={loading}
                  onClick={onGrant}
                >
                  <SettingsIcon name={loading ? 'sync' : 'mic'} style={{ pointerEvents: 'none' }} />
                  <span>
                    {loading
                      ? st('settings.api.appleSpeech.requesting', 'Requesting…')
                      : st('settings.api.appleSpeech.grantPermission', 'Grant Permission')}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
