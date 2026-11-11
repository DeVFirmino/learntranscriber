import type { BuilderReply } from '@/bridge/types/assistants'
import { useT } from '@/use-t'

// What the builder looked up: the library assistants it found, or the assistant it opened for editing.
export function BuilderResults({ results }: { results: BuilderReply['results'] }) {
  const { t } = useT()
  return results.map((result, index) =>
    result.tool === 'search_assistant_library' ? (
      <div key={index} className="grid gap-1" aria-label={t('builder.library')}>
        <p className="text-xs font-medium text-muted-foreground">{t('builder.library')}</p>
        {result.assistants.length ? (
          result.assistants.map((item) => (
            <p key={item.id} className="text-sm">
              {item.name} <span className="text-xs text-muted-foreground">· {item.category}</span>
            </p>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">{t('assistants.noMatch')}</p>
        )}
      </div>
    ) : (
      <p key={index} className="text-xs text-muted-foreground">
        {t('builder.opened', { name: result.assistant.name })}
      </p>
    ),
  )
}
