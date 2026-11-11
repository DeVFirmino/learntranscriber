import { DropdownMenu as Menu } from 'radix-ui'
import { Plus, ScanText, TextCursorInput, ClipboardPaste } from 'lucide-react'
import { BrandCapture } from '@/components/brand-icon'
import { Button } from '@/components/ui/button'
import { useWorkspace } from '@/workspace'
import { useT } from '@/use-t'

type Workspace = ReturnType<typeof useWorkspace>
type Translate = ReturnType<typeof useT>['t']

async function attachText(ws: Workspace, action: 'screen-text' | 'selection', t: Translate) {
  await ws.ensureSession()
  const value = action === 'screen-text' ? await ws.api.screenText() : await ws.api.selectedText()
  if (!value.text?.trim()) throw new Error(action === 'selection' ? t('session.selectFirst') : t('session.noText'))
  ws.setPendingText({
    text: value.text,
    sessionId: value.sessionId,
    label:
      action === 'screen-text'
        ? t('session.screenText')
        : t('session.selectedText') + (value.application ? ` · ${value.application}` : ''),
  })
}

export function ChatAttachments({ onPaste }: { onPaste: () => void }) {
  const ws = useWorkspace()
  const { t } = useT()
  const item =
    'flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm outline-none data-[highlighted]:bg-accent data-[disabled]:pointer-events-none data-[disabled]:opacity-40'
  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label={t('session.attachMenu')}
          title={t('session.attachMenu')}
        >
          <Plus aria-hidden="true" className="size-5" />
        </Button>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          side="top"
          align="start"
          sideOffset={8}
          collisionPadding={12}
          className="z-50 min-w-56 max-w-[calc(100vw-24px)] rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg"
        >
          <Menu.Item
            className={item}
            disabled={ws.captureState?.phase === 'capturing'}
            onSelect={() => void ws.act(() => ws.captureScreen())}
          >
            <BrandCapture className="size-4" aria-hidden="true" />
            {t('home.capture')}
          </Menu.Item>
          <Menu.Item className={item} onSelect={() => void ws.act(() => attachText(ws, 'screen-text', t))}>
            <ScanText className="size-4" aria-hidden="true" />
            {t('session.extract')}
          </Menu.Item>
          <Menu.Item className={item} onSelect={() => void ws.act(() => attachText(ws, 'selection', t))}>
            <TextCursorInput className="size-4" aria-hidden="true" />
            {t('session.readSelection')}
          </Menu.Item>
          <Menu.Separator className="my-1 h-px bg-border" />
          <Menu.Item className={item} onSelect={onPaste}>
            <ClipboardPaste className="size-4" aria-hidden="true" />
            {t('session.paste')}
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  )
}
