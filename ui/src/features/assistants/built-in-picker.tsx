import { ActionButton } from '@/components/ui/action-button'
import { useState } from 'react'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { MessageKey } from '@/i18n'
import { useT } from '@/use-t'
import { useWorkspace } from '@/workspace'
import { AssistantGlyph } from './assistant-glyph'
import { canSaveSelection, initialBuiltInSelection, toggleSelection } from './built-in-selection'
import { useCategoryLabel } from './use-category-label'

// The onboarding's assistant step: tick the built-in assistants to keep. Unticked ones leave the library and can be
// brought back here later.
export function BuiltInPicker({ onDone }: { onDone: () => void }) {
  const ws = useWorkspace()
  const { t } = useT()
  const categoryLabel = useCategoryLabel()
  const state = ws.state
  const [selected, setSelected] = useState(() => (state ? initialBuiltInSelection(state) : []))
  if (!state) return null
  return (
    <Card className="mb-6" aria-label={t('builtIns.title')}>
      <CardHeader>
        <CardTitle>{t('builtIns.title')}</CardTitle>
        <p className="mt-2 max-w-[70ch] text-sm text-muted-foreground">{t('builtIns.hint')}</p>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-3 min-[760px]:grid-cols-2 min-[1100px]:grid-cols-3" role="group">
          {state.builtInAssistants.map((item) => {
            const checked = selected.includes(item.id)
            return (
              <button
                key={item.id}
                type="button"
                role="checkbox"
                aria-checked={checked}
                data-built-in-choice={item.id}
                onClick={() => setSelected((current) => toggleSelection(current, item.id))}
                className={`flex min-w-0 items-start gap-3 rounded-xl border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-ring ${checked ? 'border-primary/70 bg-primary/10' : 'border-border hover:bg-accent/40'}`}
              >
                <AssistantGlyph id={item.id} className="size-8 shrink-0 text-foreground" />
                <span className="grid min-w-0 flex-1 gap-1">
                  <strong className="text-sm">{item.name}</strong>
                  <span className="text-xs text-muted-foreground">{categoryLabel(item.category)}</span>
                  <span className="text-sm text-muted-foreground">
                    {t(`builtIns.summary.${item.id}` as MessageKey)}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className={`grid size-5 shrink-0 place-items-center rounded-md border ${checked ? 'border-primary bg-primary text-primary-foreground' : 'border-border'}`}
                >
                  {checked ? <Check className="size-3.5" /> : null}
                </span>
              </button>
            )
          })}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onDone}>
            {t('data.cancel')}
          </Button>
          <ActionButton
            type="button"
            disabled={!canSaveSelection(state, selected)}
            onClick={() =>
              void ws.act(async () => {
                await ws.api.chooseBuiltInAssistants(selected)
                onDone()
              })
            }
          >
            {t('builtIns.save', { count: String(selected.length) })}
          </ActionButton>
        </div>
      </CardContent>
    </Card>
  )
}
