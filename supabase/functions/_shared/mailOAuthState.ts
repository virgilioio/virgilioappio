// Sealed OAuth state for the Google Workspace connect flow.
// The state carries the user, the PKCE verifier, the redirect base and the
// opener's origin, encrypted with a server-only key. That lets the callback
// finish on any allowed Gio address — even one where the browser has no Gio
// session or no saved verifier — without trusting anything the browser sends.

import { isAllowedOrigin } from './cors.ts'

export interface MailOAuthState {
  user_id: string
  timestamp: number
  nonce: string
  code_verifier: string
  redirect_base: string
  return_origin: string | null
}

export const STATE_MAX_AGE_MS = 10 * 60 * 1000

function b64url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromB64url(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad)
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

async function key(): Promise<CryptoKey> {
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!secret) throw new Error('Server misconfiguration: missing service key')
  const raw = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`mail-oauth-state:${secret}`))
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

export async function sealState(state: MailOAuthState): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(), new TextEncoder().encode(JSON.stringify(state))),
  )
  const out = new Uint8Array(iv.length + ct.length)
  out.set(iv)
  out.set(ct, iv.length)
  return `v2.${b64url(out)}`
}

/** Returns the state, or throws an Error whose message is a stable code. */
export async function openState(sealed: string): Promise<MailOAuthState> {
  if (!sealed?.startsWith('v2.')) throw new Error('state_invalid')
  let state: MailOAuthState
  try {
    const bytes = fromB64url(sealed.slice(3))
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, await key(), bytes.slice(12))
    state = JSON.parse(new TextDecoder().decode(pt))
  } catch {
    throw new Error('state_invalid')
  }
  if (!state.user_id || !state.code_verifier || !state.redirect_base) throw new Error('state_invalid')
  if (Date.now() - state.timestamp > STATE_MAX_AGE_MS) throw new Error('state_expired')
  return state
}

/** Redirect bases registered in Google Cloud. OAUTH_REDIRECT_BASE is always first. */
export function allowedRedirectBases(): string[] {
  const primary = (Deno.env.get('OAUTH_REDIRECT_BASE') ?? '').replace(/\/+$/, '')
  const extra = (Deno.env.get('OAUTH_REDIRECT_ALLOWED_BASES') ?? '')
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean)
  return [primary, ...extra].filter((v, i, a) => v && a.indexOf(v) === i)
}

/** Picks the caller's own address when Google knows it, else the primary base. */
export function pickRedirectBase(returnOrigin: string | null): string {
  const bases = allowedRedirectBases()
  if (returnOrigin && bases.includes(returnOrigin)) return returnOrigin
  return bases[0]
}

export function sanitizeReturnOrigin(origin: unknown): string | null {
  if (typeof origin !== 'string') return null
  try {
    const o = new URL(origin).origin
    return isAllowedOrigin(o).allowed ? o : null
  } catch {
    return null
  }
}
