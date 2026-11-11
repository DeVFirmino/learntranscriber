function formatKnowledge(manual, files = []) {
  const parts = [];
  if (manual?.trim()) parts.push(manual.trim());
  for (const file of files) {
    let longest = 0;
    for (const match of file.content.matchAll(/`+/g)) longest = Math.max(longest, match[0].length);
    const fence = '`'.repeat(Math.max(3, longest + 1));
    parts.push(`### File: ${file.name}\n${fence}\n${file.content}\n${fence}`);
  }
  return parts.join('\n\n');
}
module.exports = { formatKnowledge };
