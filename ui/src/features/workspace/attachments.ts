export interface PendingImage {
  id: string
  data: string
}

const bytes = (value: string) => Math.floor(((value.length - value.indexOf(',') - 1) * 3) / 4)

// Up to four PNG or JPEG screenshots, each under 8 MB and 24 MB together, wait for the next question.
export function appendScreenshot(
  current: PendingImage[],
  data: string,
  check: { isSafeScreenshot(value: string): boolean; newId(): string },
): PendingImage[] {
  if (!check.isSafeScreenshot(data) || bytes(data) > 8_000_000)
    throw new Error('Choose a PNG screenshot smaller than 8 MB.')
  if (current.length >= 4) throw new Error('Attach at most four screenshots.')
  if (current.reduce((sum, item) => sum + bytes(item.data), 0) + bytes(data) > 24_000_000)
    throw new Error('The attached screenshots are too large.')
  return [...current, { id: check.newId(), data }]
}
