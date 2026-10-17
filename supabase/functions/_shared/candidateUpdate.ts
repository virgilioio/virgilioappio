/**
 * The one path for outside data about a candidate (Find Phase 3, 2026-10-12).
 *
 * Every server function that writes what Apollo, a résumé, an application or
 * the Chrome extension says about someone we already have goes through the
 * database function apply_candidate_update(). It records where each value
 * came from, fills gaps, refreshes only what a source set (never a person's
 * edit), keeps other emails and phones in the contact lists, and spots job
 * changes (work history, timeline, notifications). Don't write those
 * columns with a plain update.
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { apolloCompany } from './apolloPerson.ts'
import { dedupeJobs } from './resumeFacts.ts'

export type UpdateSource = 'apollo' | 'apollo_preview' | 'resume' | 'application' | 'extension' | 'pdl' | 'import'

export interface JobChange {
  kind: 'job' | 'role'
  old_title: string | null
  old_company: string | null
  new_title: string | null
  new_company: string | null
}

export interface ApplyResult {
  applied: string[]
  /** Values the source sent that we didn't take (a person's edit, a fresh résumé). */
  kept: Record<string, string>
  job_change: JobChange | null
  missing?: boolean
}

/** Applies outside data; never throws (a failed refresh must not fail a collect). */
export async function applyCandidateUpdate(
  // deno-lint-ignore no-explicit-any
  db: SupabaseClient<any, any, any>,
  candidateId: string,
  source: UpdateSource,
  fields: Record<string, unknown>,
  opts: { mode?: 'fill' | 'refresh'; actor?: string | null } = {},
): Promise<ApplyResult | null> {
  const clean: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || v === null || v === '') continue
    if (Array.isArray(v) && v.length === 0) continue
    clean[k] = v
  }
  const { data, error } = await db.rpc('apply_candidate_update', {
    p_candidate_id: candidateId,
    p_source: source,
    p_fields: clean,
    p_mode: opts.mode ?? 'refresh',
    p_actor: opts.actor ?? null,
  })
  if (error) {
    console.error(`apply_candidate_update(${source}) failed for ${candidateId}:`, error.message)
    return null
  }
  return data as ApplyResult
}

/** What an Apollo person says, in apply_candidate_update()'s field names. */
// deno-lint-ignore no-explicit-any
export function apolloPersonFields(person: any): Record<string, unknown> {
  // deno-lint-ignore no-explicit-any
  const contactPhones = (Array.isArray(person?.phone_numbers) ? person.phone_numbers : []).map((p: any) => ({
    type: p?.type || 'other',
    number: p?.sanitized_number || p?.raw_number || '',
    raw_number: p?.raw_number || null,
  // deno-lint-ignore no-explicit-any
  })).filter((p: any) => p.number)

  // deno-lint-ignore no-explicit-any
  const contactEmails: any[] = []
  if (person?.email) contactEmails.push({ type: 'work', email: person.email, status: person.email_status || null })
  for (const e of (Array.isArray(person?.personal_emails) ? person.personal_emails : [])) {
    if (e && e !== person.email) contactEmails.push({ type: 'personal', email: e, status: null })
  }

  const name = person?.name || [person?.first_name, person?.last_name].filter(Boolean).join(' ') || null
  return {
    candidate_name: name,
    apollo_id: person?.id || null,
    email: person?.email || null,
    email_status: person?.email_status || null,
    phone: contactPhones[0]?.number || null,
    contact_phones: contactPhones,
    contact_emails: contactEmails,
    linkedin_url: person?.linkedin_url || null,
    role_current: person?.title || null,
    company_current: apolloCompany(person),
    location_city: person?.city || null,
    location_state: person?.state || null,
    location_country: person?.country || null,
    bio: person?.headline || null,
  }
}

/** Apollo's work history as candidate_work_experience rows, each job once (Apollo sometimes lists one twice). */
// deno-lint-ignore no-explicit-any
export function apolloWorkHistory(candidateId: string, person: any) {
  const list = Array.isArray(person?.employment_history) ? person.employment_history : []
  // deno-lint-ignore no-explicit-any
  return dedupeJobs(list.map((exp: any) => ({
    candidate_id: candidateId,
    company_name: exp?.organization_name || exp?.organization?.name || 'Unknown company',
    job_title: exp?.title || 'Unknown title',
    start_date: exp?.start_date ? new Date(exp.start_date).toISOString().split('T')[0] : null,
    end_date: exp?.end_date ? new Date(exp.end_date).toISOString().split('T')[0] : null,
    is_current: exp?.current || false,
    description: exp?.description || null,
  })))
}

/** Adds Apollo's work history only when the candidate has none yet. */
// deno-lint-ignore no-explicit-any
export async function addHistoryIfEmpty(db: SupabaseClient<any, any, any>, candidateId: string, person: any) {
  const rows = apolloWorkHistory(candidateId, person)
  if (rows.length === 0) return
  const { count } = await db
    .from('candidate_work_experience')
    .select('id', { count: 'exact', head: true })
    .eq('candidate_id', candidateId)
  if ((count ?? 0) > 0) return
  const { error } = await db.from('candidate_work_experience').insert(rows)
  if (error) console.warn('Work history insert failed:', error.message)
}
