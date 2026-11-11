// A question as the comparison sees it: trimmed, lowercase, without its final punctuation or repeated spaces.
export const questionKey = (text: string) =>
  text
    .trim()
    .toLowerCase()
    .replace(/[?!.]+$/, '')
    .replace(/\s+/g, ' ')

// A sentence that opens with an interrogative word in Portuguese, English or Spanish.
const INTERROGATIVE =
  /^¿?(o que|que|qual|quais|quando|onde|como|por que|porque|quem|quanto|quantos|você|voce|vocês|pode|poderia|what|why|how|when|where|who|which|can|could|would|do|does|did|are|is|will|qué|cómo|cuándo|dónde|por qué|quién|cuál|cuánto|puedes|podría)(?=\s|$)/i

/** The last question in the text, or '' when there is none. */
export function lastQuestion(text: string) {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean)
  for (let index = sentences.length - 1; index >= 0; index--) {
    const sentence = sentences[index]
    if (sentence.endsWith('?') || (INTERROGATIVE.test(sentence) && sentence.split(/\s+/).length >= 3)) return sentence
  }
  return ''
}
