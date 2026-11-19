import { describe, expect, it } from 'vitest'
import { charsetOf, decodePart, decodeSnippet } from '../../../supabase/functions/_shared/mailDecode'

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const utf8 = (s: string) => b64url(new TextEncoder().encode(s))

describe('decodePart', () => {
  it('reads UTF-8 as UTF-8, not Latin-1', () => {
    const text = 'Yes, there’s a change. We’d love that. Hey Allen, Imagen entre líneas'
    expect(decodePart(utf8(text), 'text/plain; charset="UTF-8"')).toBe(text)
    expect(decodePart(utf8(text))).toBe(text) // no charset: UTF-8
  })

  it('reads a Latin-1 part in its own charset', () => {
    const bytes = new Uint8Array([0x63, 0x61, 0x66, 0xe9]) // "café" in ISO-8859-1
    expect(decodePart(b64url(bytes), 'text/plain; charset=ISO-8859-1')).toBe('café')
  })

  it('falls back to UTF-8 on an unknown charset and survives bad input', () => {
    expect(decodePart(utf8('niño'), 'text/plain; charset=x-made-up')).toBe('niño')
    expect(decodePart('@@@', 'text/plain')).toBe('')
  })

  it('finds the charset in a Content-Type header', () => {
    expect(charsetOf('text/html; charset="utf-8"')).toBe('utf-8')
    expect(charsetOf('text/html;charset=Windows-1252; format=flowed')).toBe('windows-1252')
    expect(charsetOf('text/html')).toBeNull()
  })
})

describe('decodeSnippet', () => {
  it('turns Gmail’s escaped snippet into text', () => {
    expect(decodeSnippet('Yes, there&#39;s a &quot;change&quot; &amp; more &lt;3 &#x2019;')).toBe('Yes, there\'s a "change" & more <3 ’')
    expect(decodeSnippet('Fish &chips; stays')).toBe('Fish &chips; stays')
    expect(decodeSnippet(null)).toBeNull()
  })
})
