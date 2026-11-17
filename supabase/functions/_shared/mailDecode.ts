/**
 * Turning Gmail's message parts into text (2026-11-17).
 *
 * Gmail's API gives each part's body as base64url bytes in the charset the part
 * declares. The sync used to stop at atob(), which reads every byte as a Latin-1
 * letter, so UTF-8 text came out as "thereâ€™s", "Hey Allen,Â" and "lÃneas".
 * decodePart() decodes the bytes with the part's own charset (UTF-8 when none is
 * given or the browser doesn't know it). Gmail's `snippet` arrives HTML-escaped
 * ("there&#39;s"); decodeSnippet() turns it back into plain text.
 */

/** The charset a Content-Type header declares, lower-cased, or null. */
export function charsetOf(contentType: string | null | undefined): string | null {
  const m = /charset\s*=\s*"?([^";\s]+)"?/i.exec(contentType ?? '')
  return m ? m[1].toLowerCase() : null
}

/** base64url (padded or not) to bytes; empty on bad input. */
export function base64UrlToBytes(data: string): Uint8Array {
  try {
    const b64 = data.replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, '')
    const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  } catch {
    return new Uint8Array(0)
  }
}

/** A part's body as text, in its declared charset (UTF-8 by default). */
export function decodePart(data: string, contentType?: string | null): string {
  const bytes = base64UrlToBytes(data)
  const charset = charsetOf(contentType) ?? 'utf-8'
  try {
    return new TextDecoder(charset).decode(bytes)
  } catch {
    // An unknown label: UTF-8, which every modern mailer sends anyway.
    return new TextDecoder('utf-8').decode(bytes)
  }
}

const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' }

/** Gmail's HTML-escaped snippet as plain text ("there&#39;s" → "there's"). */
export function decodeSnippet(s: string | null | undefined): string | null {
  if (s == null) return null
  return s.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === '#') {
      const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : whole
    }
    return NAMED[code.toLowerCase()] ?? whole
  })
}
