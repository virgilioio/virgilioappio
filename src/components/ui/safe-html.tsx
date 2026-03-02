import { sanitizeHtml } from '@/utils/htmlSanitizer'
import { cn } from '@/lib/utils'

interface SafeHtmlProps {
  content: string
  className?: string
  onClick?: () => void
  style?: React.CSSProperties
}

/**
 * Linkifies plain-text URLs in HTML that aren't already inside <a> tags.
 * Uses TreeWalker to only modify text nodes, avoiding attribute corruption.
 */
function linkifyUrls(html: string): string {
  if (!html) return ''
  try {
    const div = document.createElement('div')
    div.innerHTML = html
    const walker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT, null)
    const textNodes: Text[] = []
    let current: Text | null
    while ((current = walker.nextNode() as Text | null)) {
      // Skip text nodes inside <a> tags
      if (current.parentElement?.closest('a')) continue
      if (/https?:\/\/[^\s<]+/.test(current.textContent || '')) {
        textNodes.push(current)
      }
    }
    textNodes.forEach(node => {
      const frag = document.createDocumentFragment()
      const text = node.textContent || ''
      let lastIndex = 0
      const urlRegex = /(https?:\/\/[^\s<]+)/g
      let match: RegExpExecArray | null
      while ((match = urlRegex.exec(text)) !== null) {
        if (match.index > lastIndex) {
          frag.appendChild(document.createTextNode(text.slice(lastIndex, match.index)))
        }
        const a = document.createElement('a')
        a.href = match[1]
        a.target = '_blank'
        a.rel = 'noopener noreferrer'
        a.textContent = match[1]
        frag.appendChild(a)
        lastIndex = urlRegex.lastIndex
      }
      if (lastIndex < text.length) {
        frag.appendChild(document.createTextNode(text.slice(lastIndex)))
      }
      node.parentNode?.replaceChild(frag, node)
    })
    return div.innerHTML
  } catch {
    return html
  }
}

/**
 * SafeHtml component that sanitizes HTML content before rendering
 * Prevents XSS attacks by using DOMPurify sanitization
 */
export function SafeHtml({ content, className, onClick, style }: SafeHtmlProps) {
  const sanitizedContent = linkifyUrls(sanitizeHtml(content))
  
  return (
    <div 
      className={cn(className)}
      onClick={onClick}
      style={style}
      dangerouslySetInnerHTML={{ __html: sanitizedContent }}
    />
  )
}