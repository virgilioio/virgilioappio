
// UTF-8 safe base64 — raw btoa() throws on characters above U+00FF
// (e.g. candidate names like "Abović"), which broke ICS generation.
function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}
export interface ICSEventData {
  uid: string; // e.g., "booking-abc123@gogio.io"
  summary: string; // e.g., "Interview with John Doe"
  description: string;
  location: string; // Zoom link, Google Meet, etc.
  startTime: Date;
  endTime: Date;
  organizerEmail: string;
  organizerName: string;
  attendeeEmail: string;
  attendeeName: string;
  status: 'CONFIRMED' | 'CANCELLED' | 'TENTATIVE';
  method: 'REQUEST' | 'CANCEL' | 'PUBLISH';
  sequence?: number; // Optional sequence number for updates/cancellations
}

export function generateICS(event: ICSEventData): string {
  const formatDate = (date: Date): string => {
    // Format: YYYYMMDDTHHmmssZ (UTC)
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const escapeText = (text: string): string => {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n');
  };

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//GoGio//Interview Scheduler//EN',
    'CALSCALE:GREGORIAN',
    `METHOD:${event.method}`,
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${formatDate(new Date())}`,
    `DTSTART:${formatDate(event.startTime)}`,
    `DTEND:${formatDate(event.endTime)}`,
    `SUMMARY:${escapeText(event.summary)}`,
    `DESCRIPTION:${escapeText(event.description)}`,
    `LOCATION:${escapeText(event.location)}`,
    `ORGANIZER;CN=${escapeText(event.organizerName)}:mailto:${event.organizerEmail}`,
    `ATTENDEE;CN=${escapeText(event.attendeeName)};RSVP=TRUE:mailto:${event.attendeeEmail}`,
    `STATUS:${event.status}`,
    `SEQUENCE:${event.sequence ?? 0}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  // Return base64-encoded content for email attachment
  return utf8ToBase64(icsContent);
}
