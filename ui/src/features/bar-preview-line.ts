export interface PreviewLine {
  speaker: 'me' | 'them'
  text: string
}

export interface PreviewCaptions {
  me: string
  them: string
}

const MAX_PREVIEW = 160

// Live captions keyed by speaker, reduced to the user's and the other side's current text.
export function previewCaptions(live: Record<string, string>): PreviewCaptions {
  const captions = { me: '', them: '' }
  for (const [speaker, text] of Object.entries(live)) {
    const value = text.trim()
    if (value) captions[speaker === 'ME' ? 'me' : 'them'] = value
  }
  return captions
}

// The caption that just changed is shown, the other side first when both
// changed. An unchanged caption keeps the line already shown, and with no live caption the row falls back to the
// last saved transcript line.
export function nextPreviewLine(
  previous: PreviewCaptions,
  current: PreviewCaptions,
  shown: PreviewLine | null,
): PreviewLine | null {
  if (current.them && current.them !== previous.them) return { speaker: 'them', text: current.them }
  if (current.me && current.me !== previous.me) return { speaker: 'me', text: current.me }
  return current.me || current.them ? shown : null
}

// A single row shows the newest words of a long line.
export function previewTail(text: string, max = MAX_PREVIEW) {
  const value = text.trim()
  return value.length > max ? '…' + value.slice(-max).trimStart() : value
}
