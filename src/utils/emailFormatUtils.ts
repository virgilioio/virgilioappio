import { format } from 'date-fns';
import { normalizeToTemplateString } from './templateStringNormalizer';

interface EmailData {
  id: string;
  from_address: string;
  to_addresses: string[];
  cc_addresses?: string[] | null;
  subject: string;
  body_html?: string | null;
  body_text?: string | null;
  sent_at?: string | null;
  received_at?: string | null;
  created_at: string;
}

/**
 * Extracts the original email content as a template string
 */
function getOriginalContent(email: EmailData): string {
  if (email.body_text) {
    return normalizeToTemplateString(email.body_text);
  }
  if (email.body_html) {
    return normalizeToTemplateString(email.body_html);
  }
  return '';
}

/**
 * Formats a quoted reply as a template string (newline-delimited, no HTML)
 */
export function formatQuotedReply(email: EmailData): string {
  const date = format(
    new Date(email.received_at || email.sent_at || email.created_at),
    "MMM d, yyyy 'at' h:mm a"
  );
  const originalContent = getOriginalContent(email);
  
  // Format as plain text with quote markers
  const quotedLines = originalContent
    .split('\n')
    .map(line => `> ${line}`)
    .join('\n');
  
  return `\n\nOn ${date}, ${email.from_address} wrote:\n${quotedLines}`;
}

/**
 * Formats a forwarded message as a template string (newline-delimited, no HTML)
 */
export function formatForwardedMessage(email: EmailData): string {
  const date = format(
    new Date(email.received_at || email.sent_at || email.created_at),
    "MMM d, yyyy 'at' h:mm a"
  );
  const originalContent = getOriginalContent(email);
  
  const ccLine = email.cc_addresses?.length 
    ? `Cc: ${email.cc_addresses.join(', ')}\n` 
    : '';
  
  return `\n\n---------- Forwarded message ----------\nFrom: ${email.from_address}\nDate: ${date}\nSubject: ${email.subject}\nTo: ${email.to_addresses.join(', ')}\n${ccLine}\n${originalContent}`;
}

export function getReplySubject(subject: string): string {
  const trimmedSubject = subject.trim();
  if (trimmedSubject.toLowerCase().startsWith('re:')) {
    return trimmedSubject;
  }
  return `Re: ${trimmedSubject}`;
}

export function getForwardSubject(subject: string): string {
  const trimmedSubject = subject.trim();
  if (trimmedSubject.toLowerCase().startsWith('fwd:') || trimmedSubject.toLowerCase().startsWith('fw:')) {
    return trimmedSubject;
  }
  return `Fwd: ${trimmedSubject}`;
}
