import { Button } from '@/components/ui/button'
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useWorkspace } from '@/workspace'
import { useT } from '@/use-t'

// Confirms deleting one session, named, or a selection of several, which go together.
export function SessionDeleteDialog({ ids, title }: { ids: string[]; title?: string }) {
  const ws = useWorkspace()
  const { t } = useT()
  const one = ids.length === 1
  return (
    <div className="grid gap-4">
      <DialogHeader>
        <DialogTitle>
          {one ? t('sessionDelete.title') : t('sessionDelete.titleMany', { count: ids.length })}
        </DialogTitle>
        <DialogDescription>
          {one ? t('sessionDelete.hint', { name: title || '' }) : t('sessionDelete.hintMany')}
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
              if (one) await ws.api.deleteSession(ids[0])
              else await ws.api.deleteSessions(ids)
              ws.setDialog(null)
            })
          }
        >
          {one ? t('sessionDelete.confirm') : t('sessionDelete.confirmMany', { count: ids.length })}
        </Button>
      </div>
    </div>
  )
}
