import { supabase } from '@/lib/supabaseClient'

/**
 * "Find people like this one" (Find Phase 2, 2026-10-12): a new Find search
 * seeded from someone already in Gio: their title (and the title without its
 * level), their country, their level and their top skills. It runs like any
 * search, our own candidates first, then Apollo.
 */

const LEVEL_WORDS = /^(senior|sr\.?|junior|jr\.?|lead|principal|staff|head of|associate)\s+/i

const APOLLO_SENIORITY: Record<string, string> = {
  entry: 'entry', junior: 'entry', mid: 'senior', senior: 'senior', lead: 'manager',
  director: 'director', vp: 'vp', c_level: 'c_suite',
}

export interface SimilarSeed {
  name: string
  criteria: {
    title_keywords: string[]
    locations: string[]
    seniorities: string[]
    keywords: string[]
  }
}

export async function similarSeed(candidateId: string): Promise<SimilarSeed> {
  const { data: c, error } = await supabase
    .from('candidates')
    .select('candidate_name, role_current, current_job_title, location_country, seniority_level, skills')
    .eq('id', candidateId)
    .single()
  if (error) throw error
  const title = (c.role_current || c.current_job_title || '').trim()
  if (!title) throw new Error('This person has no current title to search by.')
  const base = title.replace(LEVEL_WORDS, '').trim()
  const titles = [...new Set([title, base].filter((t) => t.length > 1))]
  const level = c.seniority_level ? APOLLO_SENIORITY[c.seniority_level] : undefined
  return {
    name: `Like ${c.candidate_name || title}`,
    criteria: {
      title_keywords: titles,
      locations: c.location_country ? [c.location_country] : [],
      seniorities: level ? [level] : [],
      keywords: (Array.isArray(c.skills) ? c.skills : []).filter((s): s is string => typeof s === 'string' && !!s.trim()).slice(0, 3),
    },
  }
}

/** Creates the search and returns its project id. */
export async function createSimilarSearch(candidateId: string, organizationId: string): Promise<string> {
  const seed = await similarSeed(candidateId)
  const { data, error } = await supabase.functions.invoke('create-sourcing-project', {
    body: {
      name: seed.name,
      description: `People like ${seed.name.replace(/^Like /, '')}`,
      job_id: null,
      organization_id: organizationId,
      search_criteria: seed.criteria,
    },
  })
  if (error) throw error
  if (!data?.id) throw new Error("The search wasn't created.")
  return data.id as string
}
