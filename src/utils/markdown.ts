import { marked } from 'marked'

/**
 * Converts Markdown to HTML. If the input already contains HTML tags, it is returned as-is.
 */
export function markdownToHtml(input: string): string {
  if (!input) return ''
  // Simple heuristic: if it looks like HTML already, don't convert
  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(input)
  if (looksLikeHtml) return input
  try {
    // Configure marked for safe, basic GFM parsing
    marked.setOptions({
      gfm: true,
      breaks: true
    })
    const html = marked.parse(input)
    // marked.parse can return string | Promise<string> depending on version; coerce to string
    return typeof html === 'string' ? html : ''
  } catch (e) {
    console.warn('Markdown parse failed, returning original text', e)
    return input
  }
}
