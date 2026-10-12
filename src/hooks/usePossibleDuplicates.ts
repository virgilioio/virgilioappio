import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'

/**
 * The Possible duplicates queue (Find Phase 1, 2026-10-12).
 *
 * possible_duplicate_pairs() returns pairs of live candidates that share an
 * Apollo id, a LinkedIn profile or an email, or a phone and a name, minus
 * pairs someone marked "Not the same person". Pairs that share a person are
 * joined into one group ("A = B = C"). Each group's keeper is the record with
 * the most applications, then the oldest, so merging keeps the record people
 * have worked with.
 */

export interface DuplicateMember {
  id: string
  candidate_name: string
  email: string | null
  linkedin_url: string | null
  company_current: string | null
  role_current: string | null
  source: string | null
  created_at: string
  applications: number
}

export interface DuplicateGroup {
  key: string
  keeper: DuplicateMember
  others: DuplicateMember[]
  reasons: string[]
  strength: 'strong' | 'medium'
}

export function usePossibleDuplicates(tenantId: string | null | undefined) {
  return useQuery({
    queryKey: ['possible-duplicates', tenantId],
    enabled: !!tenantId,
    staleTime: 60_000,
    queryFn: async (): Promise<DuplicateGroup[]> => {
      const { data: pairs, error } = await supabase.rpc('possible_duplicate_pairs', { p_tenant: tenantId! })
      if (error) throw error
      if (!pairs || pairs.length === 0) return []

      // Union-find over the pairs.
      const parent = new Map<string, string>()
      const find = (x: string): string => {
        let r = x
        while (parent.get(r) && parent.get(r) !== r) r = parent.get(r)!
        parent.set(x, r)
        return r
      }
      const union = (a: string, b: string) => {
        if (!parent.has(a)) parent.set(a, a)
        if (!parent.has(b)) parent.set(b, b)
        const ra = find(a)
        const rb = find(b)
        if (ra !== rb) parent.set(rb, ra)
      }
      for (const p of pairs) union(p.candidate_a, p.candidate_b)

      const ids = [...parent.keys()]
      const members = new Map<string, DuplicateMember>()
      for (let i = 0; i < ids.length; i += 200) {
        const chunk = ids.slice(i, i + 200)
        const [{ data: rows, error: rowsError }, { data: assocs }] = await Promise.all([
          supabase
            .from('candidates')
            .select('id, candidate_name, email, linkedin_url, company_current, role_current, source, created_at')
            .in('id', chunk),
          supabase.from('job_candidate_associations').select('candidate_id').in('candidate_id', chunk),
        ])
        if (rowsError) throw rowsError
        const counts = new Map<string, number>()
        for (const a of assocs || []) counts.set(a.candidate_id, (counts.get(a.candidate_id) || 0) + 1)
        for (const r of rows || []) members.set(r.id, { ...r, applications: counts.get(r.id) || 0 } as DuplicateMember)
      }

      const groups = new Map<string, { ids: Set<string>; reasons: Set<string>; strong: boolean }>()
      for (const p of pairs) {
        const root = find(p.candidate_a)
        const g = groups.get(root) || { ids: new Set<string>(), reasons: new Set<string>(), strong: false }
        g.ids.add(p.candidate_a)
        g.ids.add(p.candidate_b)
        for (const r of p.reasons || []) g.reasons.add(r)
        if (p.strength === 'strong') g.strong = true
        groups.set(root, g)
      }

      const out: DuplicateGroup[] = []
      for (const [key, g] of groups) {
        const list = [...g.ids].map((id) => members.get(id)).filter((m): m is DuplicateMember => !!m)
        if (list.length < 2) continue
        list.sort((a, b) => b.applications - a.applications || a.created_at.localeCompare(b.created_at))
        out.push({ key, keeper: list[0], others: list.slice(1), reasons: [...g.reasons], strength: g.strong ? 'strong' : 'medium' })
      }
      // Strong groups first, then bigger ones.
      out.sort((a, b) => (a.strength === b.strength ? b.others.length - a.others.length : a.strength === 'strong' ? -1 : 1))
      return out
    },
  })
}
