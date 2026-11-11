export function canSendQuestion({
  question,
  hasImages,
  busy,
  ready,
}: {
  question: string
  hasImages: boolean
  busy: boolean
  ready: boolean
}): boolean {
  return ready && !busy && (Boolean(question.trim()) || hasImages)
}
