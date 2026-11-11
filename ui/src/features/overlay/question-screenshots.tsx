import { X } from 'lucide-react'
import { useWorkspace } from '@/workspace'
import { useT } from '@/use-t'

// The screenshots waiting to go with the next question in the floating Session tab, each removable.
export function QuestionScreenshots() {
  const ws = useWorkspace()
  const { t } = useT()
  if (!ws.pendingImages.length) return null
  return (
    <ul aria-label={t('session.screenshots')} className="mb-2 flex flex-wrap gap-2">
      {ws.pendingImages.map((item, index) => (
        <li key={item.id} className="relative">
          <img
            src={item.data}
            alt={t('session.screenshot', { index: index + 1 })}
            className="h-16 w-28 rounded-lg border border-white/15 bg-black/40 object-cover"
          />
          <button
            type="button"
            aria-label={t('session.removeScreenshot', { index: index + 1 })}
            title={t('session.removeScreenshot', { index: index + 1 })}
            onClick={() => ws.removePendingImage(item.id)}
            className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full border border-white/20 bg-[#14171e] text-white"
          >
            <X className="size-3" aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  )
}
