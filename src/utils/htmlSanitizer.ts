import DOMPurify from 'dompurify'
import { fixMojibake } from './fixMojibake'

/**
 * Ensures all <a> tags have target="_blank" and rel="noopener noreferrer"
 */
function ensureLinksOpenNewTab(html: string): string {
  if (!html) return ''
  try {
    const div = document.createElement('div')
    div.innerHTML = html
    div.querySelectorAll('a').forEach(a => {
      if (!a.getAttribute('target')) a.setAttribute('target', '_blank')
      if (!a.getAttribute('rel')) a.setAttribute('rel', 'noopener noreferrer')
    })
    return div.innerHTML
  } catch {
    return html
  }
}

/**
 * Sanitizes HTML content for safe display, preventing XSS attacks
 * Uses DOMPurify for robust HTML sanitization
 */
export function sanitizeHtml(html: string): string {
  if (!html) {
    return ''
  }

  // Fix mojibake before sanitizing
  html = fixMojibake(html)
  
  // Configure DOMPurify to allow basic formatting tags while preventing XSS
  const config = {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'a', 'span', 'div', 'blockquote', 'pre', 'code', 'hr', 'table',
      'thead', 'tbody', 'tfoot', 'tr', 'th', 'td'
    ],
    ALLOWED_ATTR: ['href', 'title', 'class', 'target', 'rel', 'colspan', 'rowspan', 'data-placeholder', 'contenteditable'],
    ALLOW_DATA_ATTR: false,
    // Critical: Block dangerous tags including script and iframe
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'link', 'style', 'img', 'svg', 'form', 'input'],
    FORBID_ATTR: ['on*'], // Block all event handlers
    KEEP_CONTENT: true,
    RETURN_DOM: false
  }
  
  const sanitized = DOMPurify.sanitize(html, config)
  
  // Ensure all <a> tags open in new tab
  const withTargets = ensureLinksOpenNewTab(sanitized)
  return normalizeTypography(withTargets)
}

/**
 * Normalizes typography by removing inline font styles and ensuring consistent text presentation
 */
function normalizeTypography(html: string): string {
  if (!html) return ''
  
  try {
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = html
    
    // Remove all font-related inline styles and normalize spacing
    const allElements = tempDiv.querySelectorAll('*')
    allElements.forEach(el => {
      // Remove style attributes completely (they're already forbidden in DOMPurify config)
      el.removeAttribute('style')
      
      // Remove font-related attributes that might exist
      el.removeAttribute('face')
      el.removeAttribute('size')
      el.removeAttribute('color')
      
      // Normalize excessive nested spans that often come from Word/Google Docs
      if (el.tagName === 'SPAN' && !el.hasAttributes() && el.children.length === 0) {
        // Replace empty spans with their text content
        const textContent = el.textContent || ''
        if (textContent.trim()) {
          el.outerHTML = textContent
        } else {
          el.remove()
        }
      }
    })
    
    // Clean up excessive whitespace that often comes with pasted content
    let cleanedHtml = tempDiv.innerHTML
    
    // Normalize multiple consecutive spaces
    cleanedHtml = cleanedHtml.replace(/\s+/g, ' ')
    
    // Clean up empty paragraphs and divs
    cleanedHtml = cleanedHtml.replace(/<p\s*><\/p>/gi, '')
    cleanedHtml = cleanedHtml.replace(/<div\s*><\/div>/gi, '')
    
    // Ensure content is wrapped in paragraphs if it's not already structured
    const testDiv = document.createElement('div')
    testDiv.innerHTML = cleanedHtml
    const hasBlockElements = testDiv.querySelector('p, div, h1, h2, h3, h4, h5, h6, ul, ol, blockquote')
    
    if (!hasBlockElements && cleanedHtml.trim()) {
      // Wrap plain text content in paragraphs
      const lines = cleanedHtml.split(/\n+/).filter(line => line.trim())
      if (lines.length > 0) {
        cleanedHtml = lines.map(line => `<p>${line.trim()}</p>`).join('')
      }
    }
    
    return cleanedHtml
  } catch (error) {
    console.warn('Error normalizing typography:', error)
    return html
  }
}

/**
 * Sanitizes HTML content for use in the RichTextEditor
 * Removes problematic CSS variables and data attributes that can break the editor
 */
export function sanitizeHtmlForEditor(html: string): string {
  if (!html) {
    if (import.meta.env.DEV) {
      console.debug('Empty HTML content provided to sanitizer')
    }
    return ''
  }
  
  if (import.meta.env.DEV) {
    console.debug('Sanitizing HTML for editor', { length: html.length })
  }
  
  try {
    // First sanitize with DOMPurify for security
    const secureHtml = sanitizeHtml(html)
    
    // Create a temporary div to parse and clean the HTML for editor compatibility
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = secureHtml
    
    // Remove all problematic data attributes
    const elementsWithDataAttrs = tempDiv.querySelectorAll('[data-start], [data-end], [data-slate-node], [data-slate-inline], [data-slate-void]')
    elementsWithDataAttrs.forEach(el => {
      el.removeAttribute('data-start')
      el.removeAttribute('data-end')
      el.removeAttribute('data-slate-node')
      el.removeAttribute('data-slate-inline')
      el.removeAttribute('data-slate-void')
    })
    
    // Clean up all style attributes that contain CSS variables or problematic styles
    const elementsWithStyle = tempDiv.querySelectorAll('[style]')
    elementsWithStyle.forEach(el => {
      const styleAttr = el.getAttribute('style')
      if (styleAttr) {
        // Remove CSS variables and problematic styles
        const cleanedStyle = styleAttr
          .split(';')
          .filter(rule => {
            const trimmedRule = rule.trim()
            return trimmedRule && 
                   !trimmedRule.startsWith('--') && 
                   !trimmedRule.includes('--tw-') &&
                   !trimmedRule.includes('--chakra-') &&
                   !trimmedRule.includes('transform:') &&
                   !trimmedRule.includes('transition:')
          })
          .join(';')
        
        if (cleanedStyle.trim()) {
          el.setAttribute('style', cleanedStyle)
        } else {
          el.removeAttribute('style')
        }
      }
    })
    
    // Remove empty class attributes and problematic classes
    const elementsWithClass = tempDiv.querySelectorAll('[class]')
    elementsWithClass.forEach(el => {
      const classAttr = el.getAttribute('class')
      if (classAttr) {
        const cleanedClasses = classAttr
          .split(' ')
          .filter(cls => cls.trim() && !cls.includes('slate-') && !cls.includes('chakra-'))
          .join(' ')
        
        if (cleanedClasses.trim()) {
          el.setAttribute('class', cleanedClasses)
        } else {
          el.removeAttribute('class')
        }
      }
    })
    
    // Remove problematic attributes that can interfere with editors
    const allElements = tempDiv.querySelectorAll('*')
    allElements.forEach(el => {
      // Remove contenteditable attributes (except on placeholder badges)
      if (!el.classList.contains('placeholder-badge')) {
        el.removeAttribute('contenteditable')
      }
      el.removeAttribute('spellcheck')
      
      // Remove any remaining data attributes that start with problematic prefixes
      Array.from(el.attributes).forEach(attr => {
        if (attr.name.startsWith('data-slate') || 
            attr.name.startsWith('data-lexical') ||
            attr.name.startsWith('data-editor')) {
          el.removeAttribute(attr.name)
        }
      })
    })
    
    const sanitized = tempDiv.innerHTML
    
    if (import.meta.env.DEV) {
      console.debug('Sanitized HTML for editor', { finalLength: sanitized.length })
    }
    
    // Validate the sanitized content is not empty
    if (!sanitized || sanitized.trim() === '') {
      if (import.meta.env.DEV) {
        console.error('Sanitization resulted in empty content')
      }
      return extractPlainTextFallback(html)
    }
    
    return sanitized
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('Error during HTML sanitization:', error)
    }
    return extractPlainTextFallback(html)
  }
}

/**
 * Fallback function to extract plain text from HTML if sanitization fails
 */
function extractPlainTextFallback(html: string): string {
  try {
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = html
    const plainText = tempDiv.textContent || tempDiv.innerText || ''
    if (import.meta.env.DEV) {
      console.debug('Using plain text fallback', { length: plainText.length })
    }
    return `<p>${plainText}</p>`
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('Plain text extraction failed:', error)
    }
    return '<p>Error: Could not process template content</p>'
  }
}