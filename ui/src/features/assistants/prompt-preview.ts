// Show the first instruction text without spending the compact preview on section headings or standalone tags.
export function promptPreview(prompt: string): string {
  const lines = prompt
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  const content = lines.filter((line) => !/^#{1,6}\s/.test(line) && !/^<\/?[\w:-]+(?:\s[^<>]*)?\/?>$/.test(line))
  return (content.length ? content : lines.map((line) => line.replace(/^#{1,6}\s+/, ''))).join(' ')
}
