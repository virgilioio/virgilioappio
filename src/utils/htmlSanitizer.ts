/**
 * Sanitizes HTML content for use in the RichTextEditor
 * Removes problematic CSS variables and data attributes that can break the editor
 */
export function sanitizeHtmlForEditor(html: string): string {
  if (!html) {
    console.warn('⚠️ Empty HTML content provided to sanitizer')
    return ''
  }
  
  console.log('🧹 Sanitizing HTML:', html.substring(0, 200) + '...', `Total length: ${html.length}`)
  
  try {
    // Create a temporary div to parse and clean the HTML
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = html
    
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
      // Remove contenteditable attributes
      el.removeAttribute('contenteditable')
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
    console.log('✅ Sanitized HTML:', sanitized.substring(0, 200) + '...', `Final length: ${sanitized.length}`)
    
    // Validate the sanitized content is not empty
    if (!sanitized || sanitized.trim() === '') {
      console.error('❌ Sanitization resulted in empty content')
      return extractPlainTextFallback(html)
    }
    
    return sanitized
  } catch (error) {
    console.error('❌ Error during HTML sanitization:', error)
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
    console.log('🔄 Using plain text fallback:', plainText.substring(0, 100) + '...')
    return `<p>${plainText}</p>`
  } catch (error) {
    console.error('❌ Even plain text extraction failed:', error)
    return '<p>Error: Could not process template content</p>'
  }
}