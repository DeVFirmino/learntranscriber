// The idle placeholder: every line is empty, only dots or an ellipsis, or "listening", after any list
// marker. The model answers this way when it has nothing to say, so the floating surfaces never show it, even while
// it streams in.
export function isSilentAnswer(text: string | null | undefined): boolean {
  return String(text ?? '')
    .split(/\r?\n/)
    .every((line) => {
      const value = line
        .trim()
        .replace(/^(?:[-*+•‣◦]\s+|\d+[.)]\s+)/, '')
        .trim()
      return !value || /^(?:\.|…)+$/.test(value) || /^listening(?:\.{3}|…)?$/i.test(value)
    })
}
