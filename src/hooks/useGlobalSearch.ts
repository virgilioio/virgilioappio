import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { Briefcase, Users, Target, LucideIcon } from 'lucide-react'

export interface SearchResult {
  id: string
  type: 'job' | 'candidate' | 'sourcing_project'
  title: string
  subtitle: string
  metadata: string
  route: string
  icon: LucideIcon
}

interface UseGlobalSearchOptions {
  limit?: number
  debounceMs?: number
  minQueryLength?: number
}

interface UseGlobalSearchReturn {
  results: SearchResult[]
  isLoading: boolean
  error: Error | null
  totalCounts: {
    jobs: number
    candidates: number
    sourcing_projects: number
  }
}

// Resolve tenant_id from the members table for the current user
async function resolveTenantId(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('members')
    .select('tenant_id')
    .eq('user_id', userId)
    .eq('user_status', 'active')
    .single()
  return data?.tenant_id ?? null
}

export function useGlobalSearch(
  query: string,
  options: UseGlobalSearchOptions = {}
): UseGlobalSearchReturn {
  const { limit = 5, debounceMs = 300, minQueryLength = 2 } = options
  const { user } = useAuth()
  
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [totalCounts, setTotalCounts] = useState({ jobs: 0, candidates: 0, sourcing_projects: 0 })
  
  const abortControllerRef = useRef<AbortController | null>(null)
  const tenantIdRef = useRef<string | null>(null)
  const tenantResolvedRef = useRef(false)

  // Resolve tenant_id once when user is available
  useEffect(() => {
    tenantResolvedRef.current = false
    tenantIdRef.current = null
    if (!user) return
    resolveTenantId(user.id).then(id => {
      tenantIdRef.current = id
      tenantResolvedRef.current = true
    })
  }, [user?.id])

  useEffect(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    if (!query || query.trim().length < minQueryLength) {
      setResults([])
      setTotalCounts({ jobs: 0, candidates: 0, sourcing_projects: 0 })
      setIsLoading(false)
      return
    }

    const searchQuery = query.trim()
    abortControllerRef.current = new AbortController()

    const timeoutId = setTimeout(async () => {
      setIsLoading(true)
      setError(null)

      try {
        // Wait for tenant resolution if not yet done
        if (!tenantResolvedRef.current && user) {
          const id = await resolveTenantId(user.id)
          tenantIdRef.current = id
          tenantResolvedRef.current = true
        }

        const tenantId = tenantIdRef.current

        // CRITICAL: Never search without tenant context
        if (!tenantId) {
          setResults([])
          setTotalCounts({ jobs: 0, candidates: 0, sourcing_projects: 0 })
          setIsLoading(false)
          return
        }

        const [jobsSettled, candidatesSettled, sourcingSettled] = await Promise.allSettled([
          searchJobs(searchQuery, limit, tenantId),
          searchCandidates(searchQuery, limit, tenantId),
          searchSourcingProjects(searchQuery, limit, user?.id || '')
        ])

        const jobsResult = jobsSettled.status === 'fulfilled' ? jobsSettled.value : { results: [], count: 0 }
        const candidatesResult = candidatesSettled.status === 'fulfilled' ? candidatesSettled.value : { results: [], count: 0 }
        const sourcingResult = sourcingSettled.status === 'fulfilled' ? sourcingSettled.value : { results: [], count: 0 }

        if (jobsSettled.status === 'rejected') console.error('Search jobs failed:', jobsSettled.reason)
        if (candidatesSettled.status === 'rejected') console.error('Search candidates failed:', candidatesSettled.reason)
        if (sourcingSettled.status === 'rejected') console.error('Search sourcing projects failed:', sourcingSettled.reason)

        const combinedResults: SearchResult[] = [
          ...jobsResult.results,
          ...candidatesResult.results,
          ...sourcingResult.results
        ]

        setResults(combinedResults)
        setTotalCounts({
          jobs: jobsResult.count,
          candidates: candidatesResult.count,
          sourcing_projects: sourcingResult.count
        })
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          setError(err)
        }
      } finally {
        setIsLoading(false)
      }
    }, debounceMs)

    return () => {
      clearTimeout(timeoutId)
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [query, limit, debounceMs, minQueryLength, user?.id])

  return { results, isLoading, error, totalCounts }
}

async function searchJobs(query: string, limit: number, tenantId: string) {
  const searchPattern = `%${query}%`
  
  const { count } = await supabase
    .from('jobs')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .or(`title.ilike.${searchPattern},department.ilike.${searchPattern},location.ilike.${searchPattern},standardized_title.ilike.${searchPattern}`)
    .is('deleted_at', null)

  const { data, error } = await supabase
    .from('jobs')
    .select('id, title, department, location, status, organization_id, organizations(name)')
    .eq('tenant_id', tenantId)
    .or(`title.ilike.${searchPattern},department.ilike.${searchPattern},location.ilike.${searchPattern},standardized_title.ilike.${searchPattern}`)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (error) throw error

  const results: SearchResult[] = (data || []).map(job => ({
    id: job.id,
    type: 'job' as const,
    title: job.title,
    subtitle: (job.organizations as any)?.name || job.department || 'No department',
    metadata: job.location || 'No location',
    route: `/jobs/${job.id}`,
    icon: Briefcase
  }))

  return { results, count: count || 0 }
}

async function searchCandidates(query: string, limit: number, tenantId: string) {
  const searchPattern = `%${query}%`
  
  const { count } = await supabase
    .from('candidates')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .or(`candidate_name.ilike.${searchPattern},email.ilike.${searchPattern},location_city.ilike.${searchPattern},role_current.ilike.${searchPattern}`)
    .is('deleted_at', null)

  const { data: candidates, error } = await supabase
    .from('candidates')
    .select('id, candidate_name, location_city, location_country')
    .eq('tenant_id', tenantId)
    .or(`candidate_name.ilike.${searchPattern},email.ilike.${searchPattern},location_city.ilike.${searchPattern},role_current.ilike.${searchPattern}`)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  if (!candidates || candidates.length === 0) {
    return { results: [], count: count || 0 }
  }

  const candidateIds = candidates.map(c => c.id)
  const { data: associations } = await supabase
    .from('job_candidate_associations')
    .select(`
      candidate_id,
      jobs!inner(id, title, status, deleted_at)
    `)
    .in('candidate_id', candidateIds)
    .is('jobs.deleted_at', null)

  const jobsByCandidate = new Map<string, { title: string; status: string }[]>()
  
  if (associations) {
    for (const assoc of associations) {
      const job = assoc.jobs as unknown as { id: string; title: string; status: string; deleted_at: string | null }
      if (!job) continue
      
      const jobs = jobsByCandidate.get(assoc.candidate_id) || []
      jobs.push({ title: job.title, status: job.status })
      jobsByCandidate.set(assoc.candidate_id, jobs)
    }
  }

  for (const [candidateId, jobs] of jobsByCandidate) {
    jobs.sort((a, b) => {
      if (a.status === 'open' && b.status !== 'open') return -1
      if (a.status !== 'open' && b.status === 'open') return 1
      return 0
    })
    jobsByCandidate.set(candidateId, jobs)
  }

  const results: SearchResult[] = candidates.map(candidate => {
    const candidateJobs = jobsByCandidate.get(candidate.id) || []
    
    let subtitle: string
    if (candidateJobs.length === 0) {
      subtitle = 'No associated jobs'
    } else if (candidateJobs.length === 1) {
      subtitle = candidateJobs[0].title
    } else {
      subtitle = `${candidateJobs[0].title} +${candidateJobs.length - 1}`
    }

    return {
      id: candidate.id,
      type: 'candidate' as const,
      title: candidate.candidate_name,
      subtitle,
      metadata: [candidate.location_city, candidate.location_country].filter(Boolean).join(', ') || 'No location',
      route: `/candidates?openCandidate=${candidate.id}`,
      icon: Users
    }
  })

  return { results, count: count || 0 }
}

async function searchSourcingProjects(query: string, limit: number, userId: string) {
  const searchPattern = `%${query}%`
  
  const { count } = await (supabase
    .from('sourcing_projects')
    .select('id', { count: 'exact', head: true }) as any)
    .eq('created_by', userId)
    .or(`name.ilike.${searchPattern},description.ilike.${searchPattern}`)

  const { data, error } = await (supabase
    .from('sourcing_projects')
    .select('id, name, description, updated_at') as any)
    .eq('created_by', userId)
    .or(`name.ilike.${searchPattern},description.ilike.${searchPattern}`)
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (error) throw error

  const results: SearchResult[] = (data || []).map(project => ({
    id: project.id,
    type: 'sourcing_project' as const,
    title: project.name,
    subtitle: project.description || 'No description',
    metadata: `Updated ${formatRelativeTime(project.updated_at)}`,
    route: `/find/${project.id}`,
    icon: Target
  }))

  return { results, count: count || 0 }
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  return `${Math.floor(diffDays / 30)} months ago`
}
