import { sanitizeHtml } from '@/utils/htmlSanitizer'
import { cn } from '@/lib/utils'

interface SafeHtmlProps {
  content: string
  className?: string
  onClick?: () => void
  style?: React.CSSProperties
}

/**
 * SafeHtml component that sanitizes HTML content before rendering
 * Prevents XSS attacks by using DOMPurify sanitization
 */
export function SafeHtml({ content, className, onClick, style }: SafeHtmlProps) {
  const sanitizedContent = sanitizeHtml(content)
  
  return (
    <div 
      className={cn(className)}
      onClick={onClick}
      style={style}
      dangerouslySetInnerHTML={{ __html: sanitizedContent }}
    />
  )
}