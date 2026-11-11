import { Dialog, DialogContent } from '@/components/ui/dialog'
import { useWorkspace } from '@/workspace'
import { AssistantDialog } from './assistant-dialog'
import { AssistantImportDialog } from './assistant-import-dialog'
import { AssistantDeleteDialog } from './assistant-delete-dialog'
import { SessionDeleteDialog } from './session-delete-dialog'
import { SessionRenameDialog } from './session-rename-dialog'

export function WorkspaceDialogs() {
  const ws = useWorkspace()
  const dialog = ws.dialog
  if (!dialog || !ws.state) return null
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) ws.setDialog(null)
      }}
    >
      {/* The full assistant editor is wider, so name and category share a row and its context cards sit side by side. */}
      <DialogContent
        className={`max-h-[85vh] overflow-auto ${dialog.type === 'assistant' && !dialog.systemPromptOnly ? 'sm:max-w-2xl' : 'sm:max-w-lg'}`}
      >
        {dialog.type === 'assistant' ? (
          <AssistantDialog
            id={dialog.id}
            category={dialog.category}
            draft={dialog.draft}
            systemPromptOnly={dialog.systemPromptOnly}
            reviewSource={dialog.reviewSource}
          />
        ) : null}
        {dialog.type === 'assistant-import' ? <AssistantImportDialog /> : null}
        {dialog.type === 'assistant-delete' ? <AssistantDeleteDialog id={dialog.id} /> : null}
        {dialog.type === 'session-rename' ? <SessionRenameDialog id={dialog.id} title={dialog.title} /> : null}
        {dialog.type === 'session-delete' ? <SessionDeleteDialog ids={dialog.ids} title={dialog.title} /> : null}
      </DialogContent>
    </Dialog>
  )
}
