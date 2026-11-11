import type { LucideIcon } from 'lucide-react'
import {
  BrandAudio,
  BrandCapture,
  BrandCompact,
  BrandListen,
  BrandScroll,
  BrandStealth,
  BrandTranscript,
} from '@/components/brand-icon'
import { ShortcutKeyGlyph } from '@/components/bar-glyphs'
import { ShortcutKeys } from '@/components/shortcut-keys'
import type { MessageKey } from '@/i18n'
import { useT } from '@/use-t'
import type { Hint, HintGroups, HintId } from './shortcut-hints'
import './shortcut-sheet.css'

const ROWS: Record<HintId, [MessageKey, LucideIcon]> = {
  record: ['overlay.hintListen', BrandListen],
  capture: ['overlay.hintCapture', BrandCapture],
  ask: ['overlay.hintAsk', BrandTranscript],
  mic: ['overlay.hintMic', BrandAudio],
  hide: ['overlay.hintHide', BrandStealth],
  overlay: ['overlay.hintOverlay', BrandCompact],
  previousResponse: ['overlay.hintPreviousAnswer', BrandScroll],
  nextResponse: ['overlay.hintNextAnswer', BrandScroll],
}

// The shortcut sheet shown above the bar while Command is held: what to do now, then windows and answers, each
// with the brand icon of its action and the keys the user has set.
export function ShortcutSheet({ groups, listening }: { groups: HintGroups; listening: boolean }) {
  const { t } = useT()
  const row = (hint: Hint, primary = false) => {
    const [label, Icon] = ROWS[hint.id]
    return (
      <li key={hint.id} className="shortcut-sheet-row" data-primary={primary || undefined}>
        <Icon className="size-4 shrink-0 text-foreground [--brand-icon-accent:#2581ff]" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">
          {hint.id === 'record' && listening ? t('overlay.hintAnalyze') : t(label)}
        </span>
        <ShortcutKeys accelerator={hint.accelerator} />
      </li>
    )
  }
  // The first action of the current state is the one to reach for, so it carries the blue edge.
  const group = (title: MessageKey, hints: Hint[], current = false) =>
    hints.length ? (
      <section aria-label={t(title)}>
        <h3 className="shortcut-sheet-group">{t(title)}</h3>
        <ul>{hints.map((hint, index) => row(hint, current && index === 0))}</ul>
      </section>
    ) : null
  return (
    <div role="dialog" aria-label={t('overlay.shortcutsTitle')} className="shortcut-sheet">
      <div className="shortcut-sheet-header">
        <ShortcutKeyGlyph className="size-4" />
        {t('overlay.shortcutsTitle')}
      </div>
      {group('overlay.shortcutsNow', groups.now, true)}
      {group('overlay.shortcutsWindows', groups.windows)}
      {group('overlay.shortcutsAnswers', groups.answers)}
      <p className="shortcut-sheet-footer">{t('overlay.shortcutsRelease')}</p>
    </div>
  )
}
