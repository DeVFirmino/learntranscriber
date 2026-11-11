import { displayKeys } from '@/features/shortcut-display'

// The keys of an accelerator as keycaps; nothing when the shortcut is unbound.
export function ShortcutKeys({ accelerator }: { accelerator: string }) {
  const keys = displayKeys(accelerator)
  if (!keys.length) return null
  return (
    <span className="inline-flex gap-1" aria-label={keys.join(' ')}>
      {keys.map((key, index) => (
        <kbd key={index} data-slot="kbd" className="bg-background/15 px-1 font-sans text-[11px] font-semibold">
          {key}
        </kbd>
      ))}
    </span>
  )
}
