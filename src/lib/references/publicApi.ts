/**
 * Client for the public (token-resolved) reference endpoints.
 *
 * The candidate and the referee have NO Gio account — every call carries only
 * the opaque token from the URL, and any auth-shaped failure comes back as one
 * indistinguishable `not_found`.
 */
import { supabase } from '@/integrations/supabase/client'

export type PublicRefereeStatus = 'open' | 'submitted' | 'declined' | 'cancelled'
export type PublicCandidateStatus = 'open' | 'already_submitted' | 'cancelled'

export interface PublicRefereeField {
  id: string
  key: string
  label: string
  type: string
  required: boolean
  helper?: string
  options?: string[]
}

export interface PublicQuestion {
  id: string
  label: string
  type: string
  required: boolean
  helper?: string
  options?: string[]
  ask_candidate_too?: boolean
}

export interface CandidateResolve {
  kind: 'candidate'
  status: PublicCandidateStatus
  brand: { agency_name: string; logo_url: string | null }
  candidate_name: string
  candidate_first_name: string
  job_title: string
  client_name: string
  recruiter_name: string
  referee_count: number
  max_referees: number
  relationship_rules: Array<{ count: number; relationship: string }>
  referee_fields: PublicRefereeField[]
  consent_text: string
  self_assessment_questions: PublicQuestion[]
  expires_at: string | null
  submitted_referees: Array<{ name: string; held: boolean }>
}

export interface RefereeResolve {
  kind: 'referee'
  status: PublicRefereeStatus
  brand: { agency_name: string; logo_url: string | null }
  referee_name: string
  referee_first_name: string
  candidate_name: string
  job_title: string
  client_name: string
  recruiter_name: string
  questions: PublicQuestion[]
  estimated_minutes: number
  draft_answers: Record<string, unknown>
  resumed: boolean
  expires_at: string | null
}

export class PublicRefError extends Error {
  code: string
  details?: unknown
  constructor(code: string, details?: unknown) {
    super(code)
    this.code = code
    this.details = details
  }
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('reference-public', { body })
  if (error) {
    // Edge errors arrive as FunctionsHttpError — read the JSON body when we can.
    const ctx = (error as { context?: Response }).context
    if (ctx && typeof ctx.json === 'function') {
      try {
        const payload = await ctx.json()
        throw new PublicRefError(payload?.error ?? 'not_found', payload)
      } catch (e) {
        if (e instanceof PublicRefError) throw e
      }
    }
    throw new PublicRefError('not_found')
  }
  if ((data as { error?: string })?.error) {
    throw new PublicRefError((data as { error: string }).error, data)
  }
  return data as T
}

export const resolveCandidateToken = (token: string) =>
  call<CandidateResolve>({ action: 'resolve', token })

export const resolveRefereeToken = (token: string) =>
  call<RefereeResolve>({ action: 'resolve', token })

export const submitCandidateReferees = (
  token: string,
  payload: {
    referees: Array<Record<string, unknown>>
    consent: boolean
    self_assessment: Record<string, unknown>
  },
) =>
  call<{ success: true; emailed: string[]; held: string[] }>({
    action: 'submit_candidate',
    token,
    ...payload,
  })

export const saveRefereeDraft = (token: string, answers: Record<string, unknown>) =>
  call<{ success: true; saved_at: string }>({ action: 'save_answer', token, answers })

export const submitReferee = (token: string, answers: Record<string, unknown>) =>
  call<{ success: true }>({ action: 'submit_referee', token, answers })

export const declineReference = (token: string) =>
  call<{ success: true }>({ action: 'decline', token })
