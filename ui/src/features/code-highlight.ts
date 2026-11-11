import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import python from 'highlight.js/lib/languages/python'
import csharp from 'highlight.js/lib/languages/csharp'
import bash from 'highlight.js/lib/languages/bash'
import sql from 'highlight.js/lib/languages/sql'
import json from 'highlight.js/lib/languages/json'
import css from 'highlight.js/lib/languages/css'
import xml from 'highlight.js/lib/languages/xml'
import swift from 'highlight.js/lib/languages/swift'
import java from 'highlight.js/lib/languages/java'
import cpp from 'highlight.js/lib/languages/cpp'
import go from 'highlight.js/lib/languages/go'
import rust from 'highlight.js/lib/languages/rust'
import yaml from 'highlight.js/lib/languages/yaml'

for (const [name, grammar] of Object.entries({
  javascript,
  typescript,
  python,
  csharp,
  bash,
  sql,
  json,
  css,
  xml,
  swift,
  java,
  cpp,
  go,
  rust,
  yaml,
}))
  hljs.registerLanguage(name, grammar)

const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Only the bundled tokenizer produces markup. Unknown languages and large blocks stay readable as plain text.
export function highlightCode(code: string, language: string): string {
  if (code.length > 50000 || !language || !hljs.getLanguage(language)) return escape(code)
  return hljs.highlight(code, { language, ignoreIllegals: true }).value
}
