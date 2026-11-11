import { useState } from 'react'
import { FolderOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { useWorkspace } from '@/workspace'
import { useT } from '@/use-t'

const FOLDERS = [
  { name: 'data', label: 'data.appData', description: 'data.appDataDescription' },
  { name: 'logs', label: 'data.logs', description: 'data.logsDescription' },
] as const

export function AppFolders() {
  const ws = useWorkspace()
  const { t } = useT()
  const [failed, setFailed] = useState(false)
  const reveal = async (name: 'data' | 'logs') => {
    setFailed(false)
    try {
      await ws.api.revealAppFolder(name)
    } catch {
      setFailed(true)
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          {t('data.filesTitle')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border">
          {FOLDERS.map((folder) => (
            <li
              key={folder.name}
              className="flex flex-col items-start justify-between gap-3 py-5 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
            >
              <div className="min-w-0">
                <h3 className="text-sm font-semibold">{t(folder.label)}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{t(folder.description)}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => void reveal(folder.name)}
                aria-label={t('data.openFolder', { name: t(folder.label) })}
              >
                <FolderOpen aria-hidden="true" className="size-4" />
                {t('data.showInFinder')}
              </Button>
            </li>
          ))}
        </ul>
        {failed ? (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {t('data.folderFailed')}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
