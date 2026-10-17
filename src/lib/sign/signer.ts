import { supabase } from '@/lib/supabaseClient'

/** What the signing page talks to: sign-session and sign-submit (public, no account). */

export type SignerState = 'open' | 'waiting' | 'signed' | 'declined' | 'voided' | 'expired' | 'completed' | 'copy'

export interface SignerOpen {
  state: SignerState
  brand: string
  title: string
  public_id: string
  sender_name: string
  sender_email: string
  documents: { name: string; pages: number }[]
  recipient: { name: string; first_name: string; email_masked: string; role: string }
  consented: boolean
  code_sent_at: string | null
  expires_at: string | null
  declined_by: string | null
}

export interface SignerField {
  id: string
  type: 'signature' | 'initials' | 'date' | 'name' | 'email' | 'text' | 'checkbox' | 'data'
  page: number
  x: number
  y: number
  w: number
  h: number
  owner: 'me' | 'other' | 'data'
  required?: boolean
  label?: string | null
  value?: string | null
  owner_name?: string
  /** Data fields: 'tick' prints a tick for Yes instead of the word. */
  style?: 'tick' | null
  /** Data fields: the chosen text size in points (null = automatic). */
  font_size?: number | null
}

export interface SignerDocument {
  title: string
  brand: string
  public_id: string
  sender_name: string
  recipient: { id: string; name: string; email: string; role: string }
  today: string
  documents: { id: string; name: string; pages: number; page_sizes: { w: number; h: number }[]; url: string | null }[]
  people: { id: string; name: string; label: string | null; status: string; me: boolean }[]
  fields: SignerField[]
}

export class SignerError extends Error {
  code: string
  details: Record<string, unknown>
  constructor(code: string, details: Record<string, unknown> = {}) {
    super(code)
    this.code = code
    this.details = details
  }
}

async function call<T>(fn: 'sign-session' | 'sign-submit', body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body })
  if (error) {
    const ctx = (error as { context?: Response }).context
    if (ctx && typeof ctx.json === 'function') {
      let payload: Record<string, unknown> | null = null
      try {
        payload = await ctx.json()
      } catch {
        payload = null
      }
      if (payload) throw new SignerError(String(payload.error ?? 'server'), payload)
    }
    throw new SignerError('network')
  }
  return data as T
}

export const signer = {
  open: (token: string) => call<SignerOpen>('sign-session', { action: 'open', token }),
  sendCode: (token: string) =>
    call<{ ok: true; email_masked: string; wait: number }>('sign-session', { action: 'send_code', token, consent: true }),
  verify: (token: string, code: string) => call<{ session: string; expires_at: string }>('sign-session', { action: 'verify', token, code }),
  load: (token: string, session: string) => call<SignerDocument>('sign-session', { action: 'load', token, session }),
  submit: (token: string, session: string, values: Record<string, string | boolean>, signature: AdoptedSignature | null) =>
    call<{ status: 'sent' | 'completed'; next: string[]; signed_at: string }>('sign-submit', {
      action: 'submit',
      token,
      session,
      values,
      signature: signature && {
        kind: signature.kind,
        full_name: signature.fullName,
        initials: signature.initials,
        font: signature.font,
        image: signature.image,
        initials_image: signature.initialsImage,
      },
    }),
  decline: (token: string, session: string, reason: string) => call<{ ok: true }>('sign-submit', { action: 'decline', token, session, reason }),
}

export interface AdoptedSignature {
  kind: 'type' | 'draw' | 'upload'
  fullName: string
  initials: string
  font: string | null
  /** PNG data URL of the signature, as it will be stamped. */
  image: string
  initialsImage: string | null
}

/** The session survives a reload in this tab only (cleared when the tab closes). */
export const sessionStore = {
  get(token: string): string | null {
    try {
      const raw = sessionStorage.getItem(`gio.sign.${token.slice(0, 16)}`)
      if (!raw) return null
      const { s, exp } = JSON.parse(raw)
      return exp > Date.now() ? s : null
    } catch {
      return null
    }
  },
  set(token: string, s: string, expiresAt: string) {
    try {
      sessionStorage.setItem(`gio.sign.${token.slice(0, 16)}`, JSON.stringify({ s, exp: new Date(expiresAt).getTime() }))
    } catch {
      /* private mode: the signer enters a code again after a reload */
    }
  },
  clear(token: string) {
    try {
      sessionStorage.removeItem(`gio.sign.${token.slice(0, 16)}`)
    } catch {
      /* ignore */
    }
  },
}

export const SIGNATURE_FONTS: [string, number][] = [
  ['Caveat', 34],
  ['Dancing Script', 30],
  ['Homemade Apple', 22],
  ['Mr Dafoe', 36],
]

export const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .map((w) => w[0] || '')
    .join('')
    .slice(0, 3)
    .toUpperCase()

/** Draw typed text in a font to a transparent PNG (what gets stamped on the PDF). */
export async function typedToPng(text: string, font: string, px = 64): Promise<string> {
  await document.fonts?.load(`${px}px "${font}"`)
  const c = document.createElement('canvas')
  const ctx = c.getContext('2d')!
  ctx.font = `${px}px "${font}"`
  const w = Math.ceil(ctx.measureText(text).width) + px
  c.width = w
  c.height = Math.ceil(px * 1.6)
  const x = c.getContext('2d')!
  x.font = `${px}px "${font}"`
  x.fillStyle = '#14183A'
  x.textBaseline = 'middle'
  x.fillText(text, px / 2, c.height / 2)
  return c.toDataURL('image/png')
}

/**
 * An uploaded photo of a signature: scale it down, turn near-white pixels
 * transparent and darken the ink, so it sits on the page like ink.
 */
export async function cleanUpload(file: File, maxW = 900): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image()
      i.onload = () => res(i)
      i.onerror = rej
      i.src = url
    })
    const scale = Math.min(1, maxW / img.width)
    const c = document.createElement('canvas')
    c.width = Math.round(img.width * scale)
    c.height = Math.round(img.height * scale)
    const x = c.getContext('2d')!
    x.drawImage(img, 0, 0, c.width, c.height)
    const d = x.getImageData(0, 0, c.width, c.height)
    for (let p = 0; p < d.data.length; p += 4) {
      const lum = 0.299 * d.data[p] + 0.587 * d.data[p + 1] + 0.114 * d.data[p + 2]
      if (lum > 175) d.data[p + 3] = 0
      else {
        d.data[p] = 20
        d.data[p + 1] = 24
        d.data[p + 2] = 58
        d.data[p + 3] = Math.min(255, Math.round((175 - lum) * 2.2))
      }
    }
    x.putImageData(d, 0, 0)
    return c.toDataURL('image/png')
  } finally {
    URL.revokeObjectURL(url)
  }
}
