/**
 * Sanitizes HTML content for use in the RichTextEditor
 * Removes problematic CSS variables and data attributes that can break the editor
 */
export function sanitizeHtmlForEditor(html: string): string {
  if (!html) return ''
  
  console.log('🧹 Sanitizing HTML:', html.substring(0, 200) + '...')
  
  // Create a temporary div to parse and clean the HTML
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = html
  
  // Remove all elements with data-start or data-end attributes
  const elementsWithDataAttrs = tempDiv.querySelectorAll('[data-start], [data-end]')
  elementsWithDataAttrs.forEach(el => {
    el.removeAttribute('data-start')
    el.removeAttribute('data-end')
  })
  
  // Clean up all style attributes that contain CSS variables
  const elementsWithStyle = tempDiv.querySelectorAll('[style]')
  elementsWithStyle.forEach(el => {
    const styleAttr = el.getAttribute('style')
    if (styleAttr) {
      // Remove CSS variables (--tw-*, etc.)
      const cleanedStyle = styleAttr
        .split(';')
        .filter(rule => !rule.trim().startsWith('--'))
        .join(';')
      
      if (cleanedStyle.trim()) {
        el.setAttribute('style', cleanedStyle)
      } else {
        el.removeAttribute('style')
      }
    }
  })
  
  // Remove empty class attributes
  const elementsWithClass = tempDiv.querySelectorAll('[class]')
  elementsWithClass.forEach(el => {
    const classAttr = el.getAttribute('class')
    if (classAttr && !classAttr.trim()) {
      el.removeAttribute('class')
    }
  })
  
  const sanitized = tempDiv.innerHTML
  console.log('✅ Sanitized HTML:', sanitized.substring(0, 200) + '...')
  
  return sanitized
}