/**
 * Repairs common UTF-8 mojibake patterns caused by interpreting UTF-8 bytes as Latin-1/Windows-1252.
 * For example, a right single quote (U+2019) encoded as UTF-8 (0xE2 0x80 0x99) but read as
 * Latin-1 produces the three-character sequence â€™.
 */
export function fixMojibake(text: string): string {
  if (!text) return ''

  const replacements: [string, string][] = [
    ['â€™', '\u2019'],  // right single quote / apostrophe
    ['â€˜', '\u2018'],  // left single quote
    ['â€œ', '\u201C'],  // left double quote
    ['â€\u009D', '\u201D'],  // right double quote
    ['â€"', '\u2014'],  // em dash
    ['â€"', '\u2013'],  // en dash
    ['â€¦', '\u2026'],  // ellipsis
    ['Â©', '©'],        // copyright
    ['Â®', '®'],        // registered
    ['Â ', ' '],        // non-breaking space artifact
  ]

  let result = text
  for (const [pattern, replacement] of replacements) {
    result = result.split(pattern).join(replacement)
  }

  // Normalize smart quotes to straight quotes for maximum readability
  result = result
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')

  return result
}
