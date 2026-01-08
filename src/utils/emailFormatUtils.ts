import { format } from 'date-fns';

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

export function formatQuotedReply(email: EmailData): string {
  const date = format(
    new Date(email.received_at || email.sent_at || email.created_at),
    "MMM d, yyyy 'at' h:mm a"
  );
  const originalContent = email.body_html || `<p>${email.body_text || ''}</p>`;
  
  return `<br><br><div style="border-left: 2px solid #ccc; padding-left: 12px; margin-left: 0; color: #666;"><p style="margin: 0 0 8px 0;">On ${date}, ${email.from_address} wrote:</p>${originalContent}</div>`;
}

export function formatForwardedMessage(email: EmailData): string {
  const date = format(
    new Date(email.received_at || email.sent_at || email.created_at),
    "MMM d, yyyy 'at' h:mm a"
  );
  const originalContent = email.body_html || `<p>${email.body_text || ''}</p>`;
  
  const ccLine = email.cc_addresses?.length 
    ? `<strong>Cc:</strong> ${email.cc_addresses.join(', ')}<br>` 
    : '';
  
  return `<br><br><div style="border-top: 1px solid #ccc; padding-top: 12px; margin-top: 12px;"><p style="margin: 0 0 8px 0; font-weight: bold;">---------- Forwarded message ----------</p><p style="margin: 0; font-size: 13px;"><strong>From:</strong> ${email.from_address}<br><strong>Date:</strong> ${date}<br><strong>Subject:</strong> ${email.subject}<br><strong>To:</strong> ${email.to_addresses.join(', ')}<br>${ccLine}</p><br>${originalContent}</div>`;
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
