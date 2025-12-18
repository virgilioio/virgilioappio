/**
 * Placeholder Badge Utilities
 * Handles bidirectional conversion between {{placeholder}} text and visual badge HTML
 */

// Convert {{placeholder}} to badge HTML (idempotent - safe to call multiple times)
export function convertPlaceholdersToHtml(text: string): string {
  // First normalize: strip any existing badges back to plain {{placeholder}}
  // This makes the function idempotent - calling it multiple times is safe
  const normalized = convertHtmlToPlaceholders(text);
  
  // Pattern: {{anything.anything}} or {{anything}}
  const placeholderRegex = /\{\{([^}]+)\}\}/g;
  
  return normalized.replace(placeholderRegex, (match, placeholder) => {
    return `<span 
      class="placeholder-badge" 
      contenteditable="false" 
      data-placeholder="${placeholder.trim()}"
    >{{${placeholder.trim()}}}</span>`;
  });
}

// Convert badge HTML back to {{placeholder}}
export function convertHtmlToPlaceholders(html: string): string {
  // Remove badge spans, keep only the placeholder text
  let result = html.replace(
    /<span[^>]*class="[^"]*placeholder-badge[^"]*"[^>]*data-placeholder="([^"]*)"[^>]*>.*?<\/span>/g,
    (match, placeholder) => `{{${placeholder}}}`
  );
  
  // Convert &nbsp; entities to regular spaces
  result = result.replace(/&nbsp;/g, ' ');
  
  return result;
}

// Check if text contains placeholders
export function containsPlaceholders(text: string): boolean {
  return /\{\{([^}]+)\}\}/.test(text) || text.includes('placeholder-badge');
}

// List of available placeholders with descriptions
// IMPORTANT: 'value' is now the NORMALIZED key (no braces) to prevent double-brace bugs
export const AVAILABLE_PLACEHOLDERS = [
  { value: 'candidate.name', label: 'Candidate Name', category: 'Candidate' },
  { value: 'candidate.first_name', label: 'Candidate First Name', category: 'Candidate' },
  { value: 'candidate.email', label: 'Candidate Email', category: 'Candidate' },
  { value: 'candidate.phone', label: 'Candidate Phone', category: 'Candidate' },
  { value: 'candidate.location', label: 'Candidate Location', category: 'Candidate' },
  { value: 'job.title', label: 'Job Title', category: 'Job' },
  { value: 'job.department', label: 'Job Department', category: 'Job' },
  { value: 'job.location', label: 'Job Location', category: 'Job' },
  { value: 'sender.name', label: 'Your Name', category: 'Sender' },
  { value: 'sender.first_name', label: 'Your First Name', category: 'Sender' },
  { value: 'sender.last_name', label: 'Your Last Name', category: 'Sender' },
  { value: 'sender.email', label: 'Your Email', category: 'Sender' },
  { value: 'sender.title', label: 'Your Job Title', category: 'Sender' },
  { value: 'sender.phone', label: 'Your Phone', category: 'Sender' },
  { value: 'sender.linkedin', label: 'Your LinkedIn URL', category: 'Sender' },
  { value: 'sender.booking_link', label: 'Your Booking Link', category: 'Sender' },
];
