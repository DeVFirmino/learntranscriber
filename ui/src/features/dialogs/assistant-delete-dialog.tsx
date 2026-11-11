import { Button } from '@/components/ui/button'
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useWorkspace } from '@/workspace'
import { useT } from '@/use-t'

export function AssistantDeleteDialog({ id }: { id: string }) {
  const ws = useWorkspace()
  const { t } = useT()
  const assistant = ws.state?.assistants.find((item) => item.id === id)
  return (
    <div className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{t('deleteDialog.title')}</DialogTitle>
        <DialogDescription>
          {t('deleteDialog.hint', { name: assistant?.name || t('deleteDialog.this') })}
        </DialogDescription>
      </DialogHeader>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => ws.setDialog(null)}>
          {t('data.cancel')}
        </Button>
        <Button
          variant="destructive"
          onClick={() =>
            void ws.act(async () => {
              await ws.api.deleteAssistant(id)
              ws.setDialog(null)
            })
          }
        >
          {t('deleteDialog.confirm')}
        </Button>
      </div>
    </div>
  )
}
