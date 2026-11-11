import { Check, ChevronDown } from 'lucide-react'
import { DropdownMenu } from 'radix-ui'
import type { PublicState } from '@/bridge/types/state'
import { AssistantGlyph } from '@/features/assistants/assistant-glyph'
import { useT } from '@/use-t'
import { useWorkspace } from '@/workspace'

const ITEM = 'flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 outline-none focus:bg-accent'

// The assistant the next session starts with, changed in place; the library stays one item away for anything more.
export function AssistantMenu({ state }: { state: PublicState }) {
  const ws = useWorkspace()
  const { t } = useT()
  const current = state.assistants.find((item) => item.id === state.settings.assistantId)
  const name = current?.name || t('home.noAssistant')
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="home-start-assistant mt-2" aria-label={t('home.selectAssistant', { name })}>
        {current ? <AssistantGlyph id={current.id} className="size-5 shrink-0 text-foreground" /> : null}
        <span>{name}</span>
        <ChevronDown aria-hidden="true" className="size-3.5 shrink-0" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={6}
          collisionPadding={12}
          className="z-50 grid max-h-[min(360px,var(--radix-dropdown-menu-content-available-height))] min-w-64 gap-0.5 overflow-y-auto rounded-xl border bg-popover p-1 text-sm text-popover-foreground shadow-lg"
        >
          {state.assistants.map((assistant) => (
            <DropdownMenu.Item
              key={assistant.id}
              className={ITEM}
              onSelect={() => void ws.act(() => ws.api.settings({ assistantId: assistant.id }).then(() => undefined))}
            >
              <AssistantGlyph id={assistant.id} className="size-5 shrink-0 text-foreground" />
              <span className="min-w-0 flex-1 truncate">{assistant.name}</span>
              {assistant.id === state.settings.assistantId ? (
                <Check aria-hidden="true" className="size-4 shrink-0 text-primary" />
              ) : null}
            </DropdownMenu.Item>
          ))}
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Item asChild className={ITEM}>
            <a href="#assistants">{t('overlay.manageAssistants')}</a>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
