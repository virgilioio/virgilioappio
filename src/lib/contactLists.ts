import { supabase } from '@/lib/supabaseClient'

/**
 * Keeps a candidate's contact lists when someone edits the primary email or
 * phone (Find Phase 3, 2026-10-12). The edited value goes first; every other
 * email and phone already on file (from Apollo, a résumé, an application)
 * stays. Elements are JSON strings in text[] columns.
 */
function valueOf(elem: unknown, key: 'email' | 'number'): string | null {
  if (typeof elem !== 'string') return null
  const t = elem.trim()
  if (t.startsWith('{')) {
    try { return (JSON.parse(t) as Record<string, string>)[key] ?? null } catch { return null }
  }
  return t || null
}

const emailKey = (v: string | null) => (v ? v.trim().toLowerCase() : null)
const phoneKey = (v: string | null) => (v ? v.replace(/\D/g, '').slice(-10) || null : null)

export async function contactListsWithPrimary(
  candidateId: string,
  email: string | null | undefined,
  phone: string | null | undefined,
): Promise<{ contact_emails?: string[]; contact_phones?: string[] }> {
  if (email === undefined && phone === undefined) return {}
  const { data } = await supabase
    .from('candidates')
    .select('contact_emails, contact_phones')
    .eq('id', candidateId)
    .maybeSingle()
  const out: { contact_emails?: string[]; contact_phones?: string[] } = {}

  if (email !== undefined) {
    const rest = (data?.contact_emails ?? []).filter((e) => emailKey(valueOf(e, 'email')) !== emailKey(email ?? null))
    out.contact_emails = email ? [JSON.stringify({ type: 'work', email, status: 'verified' }), ...rest] : rest
  }
  if (phone !== undefined) {
    const rest = (data?.contact_phones ?? []).filter((p) => phoneKey(valueOf(p, 'number')) !== phoneKey(phone ?? null))
    out.contact_phones = phone ? [JSON.stringify({ type: 'other', number: phone, raw_number: phone }), ...rest] : rest
  }
  return out
}
