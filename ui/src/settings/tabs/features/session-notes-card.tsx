import { useEffect, useState } from 'react'
import { BrandTranscript } from '@/components/brand-icon'
import { useWorkspace } from '@/workspace'
import { useT } from '@/use-t'
import { PreferenceField } from '@/components/ui/preference-field'
import { Button } from '@/components/ui/button'

// Where a stopped session's summary and handoff is saved: LearnTranscriber/Sessions in Documents, or a chosen folder.
export function SessionNotesCard({ folder }: { folder: string }) {
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
    </PreferenceField>
  )
}
