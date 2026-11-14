import { floatingFontScale } from './reading-size'
import { Lightbulb as Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { OverlayOpacity } from '@/components/overlay-opacity'
import { useWorkspace } from '@/workspace'
import { useT } from '@/use-t'
import { AUTO_SPEECH_LOCALE, speechLanguageOptions } from '../speech-language'
import type { View } from './panel-view'

// The panel's settings row: live insights, echo reduction on the Transcript tab, the Apple speech language (a change
// applies to the running captions at once), opacity, text size and hiding the floating assistant.
export function PanelSettings({ view }: { view: View }) {
  const ws = useWorkspace()
  const { t } = useT()
  const state = ws.state
  if (!state) return null
  const fontScale = floatingFontScale(state.settings.unifiedModalFontScale)
  const adjustFont = (step: number) =>
    void ws.act(async () => {
      const next = Math.max(1, Math.min(1.6, Math.round((fontScale + step) * 10) / 10))
      await ws.api.settings({ unifiedModalFontScale: next })
    })
  return (
    <div
      data-panel-settings
      className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-white/10 px-3 py-2 text-xs"
    >
      <label className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground" title={t('overlay.liveHint')}>
        <Sparkles className="size-3.5" />
        <Switch
          checked={state.settings.autoInsights}
          aria-label={t('overlay.liveHint')}
          onCheckedChange={(next) =>
            void ws.act(async () => {
              await ws.api.settings({ autoInsights: next })
            })
          }
        />
      </label>
      {view === 'transcript' ? (
        // The echo reduction switch, from the transcript audio controls.
        <label
          className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground"
          title={t('overlay.echoReductionHint')}
        >
          {t('overlay.echoReduction')}
          <Switch
            checked={state.settings.echoReductionEnabled}
            aria-label={
              state.settings.echoReductionEnabled ? t('overlay.disableEchoReduction') : t('overlay.enableEchoReduction')
            }
            aria-description={t('overlay.echoReductionHint')}
            onCheckedChange={(next) =>
              void ws.act(async () => {
                await ws.api.settings({ echoReductionEnabled: next })
              })
            }
          />
        </label>
      ) : null}
      {state.settings.transcriptionProvider === 'apple' ? (
        <select
          aria-label={t('overlay.speechLanguage')}
          title={t('overlay.speechLanguage')}
          className="h-8 rounded-full border border-white/10 bg-white/5 px-3 text-xs text-foreground"
          value={state.settings.appleSpeechLocale}
          onChange={(event) => {
            const appleSpeechLocale = event.currentTarget.value
            void ws.act(async () => {
              await ws.api.settings({ appleSpeechLocale })
            })
          }}
        >
          {speechLanguageOptions(state.settings.appleSpeechLocale).map((locale) => (
            <option key={locale} value={locale}>
              {locale === AUTO_SPEECH_LOCALE ? t('overlay.speechLanguageAuto') : locale}
            </option>
          ))}
        </select>
      ) : null}
      <OverlayOpacity compact value={Math.round(state.settings.overlayOpacity * 100)} />
      <div className="flex items-center gap-1" aria-label={t('overlay.fontSize')}>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          disabled={fontScale <= 1}
          onClick={() => adjustFont(-0.1)}
          aria-label={t('overlay.fontDown')}
        >
          <span className="text-[11px] font-semibold">A</span>
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          disabled={fontScale >= 1.6}
          onClick={() => adjustFont(0.1)}
          aria-label={t('overlay.fontUp')}
        >
          <span className="text-base font-semibold">A</span>
        </Button>
      </div>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() =>
          void ws.act(async () => {
            await ws.api.closeOverlay()
          })
        }
      >
        {t('overlay.hide')}
      </Button>
    </div>
  )
}
