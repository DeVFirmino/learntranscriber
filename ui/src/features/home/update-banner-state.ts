import type { UpdateStatus } from '@/bridge/types/updates'

export interface UpdateBannerView {
  visible: boolean
  version: string
}

// What the Home banner shows: hidden while loading or when nothing is available, otherwise the version to read,
// falling back to the raw tag (its v-prefix dropped) if the main process ever omits the parsed version.
export function updateBannerView(status: UpdateStatus | null): UpdateBannerView {
  if (!status?.available) return { visible: false, version: '' }
  return { visible: true, version: status.version || status.tagName?.replace(/^v/i, '') || '' }
}
