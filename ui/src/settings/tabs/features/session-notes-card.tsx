import { useEffect, useState } from 'react'
import { BrandTranscript } from '@/components/brand-icon'
import { useWorkspace } from '@/workspace'
import { useT } from '@/use-t'
import { PreferenceField } from '@/components/ui/preference-field'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Settings } from '@/bridge/types/settings'

const TEMPLATES: Settings['sessionNoteTemplate'][] = ['general', 'standup', 'oneOnOne', 'interview', 'lecture']

// Where a stopped session's summary and handoff is saved: LearnTranscriber/Sessions in Documents, or a chosen folder,
// and which sections the note asks for.
export function SessionNotesCard({ folder, template }: { folder: string; template: Settings['sessionNoteTemplate'] }) {
  const ws = useWorkspace()
  const { t } = useT()
  const [shown, setShown] = useState('')
  useEffect(() => {
    let alive = true
    void ws.api.sessionNotesFolder().then((value) => {
      if (alive) setShown(value)
    })
    return () => {
      alive = false
    }
  }, [ws.api, folder])
  return (
    <PreferenceField
      id="session-notes-folder"
      icon={<BrandTranscript />}
      title={t('note.folderTitle')}
      description={t('note.folderDescription')}
    >
      <p className="mt-2 truncate text-xs text-muted-foreground" title={shown}>
        {shown}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button
          className="glass-button-small"
          variant="outline"
          size="sm"
          onClick={() => void ws.act(async () => setShown(await ws.api.chooseSessionNotesFolder()))}
        >
          {t('note.chooseFolder')}
        </Button>
        {folder ? (
          <Button
            className="glass-button-small"
            variant="outline"
            size="sm"
            onClick={() =>
              void ws.act(async () => {
                await ws.api.settings({ sessionNotesFolder: '' })
              })
            }
          >
            {t('note.defaultFolder')}
          </Button>
        ) : null}
      </div>
      <p id="session-note-template-label" className="mt-4 text-sm font-medium">
        {t('note.templateTitle')}
      </p>
      <p id="session-note-template-description" className="mt-1 text-xs text-muted-foreground">
        {t('note.templateDescription')}
      </p>
      <Select
        value={template}
        onValueChange={(value) =>
          void ws.act(async () => {
            await ws.api.settings({ sessionNoteTemplate: value as Settings['sessionNoteTemplate'] })
          })
        }
      >
        <SelectTrigger
          className="mt-2 w-60"
          aria-labelledby="session-note-template-label"
          aria-describedby="session-note-template-description"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" align="start">
          {TEMPLATES.map((id) => (
            <SelectItem value={id} key={id}>
              {t(`note.template.${id}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </PreferenceField>
  )
}
