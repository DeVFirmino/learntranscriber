import { useState } from 'react'
import { useT } from '@/use-t'
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item'
import { vocabularyEdit, VOCABULARY_LIMIT } from '@/features/settings/vocabulary'
import { SettingsIcon } from '../../settings-icon'
import './audio-device-panel.css'

// Vocabulary: names and terms for local Whisper and cloud transcription to expect, saved on blur like the other
// audio settings. Apple Speech never reads it, so the hint says so.
export function VocabularyPane({ value, onSave }: { value: string; onSave: (next: string) => void }) {
  const { t } = useT()
  const [text, setText] = useState(value)
  // A saved value that changes elsewhere (another window, a reload) replaces the field, in the same render.
  const [savedFor, setSavedFor] = useState(value)
  if (savedFor !== value) {
    setText(value)
    setSavedFor(value)
  }
  return (
    <div className="audio-device-panel">
      <Item className="p-0">
        <ItemMedia className="audio-device-tile">
          <SettingsIcon name="text_fields" />
        </ItemMedia>
        <ItemContent className="min-w-0">
          <ItemTitle>{t('audio.vocabulary')}</ItemTitle>
          <ItemDescription>{t('audio.vocabularyHint')}</ItemDescription>
        </ItemContent>
      </Item>
      <textarea
        className="vocabulary-input"
        rows={3}
        maxLength={VOCABULARY_LIMIT}
        value={text}
        placeholder={t('audio.vocabularyPlaceholder')}
        aria-label={t('audio.vocabulary')}
        onChange={(event) => setText(event.target.value)}
        onBlur={() => {
          const next = vocabularyEdit(text, value)
          if (next !== null) onSave(next)
          else setText(value)
        }}
      />
    </div>
  )
}
