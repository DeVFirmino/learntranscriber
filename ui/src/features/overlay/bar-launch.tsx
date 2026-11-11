import { BrandMark3D } from '@/components/brand'
import { useT } from '@/use-t'
import './bar-launch.css'

// The launch intro in the bar's place: the app mark in a round pill that widens to say it is starting.
export function BarLaunch() {
  const { t } = useT()
  return (
    <div role="status" aria-live="polite" className="bar-launch">
      <BrandMark3D className="bar-launch-mark size-7" />
      <span className="bar-launch-text">{t('overlay.starting')}</span>
    </div>
  )
}
