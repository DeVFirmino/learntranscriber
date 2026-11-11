import { useState, useEffect, type ComponentProps } from 'react'
import { ComposerHeader } from './composer-header'
import { QuestionForm } from './question-form'

export function CompactComposer(props: ComponentProps<typeof QuestionForm>) {
  const [minimized, setMinimized] = useState(false)
  useEffect(() => {
    const show = () => setMinimized(false)
    window.addEventListener('floating-compose', show)
    window.addEventListener('floating-ask', show)
    return () => {
      window.removeEventListener('floating-compose', show)
      window.removeEventListener('floating-ask', show)
    }
  }, [])
  const restore = () => {
    setMinimized(false)
    window.setTimeout(() => props.questionRef.current?.focus(), 0)
  }
  if (minimized)
    return (
      <div className="p-2" data-composer-minimized>
        <ComposerHeader compact minimized onToggle={restore} onClose={props.onClose} />
      </div>
    )
  return <QuestionForm {...props} compact onMinimize={() => setMinimized(true)} />
}
