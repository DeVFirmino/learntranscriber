import { useState, type ReactNode } from 'react'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { useWorkspace } from '@/workspace'
import type { Settings } from '@/bridge/types/settings'
import { useT } from '@/use-t'
import { showError } from '@/features/workspace/error-toast'

type NotchToggle = 'autoInsights' | 'autoScreenInsights' | 'notchFollowUps'

export function NotchSettings() {
  const ws = useWorkspace()
  const { t } = useT()
  const settings = ws.state?.settings
  const opacity = Math.round((settings?.notchOpacity ?? 1) * 100)
  const [dragging, setDragging] = useState<number | null>(null)
  const shown = dragging ?? opacity
  if (!settings) return null
  const save = (patch: Partial<Settings>) =>
    void ws.act(async () => {
      await ws.api.settings(patch)
    })
  const toggle = (name: NotchToggle, title: string, description: string) => (
    <Row title={title} description={description}>
      <Switch
        size="sm"
        checked={settings[name]}
        aria-label={title}
        onCheckedChange={(value) => save({ [name]: value === true })}
      />
    </Row>
  )
  return (
    <div className="grid gap-3 text-sm" aria-label={t('notch.settings')}>
      <Row title={t('notchSettings.opacity')} description={t('notchSettings.opacityHint')}>
        <div className="flex w-36 items-center gap-2">
          <Slider
            min={45}
            max={100}
            value={[shown]}
            aria-label={t('notchSettings.opacityLabel')}
            onValueChange={(next) => setDragging(next[0] ?? shown)}
            onValueCommit={(next) =>
              void ws.act(async () => {
                try {
                  await ws.api.settings({ notchOpacity: (next[0] ?? shown) / 100 })
                } finally {
                  setDragging(null)
                }
              })
            }
          />
          <output className="w-10 shrink-0 whitespace-nowrap text-right text-xs tabular-nums">{shown}%</output>
        </div>
      </Row>
      <Row title={t('notchSettings.reading')} description={t('notchSettings.readingHint')}>
        <Input
          type="number"
          min={5}
          max={30}
          step={1}
          aria-label={t('notchSettings.readingLabel')}
          className="h-7 w-16 shrink-0"
          key={settings.notchMinimumVisibleSeconds}
          defaultValue={settings.notchMinimumVisibleSeconds}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
          }}
          onBlur={(event) => {
            const input = event.currentTarget,
              value = Number(input.value)
            if (!Number.isInteger(value) || value < 5 || value > 30) {
              input.value = String(settings.notchMinimumVisibleSeconds)
              showError(t('notchSettings.readingError'))
              return
            }
            if (value !== settings.notchMinimumVisibleSeconds) save({ notchMinimumVisibleSeconds: value })
          }}
        />
      </Row>
      {toggle('autoInsights', t('notchSettings.transcript'), t('notchSettings.transcriptHint'))}
      {toggle('autoScreenInsights', t('notchSettings.selection'), t('notchSettings.selectionHint'))}
      {toggle('notchFollowUps', t('notchSettings.followUps'), t('notchSettings.followUpsHint'))}
      <Row title={t('notchSettings.light')} description={t('notchSettings.lightHint')}>
        <Switch
          size="sm"
          checked={settings.surfaceTheme === 'light'}
          aria-label={t('notchSettings.light')}
          onCheckedChange={(value) => save({ surfaceTheme: value === true ? 'light' : 'dark' })}
        />
      </Row>
    </div>
  )
}

function Row({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  )
}
