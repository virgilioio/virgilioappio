import { marked } from 'marked'

// Detects whether a string contains common Markdown syntax
function containsMarkdown(text: string): boolean {
  if (!text) return false
  const patterns = [
    /(^|\s)[*_]{1,2}.+?[*_]{1,2}($|\s)/, // *bold* or **bold** or _em_
    /(^|\n)\s*[-*+]\s+.+/,               // unordered list
    /(^|\n)\s*\d+\.\s+.+/,             // ordered list
    /\[[^\]]+\]\([^\)]+\)/,           // [link](url)
    /(^|\n)\s*#{1,6}\s+.+/,             // headings
  ]
  return patterns.some((re) => re.test(text))
}

/**
 * Converts Markdown-ish input to HTML. Handles these cases:
 * - Pure Markdown -> converts to HTML
 * - HTML that only wraps Markdown (e.g., a single <p> with **bold**) -> unwraps, converts, and returns HTML
 * - Proper HTML with semantic tags already -> returns as-is
 */
export function markdownToHtml(input: string): string {
  if (!input) return ''

  // Easy path: no HTML tags present at all -> treat as Markdown
  const hasHtmlTags = /<\/?[a-z][\s\S]*>/i.test(input)
  if (!hasHtmlTags) {
    return renderMarkdown(input)
  }

  // If it has HTML, check if it's just a thin wrapper (p/div/span) around Markdown-like text
  const temp = document.createElement('div')
  temp.innerHTML = input

  const hasSemanticHtml = !!temp.querySelector('strong, b, em, i, u, ul, ol, li, a, h1, h2, h3, h4, h5, h6, blockquote, pre, code, hr')

  // If semantic HTML exists, assume it's already formatted HTML
  if (hasSemanticHtml) return input

  // Extract plain text and see if it contains Markdown tokens
  const plain = temp.textContent || temp.innerText || ''
  if (containsMarkdown(plain)) {
    return renderMarkdown(plain)
  }

  // Otherwise, return the original HTML
  return input
}

function renderMarkdown(text: string): string {
  try {
    marked.setOptions({ gfm: true, breaks: true })
    const html = marked.parse(text)
    return typeof html === 'string' ? html : ''
  } catch (e) {
    console.warn('Markdown parse failed, returning original text', e)
    return text
  }
}
