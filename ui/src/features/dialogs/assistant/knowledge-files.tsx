import { useRef, useState } from 'react'
import { FileUp } from 'lucide-react'
import type { KnowledgeFile } from '@/bridge/types/assistants'
import { extractPdf } from '@/assistant-knowledge'
import { Button } from '@/components/ui/button'
import { errorMessage } from '@/format'
import { useT } from '@/use-t'
import { contentProblem, fileProblem } from './assistant-fields'
import { ContextCard } from './context-card'

const ACCEPTED =
  '.txt,.md,.json,.js,.jsx,.ts,.tsx,.css,.html,.xml,.csv,.log,.py,.java,.c,.cpp,.h,.swift,.kt,.go,.rs,.rb,.php,.sh,.pdf'

// The Upload Files card: Add File reads the picked text, code or PDF files one by one, each joining as soon as it is
// read; a file that cannot join is reported by name. Saving waits while files are read.
export function KnowledgeFiles({
  files,
  onFiles,
  onReading,
}: {
  files: KnowledgeFile[]
  onFiles: (change: (files: KnowledgeFile[]) => KnowledgeFile[]) => void
  onReading: (reading: boolean) => void
}) {
  const { t } = useT()
  const picker = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(files.length > 0)
  const [reading, setReading] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const read = (input: HTMLInputElement) => {
    const picked = [...(input.files || [])]
    if (!picked.length) return
    setOpen(true)
    setReading(true)
    onReading(true)
    setErrors([])
    void (async () => {
      const next = [...files]
      const failed: string[] = []
      for (const file of picked) {
        try {
          const problem = fileProblem(file, next.length)
          if (problem) throw new Error(t(problem))
          const content =
            file.type === 'application/pdf' || /\.pdf$/i.test(file.name) ? await extractPdf(file) : await file.text()
          const unreadable = contentProblem(content, next)
          if (unreadable) throw new Error(t(unreadable))
          next.push({ name: file.name, content, size: file.size })
          onFiles(() => [...next])
        } catch (error) {
          failed.push(`${file.name}: ${errorMessage(error)}`)
        }
      }
      setErrors(failed)
      input.value = ''
      setReading(false)
      onReading(false)
    })()
  }
  return (
    <ContextCard
      icon={<FileUp className="size-4 shrink-0 text-primary" aria-hidden="true" />}
      title={t('assistantDialog.uploadFiles')}
      open={open}
      onOpen={setOpen}
      action={
        <>
          <input
            ref={picker}
            type="file"
            multiple
            hidden
            accept={ACCEPTED}
            aria-label={t('assistantDialog.uploadFiles')}
            onChange={(event) => read(event.currentTarget)}
          />
          <Button type="button" variant="outline" size="sm" disabled={reading} onClick={() => picker.current?.click()}>
            {t('assistantDialog.addFile')}
          </Button>
        </>
      }
    >
      <p className="text-xs leading-relaxed text-muted-foreground">{t('assistantDialog.filesHint')}</p>
      {reading ? <p className="text-sm text-muted-foreground">{t('assistantDialog.reading')}</p> : null}
      {errors.map((error, index) => (
        <p key={`${index}-${error}`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ))}
      {files.map((file, index) => (
        <div
          key={`${index}-${file.name}`}
          className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
        >
          <span className="min-w-0 truncate">
            {t('assistantDialog.fileSize', {
              name: file.name,
              size: file.size.toLocaleString(document.documentElement.lang || undefined),
            })}
          </span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={reading}
            onClick={() => onFiles((current) => current.filter((_, item) => item !== index))}
          >
            {t('common.remove')}
          </Button>
        </div>
      ))}
    </ContextCard>
  )
}
