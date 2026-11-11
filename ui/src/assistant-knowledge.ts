export function textFromItems(items: Iterable<unknown>): string {
  let result = ''
  for (const item of items) {
    if (!item || typeof item !== 'object' || !('str' in item) || typeof item.str !== 'string') continue
    if (item.str) result += (result && !/[\s]$/.test(result) ? ' ' : '') + item.str
    if ('hasEOL' in item && item.hasEOL) result += '\n'
  }
  // Some PDF writers emit spaces as their own text items; collapse the doubled separators they leave.
  return result
    .replace(/[\t ]{2,}/g, ' ')
    .replace(/[\t ]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function pdfTextFromPages(pages: string[]): string {
  const text = pages
    .map((page, index) => {
      const content = page.trim()
      return content ? `${pages.length > 1 ? `[Page ${index + 1}]\n` : ''}${content}` : ''
    })
    .filter(Boolean)
    .join('\n\n')
  if (!text) throw new Error('This PDF has no extractable text. Scanned PDFs need OCR before upload.')
  return text
}

export async function extractPdf(file: File): Promise<string> {
  const [pdfjs, worker] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')])
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  return extractPdfText(pdfjs, new Uint8Array(await file.arrayBuffer()))
}

interface PdfLibrary {
  getDocument(source: { data: Uint8Array }): { promise: Promise<PdfDocument>; destroy(): Promise<void> }
}
interface PdfDocument {
  numPages: number
  getPage(number: number): Promise<{ getTextContent(): Promise<{ items: Iterable<unknown> }>; cleanup(): void }>
}

// Reads the text layer page by page; an unreadable file and a PDF without text fail with a clear message.
export async function extractPdfText(pdfjs: PdfLibrary, data: Uint8Array): Promise<string> {
  const task = pdfjs.getDocument({ data })
  try {
    const document = await task.promise
    const pages: string[] = []
    for (let number = 1; number <= document.numPages; number++) {
      const page = await document.getPage(number)
      const content = await page.getTextContent()
      pages.push(textFromItems(content.items))
      page.cleanup()
    }
    return pdfTextFromPages(pages)
  } catch (error) {
    if (error instanceof Error && /no extractable text/.test(error.message)) throw error
    throw new Error('This PDF could not be read. Export it again or upload a text file.')
  } finally {
    await task.destroy()
  }
}
