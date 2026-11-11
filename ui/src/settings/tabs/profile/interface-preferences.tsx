import { saveWithFeedback } from '@/features/workspace/settings-save-feedback'
import { useState } from 'react'
import { Check, Languages, Moon, Sun } from 'lucide-react'
import { RadioGroup } from 'radix-ui'
import { PreferenceField } from '@/components/ui/preference-field'
import { ChoiceTile } from '@/components/ui/choice-tile'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import './interface-preferences.css'
import { useT } from '@/use-t'
import type { Settings } from '@/bridge/types/settings'
import { normalizeLanguage, UI_LANGUAGES } from '@/i18n'
import { useWorkspace } from '@/workspace'
import { useSettingsT } from '../../use-settings-t'

// The interface language, which follows macOS until one is chosen, and the app's appearance.
export function InterfacePreferences() {
  const ws = useWorkspace()
  const { st } = useSettingsT()
  const { t } = useT()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const settings = ws.state?.settings
  if (!settings) return null
  const save = (patch: Partial<Settings>) => {
    if (saving) return
    setSaving(true)
    setSaved(false)
    void ws.act(async () => {
      try {
        await saveWithFeedback(() => ws.api.settings(patch))
        setSaved(true)
      } finally {
        setSaving(false)
      }
    })
  }
  // An unset language follows macOS, shown as the detected language.
  const language = settings.uiLanguage || normalizeLanguage(navigator.language)
  return (
    <section className="interface-preferences" aria-busy={saving} aria-labelledby="interface-preferences-title">
      <h3 id="interface-preferences-title">{st('profile.settingsTitle')}</h3>
      <div className="interface-preferences-grid">
        <PreferenceField
          id="interface-language"
          icon={<Languages />}
          title={st('profile.languageTitle')}
          description={st('profile.languageDescription')}
        >
          <Select
            disabled={saving}
            value={language}
            onValueChange={(value) => save({ uiLanguage: value as Settings['uiLanguage'] })}
          >
            <SelectTrigger
              aria-labelledby="interface-language-label"
              aria-describedby="interface-language-description"
              className="interface-language-trigger"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="start">
              {UI_LANGUAGES.map(([code, name]) => (
                <SelectItem value={code} key={code}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </PreferenceField>
        <PreferenceField
          id="interface-appearance"
          icon={<Moon />}
          title={t('settingsPage.appearanceTitle')}
          description={t('settingsPage.appearanceDescription')}
        >
          <RadioGroup.Root
            className="interface-theme-options"
            aria-labelledby="interface-appearance-label"
            aria-describedby="interface-appearance-description"
            orientation="horizontal"
            disabled={saving}
            value={settings.surfaceTheme}
            onValueChange={(value) => save({ surfaceTheme: value as Settings['surfaceTheme'] })}
          >
            {(['dark', 'light'] as const).map((theme) => (
              <ChoiceTile
                value={theme}
                key={theme}
                label={t(theme === 'dark' ? 'settingsPage.dark' : 'settingsPage.light')}
                icon={theme === 'dark' ? <Moon /> : <Sun />}
              >
                <span className="interface-theme-preview" data-theme={theme}>
                  <span className="interface-preview-bar" />
                  <span className="interface-preview-line" />
                  <span className="interface-preview-line" />
                </span>
              </ChoiceTile>
            ))}
          </RadioGroup.Root>
        </PreferenceField>
      </div>
      <p className="interface-save-status" role="status">
        {saving || saved ? <Check aria-hidden="true" /> : null}
        {saving || saved ? t(saving ? 'settingsPage.saving' : 'settingsPage.saved') : null}
      </p>
    </section>
  )
}
