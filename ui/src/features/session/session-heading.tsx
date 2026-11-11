import { ActionButton } from '@/components/ui/action-button'
import { useState } from 'react'
import type { SessionDetail } from '@/bridge/types/sessions'
import { Sparkles } from 'lucide-react'
import { BrandAudio } from '@/components/brand-icon'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, PageHeading } from '@/components/chrome'
import { AssistantGlyph } from '@/features/assistants/assistant-glyph'
import { providerName } from '@/features/home/home-overview'
import { errorMessage, formatDate } from '@/format'
import { ProviderIcon } from '@/settings/settings-icon'
import { useWorkspace } from '@/workspace'
import { useT } from '@/use-t'

// The session's title, which a click turns into a rename form, its actions, and one line naming the assistant and the
// models it used. Mount it with `key={session.id}` so a rename in progress never carries over to another session.
export function SessionHeading({ session }: { session: SessionDetail }) {
  const ws = useWorkspace()
  const { t } = useT()
  const [editingTitle, setEditingTitle] = useState(false)
  // The AI route as Home names it: a brand, the local model, or a custom endpoint.
  const providerLabel = (provider: string) =>
    providerName(provider) ?? (provider === 'local' ? t('home.localModel') : t('home.customProvider'))
  const [titleDraft, setTitleDraft] = useState('')
  const [titleSaving, setTitleSaving] = useState(false)
  const [titleError, setTitleError] = useState('')
  const saveTitle = async () => {
    if (titleSaving || !titleDraft.trim()) return
    setTitleSaving(true)
    setTitleError('')
    try {
      await ws.api.renameSession({ id: session.id, title: titleDraft })
      await ws.refreshSession()
      setEditingTitle(false)
    } catch (error) {
      setTitleError(errorMessage(error))
    } finally {
      setTitleSaving(false)
    }
  }
  return (
    <header className="session-heading">
      <PageHeading
        title={session.title}
        description={formatDate(session.started_at)}
        onTitleClick={() => {
          setTitleDraft(session.title)
          setTitleError('')
          setEditingTitle(true)
        }}
      />
      <ul className="session-meta" aria-label={t('session.modelInfo')}>
        <li>
          <AssistantGlyph id={session.assistant_id} className="size-4 text-primary" />
          <span className="text-foreground">{session.assistant_name || t('session.assistantUnknown')}</span>
        </li>
        <li>
          {session.provider && providerName(session.provider) ? (
            <ProviderIcon providerId={session.provider} />
          ) : (
            <Sparkles aria-hidden="true" />
          )}
          {t('session.ai', {
            route: session.provider
              ? `${providerLabel(session.provider)} · ${session.model || t('session.modelUnknown')}`
              : t('session.routeUnknown'),
          })}
        </li>
        <li>
          <BrandAudio aria-hidden="true" />
          {t('session.transcription', { model: session.transcription_model || t('session.unknown') })}
        </li>
      </ul>
      {editingTitle ? (
        <form
          className="mb-4 flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            void saveTitle()
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              setEditingTitle(false)
              setTitleError('')
            }
          }}
        >
          <Field label={t('session.titleLabel')}>
            <Input
              autoFocus
              className="min-w-64"
              value={titleDraft}
              maxLength={120}
              disabled={titleSaving}
              onChange={(event) => setTitleDraft(event.target.value)}
            />
          </Field>
          <ActionButton type="submit" disabled={titleSaving || !titleDraft.trim()}>
            {titleSaving ? t('common.saving') : t('common.save')}
          </ActionButton>
          <Button
            type="button"
            variant="outline"
            disabled={titleSaving}
            onClick={() => {
              setEditingTitle(false)
              setTitleError('')
            }}
          >
            {t('data.cancel')}
          </Button>
          {titleError ? (
            <p className="basis-full text-sm text-destructive" role="alert">
              {titleError}
            </p>
          ) : null}
        </form>
      ) : null}
    </header>
  )
}
