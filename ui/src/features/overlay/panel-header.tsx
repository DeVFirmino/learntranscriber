import { GripVertical, MessagesSquare, X, SlidersHorizontal, type LucideIcon } from 'lucide-react'
import { BrandAudio, BrandTranscript } from '@/components/brand-icon'
import { Button } from '@/components/ui/button'
import { useT } from '@/use-t'
import { ResizeGrip } from './resize-grip'
import type { View } from './panel-view'

// The panel's header: the drag grip, the resize handle, the Transcript/Session/Summary tabs and the
// settings/minimize buttons.
export function PanelHeader({
  view,
  onView,
  settingsOpen,
  onSettingsOpen,
  onResize,
  onMinimize,
}: {
  view: View
  onView: (view: View) => void
  settingsOpen: boolean
  onSettingsOpen: (open: boolean) => void
  onResize: (size: { width: number; height: number }) => void
  onMinimize: () => void
}) {
  const { t } = useT()
  const tabs: [View, LucideIcon, string][] = [
    ['transcript', BrandAudio, t('overlay.transcript')],
    ['session', MessagesSquare, t('overlay.session')],
    ['summary', BrandTranscript, t('overlay.summary')],
  ]
  return (
    <header className="drag-region relative flex shrink-0 items-center justify-between gap-2 border-b border-white/10 py-2 pr-10 pl-3">
      <GripVertical className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <ResizeGrip label={t('overlay.resize')} onResize={onResize} />
      <nav className="flex shrink-0 gap-0.5 rounded-full bg-white/5 p-1" aria-label={t('overlay.views')}>
        {tabs.map(([item, Icon, label]) => (
          <Button
            key={item}
            type="button"
            size="sm"
            variant={view === item ? 'secondary' : 'ghost'}
            className="h-7 gap-1.5 rounded-full px-2.5 text-xs"
            onClick={() => onView(item)}
            aria-label={label}
            title={label}
            aria-current={view === item ? 'page' : undefined}
          >
            <Icon className="size-4" aria-hidden="true" />
            {label}
          </Button>
        ))}
      </nav>
      <div className="flex-1" />
      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          size="icon-sm"
          variant={settingsOpen ? 'secondary' : 'ghost'}
          onClick={() => onSettingsOpen(!settingsOpen)}
          aria-label={t('overlay.settings')}
          title={t('overlay.settings')}
          aria-expanded={settingsOpen}
        >
          <SlidersHorizontal className="size-4" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          onClick={onMinimize}
          aria-label={t('overlay.minimize')}
          title={t('overlay.minimize')}
        >
          <X className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </header>
  )
}
