import type { UpdateStatus } from '@/bridge/types/updates'

export interface UpdateBannerView {
  visible: boolean
  version: string
  phase: 'idle' | 'downloading' | 'ready' | 'failed'
  // Whole percent of the download, or null while its size is unknown.
  percent: number | null
  error: string | null
}

// What the Home banner shows: hidden while loading or when nothing is available, otherwise the version to read,
// falling back to the raw tag (its v-prefix dropped) if the main process ever omits the parsed version.
export function updateBannerView(status: UpdateStatus | null): UpdateBannerView {
  if (!status?.available) return { visible: false, version: '', phase: 'idle', percent: null, error: null }
  const download = status.download
  const progress = download?.progress
  return {
    visible: true,
    version: status.version || status.tagName?.replace(/^v/i, '') || '',
    phase: download?.phase || 'idle',
    percent: typeof progress === 'number' ? Math.round(Math.min(Math.max(progress, 0), 1) * 100) : null,
    error: download?.phase === 'failed' ? download.error : null,
  }
}
