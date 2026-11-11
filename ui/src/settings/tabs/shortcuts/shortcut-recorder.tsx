import { useCallback, useEffect, useRef, useState } from 'react'
import { onActivationKey } from '@/features/keyboard-activation'
import { displayKeys } from '@/features/shortcut-display'
import { recordedAccelerator } from '@/features/shortcut-keys'
import { useT } from '@/use-t'
import { useSettingsT } from '../../use-settings-t'
import { Keys } from './shortcut-keys-display'

// How the recorder writes arrows and the keys with a symbol.
const KEY_SYMBOLS: Record<string, string> = {
  Up: '↑',
  Down: '↓',
  Left: '←',
  Right: '→',
  Enter: '↵',
  Escape: 'Esc',
}

// What the recorder shows: the keys pressed so far while it records, the saved keys, or a hint when there are none.
function RecorderContent({ recording, pressed, keys }: { recording: boolean; pressed: string[]; keys: string[] }) {
  const { st } = useSettingsT()
  const { t } = useT()
  if (recording && pressed.length) return <Keys keys={pressed} recording />
  if (recording) return <span className="shortcut-recorder-empty">{t('shortcuts.pressKeys')}</span>
  if (keys.length) return <Keys keys={keys} recording={false} />
  return <span className="shortcut-recorder-empty">{st('settings.shortcuts.notBound')}</span>
}

// The shortcut recorder: click to record, press keys, Escape or a click outside cancels.
export function ShortcutRecorder({
  name,
  value,
  disabled,
  onRecord,
}: {
  name: string
  value: string
  disabled: boolean
  onRecord: (accelerator: string) => boolean
}) {
  const { t } = useT()
  const [recording, setRecording] = useState(false)
  const [pressed, setPressed] = useState<string[]>([])
  const ref = useRef<HTMLDivElement>(null)
  const start = () => {
    if (disabled) return
    setRecording(true)
    setPressed([])
  }
  const stop = useCallback(() => {
    setRecording(false)
    setPressed([])
  }, [])
  useEffect(() => {
    if (!recording) return
    const outside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) stop()
    }
    const key = (event: KeyboardEvent) => {
      event.preventDefault()
      event.stopPropagation()
      if (event.key === 'Escape') return stop()
      const accelerator = recordedAccelerator(event)
      if (!accelerator) return
      setPressed(displayKeys(accelerator).map((part) => KEY_SYMBOLS[part] || part))
      if (onRecord(accelerator)) window.setTimeout(stop, 300)
    }
    document.addEventListener('mousedown', outside)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('mousedown', outside)
      document.removeEventListener('keydown', key)
    }
  }, [recording, onRecord, stop])
  const keys = displayKeys(value)
  return (
    <div ref={ref} className="shortcut-recorder">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-label={keys.length ? `${name}: ${keys.join(' + ')}` : name}
        className={`shortcut-recorder-display${recording ? ' is-recording' : ''}`}
        title={keys.join(' + ')}
        onClick={start}
        onKeyDown={recording ? undefined : onActivationKey(start)}
      >
        <RecorderContent recording={recording} pressed={pressed} keys={keys} />
      </div>
      {recording ? (
        <span role="status" className="sr-only">
          {t('shortcuts.recording')}
        </span>
      ) : (
        <button onClick={start} disabled={disabled} className="glass-button-small shortcut-recorder-change">
          {t('shortcuts.change')}
        </button>
      )}
    </div>
  )
}
