import { AlertDialog } from 'radix-ui'
import type { HistoryStats } from '@/bridge/types/sessions'
import { Button } from '@/components/ui/button'
import { useT } from '@/use-t'

export function ClearConfirmation({
  open,
  onOpenChange,
  onRestoreFocus,
  stats,
  disabled,
  onClear,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onRestoreFocus: () => void
  stats: HistoryStats
  disabled: boolean
  onClear: () => void
}) {
  const { t } = useT()
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <AlertDialog.Content
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            onRestoreFocus()
          }}
          className="data-clear-dialog fixed top-1/2 left-1/2 z-50 grid w-[calc(100vw-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 rounded-2xl border bg-popover p-6 text-popover-foreground shadow-xl"
        >
          <AlertDialog.Title className="text-lg font-semibold">{t('data.confirmTitle')}</AlertDialog.Title>
          <AlertDialog.Description className="text-sm leading-relaxed text-muted-foreground">
            {t('data.confirmDescription', {
              sessions: stats.totalSessions,
              messages: stats.totalMessages,
              transcripts: stats.totalTranscriptions,
            })}
          </AlertDialog.Description>
          <div className="mt-2 flex flex-wrap justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button type="button" variant="outline">
                {t('data.cancel')}
              </Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button type="button" variant="destructive" disabled={disabled} onClick={onClear}>
                {t('data.confirmAction')}
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
