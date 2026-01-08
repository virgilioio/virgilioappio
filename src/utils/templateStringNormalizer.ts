/**
 * Normalizes any input (HTML or plain text) into the BodyTemplateEditor's expected format:
 * - Plain text with \n between paragraphs
 * - Preserves {{placeholder}} tokens
 * - Never returns HTML tags
 */
export function normalizeToTemplateString(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return '';
  }

  // Check if input contains HTML tags
  const hasHtml = /<\/?[a-z][\s\S]*>/i.test(trimmed);

  if (hasHtml) {
    return convertHtmlToTemplateString(trimmed);
  }

  // Plain text - just normalize whitespace
  return normalizePlainText(trimmed);
}

/**
 * Converts HTML content to a template string with newline-delimited paragraphs
 */
function convertHtmlToTemplateString(html: string): string {
  // Create a temporary DOM element to parse HTML
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  const lines: string[] = [];
  
  // Process the body content
  processNode(doc.body, lines);
  
  // Join lines, normalize multiple newlines, and trim
  return lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n') // Collapse 3+ newlines to 2
    .replace(/^\n+|\n+$/g, '') // Trim leading/trailing newlines
    .trim();
}

/**
 * Recursively processes DOM nodes to extract text with proper paragraph breaks
 */
function processNode(node: Node, lines: string[]): void {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent?.trim();
      if (text) {
        // Append to the last line if it exists, otherwise create new line
        if (lines.length > 0 && lines[lines.length - 1] !== '') {
          lines[lines.length - 1] += ' ' + text;
        } else {
          lines.push(text);
        }
      }
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const element = child as Element;
      const tagName = element.tagName.toLowerCase();
      
      // Block-level elements that create paragraph breaks
      const blockElements = ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'section', 'article'];
      
      if (tagName === 'br') {
        // <br> creates a line break within the current context
        lines.push('');
      } else if (blockElements.includes(tagName)) {
        // Block elements start a new paragraph
        const textContent = element.textContent?.trim();
        if (textContent) {
          lines.push(textContent);
        }
        lines.push(''); // Add blank line after block elements for paragraph separation
      } else {
        // Inline elements - process children
        processNode(element, lines);
      }
    }
  }
}

/**
 * Normalizes plain text by cleaning up whitespace while preserving paragraph structure
 */
function normalizePlainText(text: string): string {
  return text
    .replace(/\r\n/g, '\n') // Normalize CRLF to LF
    .replace(/\r/g, '\n') // Normalize CR to LF
    .replace(/[ \t]+$/gm, '') // Trim trailing whitespace per line
    .replace(/\n{3,}/g, '\n\n') // Collapse 3+ newlines to 2
    .trim();
}
