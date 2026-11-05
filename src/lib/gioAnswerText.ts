/**
 * A Gio answer (light Markdown) as clean text for Copy (2026-11-05): headings, bullets
 * and line breaks kept, no #, *, _ or --- left behind, so it pastes cleanly into Slack
 * or an email. `GioAnswer` (src/components/ui/gio-answer.tsx) draws the same answer.
 */
function inline(s: string): string {
  return s
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)\s]+)[^)]*\)/g, (_m, text: string, url: string) => (text === url ? url : `${text} (${url})`))
    .replace(/`([^`]+)`/g, '$1')
    .replace(/(\*\*|__)(?=\S)([\s\S]*?\S)\1/g, '$2')
    .replace(/(^|[^\w*])\*(?=\S)([^*\n]*?\S)\*(?!\*)/g, '$1$2')
    .replace(/(^|[^\w_])_(?=\S)([^_\n]*?\S)_(?![\w_])/g, '$1$2')
    .replace(/~~(?=\S)([\s\S]*?\S)~~/g, '$1')
}

export function gioAnswerPlainText(md: string): string {
  const out: string[] = []
  for (const raw of md.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.replace(/\s+$/, '')
    // Divider: a blank line instead of ---
    if (/^\s{0,3}([-*_])(\s*\1){2,}$/.test(line)) {
      out.push('')
      continue
    }
    const h = line.match(/^\s{0,3}#{1,6}\s+(.*?)\s*#*$/)
    if (h) {
      out.push(inline(h[1]))
      continue
    }
    const bullet = line.match(/^(\s*)[-*+]\s+(.*)$/)
    if (bullet) {
      const level = Math.floor(bullet[1].replace(/\t/g, '  ').length / 2)
      out.push(`${'  '.repeat(level)}${level ? '◦' : '•'} ${inline(bullet[2])}`)
      continue
    }
    const numbered = line.match(/^(\s*)(\d+)[.)]\s+(.*)$/)
    if (numbered) {
      const level = Math.floor(numbered[1].replace(/\t/g, '  ').length / 2)
      out.push(`${'  '.repeat(level)}${numbered[2]}. ${inline(numbered[3])}`)
      continue
    }
    // Table separator rows (| --- | --- |) go; table rows keep their cells.
    if (/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(line)) continue
    if (/^\s*\|.*\|\s*$/.test(line)) {
      out.push(line.trim().replace(/^\||\|$/g, '').split('|').map((c) => inline(c.trim())).join('  ·  '))
      continue
    }
    out.push(inline(line.replace(/^\s*>\s?/, '')))
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}
