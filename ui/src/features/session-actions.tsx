import { DropdownMenu as Menu } from 'radix-ui'
import { ChevronDownIcon, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { SessionDetail } from '@/bridge/types/sessions'
import { useWorkspace } from '@/workspace'
import { useT } from '@/use-t'
import { sessionCopyText, writeSessionClipboard, type CopyLabels, type SessionCopyKind } from './session-clipboard'

export function SessionActions({
  session,
  active,
  summaryDraft,
}: {
  session: SessionDetail
  active: boolean
  summaryDraft: string | null
}) {
  const ws = useWorkspace()
  const { t } = useT()
  const summary = summaryDraft ?? session.summary
  const labels: CopyLabels = {
    untitled: t('session.copyUntitled'),
    provider: t('session.copyProvider'),
    model: t('session.copyModel'),
    started: t('session.copyStarted'),
    ended: t('session.copyEnded'),
    unknown: t('session.copyUnknown'),
    inProgress: t('session.copyInProgress'),
    you: t('session.copyYou'),
    assistant: t('session.copyAssistant'),
    others: t('session.copyOthers'),
  }
  const itemClass =
    'cursor-default rounded-sm px-3 py-2 text-sm outline-none data-[highlighted]:bg-accent data-[disabled]:pointer-events-none data-[disabled]:opacity-40'
  const copy = (kind: SessionCopyKind) =>
    void ws.act(async () => {
      if (!(await writeSessionClipboard(sessionCopyText(session, kind, labels, active, summary))))
        throw new Error(t('session.copyFailed'))
    })
  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <Button variant="outline">
          <Copy className="size-4" aria-hidden="true" />
          {t('session.copyActions')}
          <ChevronDownIcon aria-hidden="true" />
        </Button>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          align="end"
          sideOffset={6}
          collisionPadding={12}
          className="z-50 min-w-52 max-w-[calc(100vw-24px)] rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg"
        >
          <Menu.Item className={itemClass} disabled={!summary.trim()} onSelect={() => copy('summary')}>
            {t('session.copySummary')}
          </Menu.Item>
          <Menu.Item
            className={itemClass}
            disabled={!session.entries.some((entry) => entry.kind !== 'transcript')}
            onSelect={() => copy('chat')}
          >
            {t('session.copyChat')}
          </Menu.Item>
          <Menu.Item
            className={itemClass}
            disabled={!session.entries.some((entry) => entry.kind === 'transcript')}
            onSelect={() => copy('transcript')}
          >
            {t('session.copyTranscript')}
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  )
}
