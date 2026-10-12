/**
 * The one way an incoming person is matched to a candidate we already have
 * (Find Phase 1, 2026-10-12). Every way a candidate enters — Collect,
 * applications, the Chrome extension, manual adds — asks
 * find_candidate_matches() before writing.
 *
 * Only a strong match with no conflict is used without asking: same Apollo
 * id, LinkedIn or email, and no different LinkedIn or Apollo id. Medium
 * matches (same phone and name) and conflicts create a separate record that
 * the Possible duplicates queue raises for a person to decide.
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { normKey } from './findCriteria.ts'

export interface IncomingPerson {
  candidate_name?: string | null
  email?: string | null
  phone?: string | null
  linkedin_url?: string | null
  apollo_id?: string | null
  company_current?: string | null
}

export interface ExistingMatch {
  id: string
  strength: 'strong' | 'medium' | 'weak'
  reasons: string[]
}

function namesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = normKey(a)
  const y = normKey(b)
  if (!x || !y) return false
  if (x === y) return true
  const xs = x.split(' ')
  const ys = y.split(' ')
  return xs.length > 1 && ys.length > 1 && xs[0] === ys[0] && xs[xs.length - 1] === ys[ys.length - 1]
}

/**
 * The candidate this person already is, or null.
 * requireName: for self-reported data (applications), an email alone isn't
 * enough — the name must match too, unless LinkedIn or Apollo id matched.
 */
export async function findExistingCandidate(
  admin: SupabaseClient,
  tenantId: string,
  person: IncomingPerson,
  opts: { requireName?: boolean } = {},
): Promise<ExistingMatch | null> {
  const { data, error } = await admin.rpc('find_candidate_matches', {
    p_tenant: tenantId,
    p_payload: person,
  })
  if (error) {
    console.error('find_candidate_matches failed:', error.message)
    return null
  }
  const strong = (data || []).find((m: any) => m.strength === 'strong' && !m.conflict)
  if (!strong) return null

  if (opts.requireName) {
    const keyed = (strong.reasons || []).some((r: string) => r === 'Same LinkedIn' || r === 'Same Apollo id')
    if (!keyed) {
      const { data: row } = await admin.from('candidates').select('candidate_name').eq('id', strong.candidate_id).maybeSingle()
      if (!namesMatch(row?.candidate_name, person.candidate_name)) return null
    }
  }
  return { id: strong.candidate_id, strength: 'strong', reasons: strong.reasons || [] }
}
