// Limits for an image pasted into the question box: the file itself, then the decoded picture.
export const MAX_PASTED_BYTES = 8_000_000
export const MAX_PASTED_PIXELS = 100_000_000

// Each reason a pasted image is refused is the locale key of the message shown for it.
export type PasteProblem = 'session.tooLarge' | 'session.tooBig' | 'session.notPrepared'

export function pastedImageItem<T extends { type: string }>(items: Iterable<T>) {
  return [...items].find((item) => item.type.startsWith('image/'))
}

export function fileProblem(bytes: number): PasteProblem | null {
  return bytes > MAX_PASTED_BYTES ? 'session.tooLarge' : null
}

export function pictureProblem(width: number, height: number): PasteProblem | null {
  return width * height > MAX_PASTED_PIXELS ? 'session.tooBig' : null
}

// Redraws the pasted image as a PNG data URL, or returns why it cannot be attached.
export async function pastedImageToPng(file: Blob): Promise<{ image: string } | { problem: PasteProblem }> {
  const tooLarge = fileProblem(file.size)
  if (tooLarge) return { problem: tooLarge }
  const bitmap = await createImageBitmap(file)
  try {
    const tooBig = pictureProblem(bitmap.width, bitmap.height)
    if (tooBig) return { problem: tooBig }
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const context = canvas.getContext('2d')
    if (!context) return { problem: 'session.notPrepared' }
    context.drawImage(bitmap, 0, 0)
    return { image: canvas.toDataURL('image/png') }
  } finally {
    bitmap.close()
  }
}
