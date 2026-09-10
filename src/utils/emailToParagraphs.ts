/**
 * Turn an email body into the paragraphs a human actually wrote.
 *
 * Pure presentation helper: quoted history is removed upstream by
 * `splitEmailQuote()`; here we drop signatures and split on blank lines.
 */

const SIGNATURE_DELIMITER_RE = /^\s*(--\s*|__+|—\s*)$/;

const SIGNATURE_LEAD_RE =
  /^\s*(best regards|kind regards|warm regards|best wishes|regards|best|cheers|thanks|thank you|sincerely|atentamente|saludos|un saludo|cordialmente|abraços|atenciosamente)\s*[,!.]?\s*$/i;

const FOOTER_NOISE_RE =
  /^\s*(sent from my |this email and any attachments|confidentiality notice|unsubscribe\b)/i;

function stripSignature(lines: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (SIGNATURE_DELIMITER_RE.test(line)) break;
    if (FOOTER_NOISE_RE.test(line)) break;
    if (SIGNATURE_LEAD_RE.test(line)) {
      // A sign-off ends the message; keep it, drop everything after it.
      out.push(line);
      break;
    }
    out.push(line);
  }
  return out;
}

export function htmlToPlainText(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  // Preserve block boundaries as newlines before flattening.
  doc.body?.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
  doc.body
    ?.querySelectorAll('p, div, li, tr, h1, h2, h3, h4, h5, h6')
    .forEach((el) => el.append('\n'));
  return (doc.body?.textContent || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Plain text → paragraphs, signature and trailing noise removed. */
export function toParagraphs(plain: string): string[] {
  if (!plain) return [];
  const lines = plain.replace(/\r\n?/g, '\n').split('\n');
  const kept = stripSignature(lines);

  const paragraphs: string[] = [];
  let buffer: string[] = [];
  const flush = () => {
    const text = buffer.join(' ').replace(/\s+/g, ' ').trim();
    if (text) paragraphs.push(text);
    buffer = [];
  };
  for (const line of kept) {
    if (line.trim() === '') flush();
    else buffer.push(line.trim());
  }
  flush();
  return paragraphs;
}
