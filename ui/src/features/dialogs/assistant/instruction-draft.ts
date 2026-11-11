// What the editor asks the assistant builder for: instructions for this name and category, from what the box holds.
// The editor's default category says nothing about the assistant, so it is left out.
export function draftQuestion({ name, category, brief }: { name: string; category: string; brief: string }) {
  const kind = category.trim().toLocaleLowerCase() === 'uncategorized' ? '' : category.trim()
  const subject = [name.trim() && `named "${name.trim()}"`, kind && `in the "${kind}" category`]
    .filter(Boolean)
    .join(' ')
  return `Write the system instructions for an assistant${subject ? ` ${subject}` : ''}. What it should do: ${brief.trim()}`
}

// A typed category that matches an existing one apart from case or spacing takes the existing spelling, so the
// library never gains "General" beside "general".
export function canonicalCategory(value: string, existing: string[]) {
  const typed = value.trim().replace(/\s+/g, ' ')
  const match = existing.find((name) => name.toLocaleLowerCase() === typed.toLocaleLowerCase())
  return match ?? typed
}
