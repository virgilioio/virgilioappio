/**
 * Template Utilities
 * Robust placeholder normalization and rendering for email templates
 */

/**
 * Normalize a placeholder key by stripping leading/trailing braces and whitespace
 * Examples:
 *   "{{ first_name }}" -> "first_name"
 *   "{{first_name}}" -> "first_name"
 *   "first_name" -> "first_name"
 *   "{{{{first_name}}}}" -> "first_name"
 */
export function normalizePlaceholderKey(input: string): string {
  if (!input) return '';
  
  let result = input.trim();
  
  // Loop until no more braces can be stripped (handles multiple layers like {{{{key}}}})
  let prevLength = -1;
  while (result.length !== prevLength) {
    prevLength = result.length;
    // Strip leading {{
    while (result.startsWith('{{')) {
      result = result.slice(2);
    }
    // Strip trailing }}
    while (result.endsWith('}}')) {
      result = result.slice(0, -2);
    }
    // Strip single braces too (malformed)
    while (result.startsWith('{')) {
      result = result.slice(1);
    }
    while (result.endsWith('}')) {
      result = result.slice(0, -1);
    }
    result = result.trim();
  }
  
  return result;
}

/**
 * Collapse accidental double braces in a template string
 * "Hi {{{{first_name}}}}" -> "Hi {{first_name}}"
 * Loops until stable to handle extreme cases
 */
export function collapseDoubleBraces(template: string): string {
  if (!template) return '';
  
  let result = template;
  let prevResult = '';
  
  // Loop until no changes (handles {{{{{{key}}}}}} etc.)
  while (result !== prevResult) {
    prevResult = result;
    // Replace {{{{ with {{
    result = result.replace(/\{\{\{\{/g, '{{');
    // Replace }}}} with }}
    result = result.replace(/\}\}\}\}/g, '}}');
  }
  
  return result;
}

/**
 * Placeholder data map for template rendering
 */
export interface PlaceholderData {
  // Candidate fields
  'candidate.name'?: string;
  'candidate.first_name'?: string;
  'candidate.email'?: string;
  'candidate.phone'?: string;
  'candidate.location'?: string;
  
  // Job fields
  'job.title'?: string;
  'job.department'?: string;
  'job.location'?: string;
  
  // Sender fields
  'sender.name'?: string;
  'sender.first_name'?: string;
  'sender.last_name'?: string;
  'sender.email'?: string;
  'sender.title'?: string;
  'sender.phone'?: string;
  'sender.linkedin'?: string;
  'sender.booking_link'?: string;
  
  // Organization / tenant fields
  'organization.name'?: string;
  'department.name'?: string;
  
  // Allow additional custom keys
  [key: string]: string | undefined;
}

/**
 * Render a template by replacing all placeholders with values from data
 * 
 * This function:
 * 1. First collapses any double braces from legacy content
 * 2. Replaces ALL {{key}} tokens with values (whitespace-tolerant)
 * 3. Returns clean text with no remaining braces around values
 * 
 * @param template - Template string with {{placeholder}} tokens
 * @param data - Key-value map of placeholder values
 * @returns Rendered string with placeholders replaced
 */
export function renderTemplate(template: string, data: PlaceholderData): string {
  if (!template) return '';
  
  // Step 1: Collapse any accidental double braces first
  let result = collapseDoubleBraces(template);
  
  // Step 2: Clean up HTML entities
  result = result
    .replace(/&nbsp;/g, ' ')
    .replace(/\u00A0/g, ' ');
  
  // Step 3: Replace all placeholder tokens
  // Pattern matches {{ key }} with optional whitespace
  result = result.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (match, key) => {
    const normalizedKey = key.trim();
    const value = data[normalizedKey];
    return value !== undefined ? value : '';
  });
  
  return result;
}

/**
 * List of available placeholders with normalized keys (no braces)
 * Use this for placeholder pickers - keys should NOT include braces
 */
export const PLACEHOLDER_OPTIONS = [
  { key: 'candidate.name', label: 'Candidate Name', category: 'Candidate' },
  { key: 'candidate.first_name', label: 'Candidate First Name', category: 'Candidate' },
  { key: 'candidate.email', label: 'Candidate Email', category: 'Candidate' },
  { key: 'candidate.phone', label: 'Candidate Phone', category: 'Candidate' },
  { key: 'candidate.location', label: 'Candidate Location', category: 'Candidate' },
  { key: 'job.title', label: 'Job Title', category: 'Job' },
  { key: 'job.department', label: 'Job Department', category: 'Job' },
  { key: 'job.location', label: 'Job Location', category: 'Job' },
  { key: 'sender.name', label: 'Your Name', category: 'Sender' },
  { key: 'sender.first_name', label: 'Your First Name', category: 'Sender' },
  { key: 'sender.last_name', label: 'Your Last Name', category: 'Sender' },
  { key: 'sender.email', label: 'Your Email', category: 'Sender' },
  { key: 'sender.title', label: 'Your Job Title', category: 'Sender' },
  { key: 'sender.phone', label: 'Your Phone', category: 'Sender' },
  { key: 'sender.linkedin', label: 'Your LinkedIn URL', category: 'Sender' },
  { key: 'sender.booking_link', label: 'Your Booking Link', category: 'Sender' },
  { key: 'stage.booking_link', label: 'Stage Interviewer Booking Link', category: 'Stage' },
  { key: 'organization.name', label: 'Company / Workspace Name', category: 'Organization' },
  { key: 'department.name', label: 'Department / Job Folder Name', category: 'Organization' },
];

/**
 * Helper to build PlaceholderData from candidate, job, and sender objects
 */
export function buildPlaceholderData(options: {
  candidate?: {
    candidate_name?: string;
    email?: string;
    phone?: string;
    location_city?: string;
    location_state?: string;
    location_country?: string;
  };
  job?: {
    title?: string;
    department?: string;
    location?: string;
  };
  sender?: {
    first_name?: string;
    last_name?: string;
    email?: string;
    title?: string;
    phone?: string;
    linkedin_url?: string;
  };
  bookingLink?: string;
}): PlaceholderData {
  const { candidate, job, sender, bookingLink } = options;
  
  const data: PlaceholderData = {};
  
  if (candidate) {
    data['candidate.name'] = candidate.candidate_name || '';
    // Extract first name from full name
    const firstName = candidate.candidate_name?.split(' ')[0] || '';
    data['candidate.first_name'] = firstName;
    data['candidate.email'] = candidate.email || '';
    data['candidate.phone'] = candidate.phone || '';
    data['candidate.location'] = [
      candidate.location_city,
      candidate.location_state,
      candidate.location_country
    ].filter(Boolean).join(', ') || '';
  }
  
  if (job) {
    data['job.title'] = job.title || '';
    data['job.department'] = job.department || '';
    data['job.location'] = job.location || '';
  }
  
  if (sender) {
    const fullName = [sender.first_name, sender.last_name].filter(Boolean).join(' ');
    data['sender.name'] = fullName || sender.email || '';
    data['sender.first_name'] = sender.first_name || '';
    data['sender.last_name'] = sender.last_name || '';
    data['sender.email'] = sender.email || '';
    data['sender.title'] = sender.title || '';
    data['sender.phone'] = sender.phone || '';
    data['sender.linkedin'] = sender.linkedin_url || '';
  }
  
  if (bookingLink) {
    data['sender.booking_link'] = bookingLink;
  }
  
  return data;
}
