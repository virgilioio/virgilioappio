/**
 * The shared email template for system emails (bookings, calendar replies,
 * chat notifications, account emails). Since 2026-10-18 it draws the Gio ATS
 * design (_shared/atsEmail.ts): the cream card, the gio ats logo with the
 * product in the masthead, a title with a lilac period, the dark button and
 * the Gio footer. Callers keep their options; `product` and `eyebrow` name
 * the email's part of Gio ATS. ASCII only.
 */

import { atsLayout, esc, gioContent } from './atsEmail.ts';

export interface EmailTemplateOptions {
  recipientName: string;
  preheaderText?: string;
  title: string;
  /** HTML: paragraphs, lists (formatEmailList), bold and links get Gio styles. */
  content: string;
  ctaText?: string;
  ctaUrl?: string;
  /** Shown in the footer, above the Gio line. HTML. */
  footerNote?: string;
  /** The part of Gio ATS in the masthead, e.g. "Scheduling". */
  product?: string;
  /** The small purple line above the title. */
  eyebrow?: string;
}

/** A title ends on the lilac period: drop any closing punctuation of its own. */
const cleanTitle = (t: string) => String(t ?? '').trim().replace(/[.!?:\s]+$/, '');

export function createEmailTemplate(options: EmailTemplateOptions): string {
  const { recipientName, preheaderText, title, content, ctaText, ctaUrl, footerNote, product, eyebrow } = options;
  const name = String(recipientName ?? '').trim() || 'there';
  return atsLayout({
    preheader: preheaderText || cleanTitle(title),
    product: product || 'Gio ATS',
    eyebrow,
    title: cleanTitle(title),
    lead: `Hi <strong style="color:#1F2230;font-weight:600">${esc(name)}</strong>,`,
    body: gioContent(content),
    cta: ctaText && ctaUrl ? { label: ctaText, url: ctaUrl } : undefined,
    whyHtml: footerNote,
  });
}

// Helper function for simple text content
export function formatEmailContent(paragraphs: string[]): string {
  return paragraphs.map((p) => `<p>${p}</p>`).join('\n');
}

// Helper function for lists: drawn as a white details card, one row per item.
export function formatEmailList(items: string[]): string {
  return `<ul>${items
    .map((item, i) => `<li${i === items.length - 1 ? ' style="border-bottom:0"' : ''}>${item}</li>`)
    .join('')}</ul>`;
}
