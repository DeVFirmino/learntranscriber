import { ActionButton } from '@/components/ui/action-button'
import { useState } from 'react'
import { Field } from '@/components/chrome'
import { Button } from '@/components/ui/button'
import { DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useWorkspace } from '@/workspace'
import { useT } from '@/use-t'

export function SessionRenameDialog({ id, title }: { id: string; title: string }) {
  const ws = useWorkspace()
  const { t } = useT()
  const [draft, setDraft] = useState(title)
  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        void ws.act(async () => {
          await ws.api.renameSession({ id, title: draft })
          ws.setDialog(null)
        })
      }}
    >
      <DialogHeader>
        <DialogTitle>{t('sessions.rename')}</DialogTitle>
      </DialogHeader>
      <Field label={t('sessionRename.label')}>
        <Input value={draft} maxLength={200} autoFocus required onChange={(event) => setDraft(event.target.value)} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => ws.setDialog(null)}>
          {t('data.cancel')}
        </Button>
        <ActionButton type="submit" disabled={!draft.trim() || draft.trim() === title}>
          {t('common.save')}
        </ActionButton>
      </div>
    </form>
  )
}
