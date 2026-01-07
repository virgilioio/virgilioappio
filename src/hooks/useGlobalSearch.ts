import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
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

export function useGlobalSearch(
  query: string,
  options: UseGlobalSearchOptions = {}
): UseGlobalSearchReturn {
  const { limit = 5, debounceMs = 300, minQueryLength = 2 } = options
  
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [totalCounts, setTotalCounts] = useState({ jobs: 0, candidates: 0, sourcing_projects: 0 })
  
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Clear results if query is too short
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
        // Run all searches in parallel
        const [jobsResult, candidatesResult, sourcingResult] = await Promise.all([
          searchJobs(searchQuery, limit),
          searchCandidates(searchQuery, limit),
          searchSourcingProjects(searchQuery, limit)
        ])

        // Combine all results
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
  }, [query, limit, debounceMs, minQueryLength])

  return { results, isLoading, error, totalCounts }
}

async function searchJobs(query: string, limit: number) {
  const searchPattern = `%${query}%`
  
  // Get count first
  const { count } = await supabase
    .from('jobs')
    .select('id', { count: 'exact', head: true })
    .or(`title.ilike.${searchPattern},department.ilike.${searchPattern},location.ilike.${searchPattern},standardized_title.ilike.${searchPattern}`)
    .is('deleted_at', null)

  // Get limited results
  const { data, error } = await supabase
    .from('jobs')
    .select('id, title, department, location, status, organization_id')
    .or(`title.ilike.${searchPattern},department.ilike.${searchPattern},location.ilike.${searchPattern},standardized_title.ilike.${searchPattern}`)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (error) throw error

  const results: SearchResult[] = (data || []).map(job => ({
    id: job.id,
    type: 'job' as const,
    title: job.title,
    subtitle: job.department || 'No department',
    metadata: job.location || 'No location',
    route: `/jobs/${job.id}`,
    icon: Briefcase
  }))

  return { results, count: count || 0 }
}

async function searchCandidates(query: string, limit: number) {
  const searchPattern = `%${query}%`
  
  // Get count first
  const { count } = await supabase
    .from('candidates')
    .select('id', { count: 'exact', head: true })
    .or(`candidate_name.ilike.${searchPattern},email.ilike.${searchPattern},location_city.ilike.${searchPattern},role_current.ilike.${searchPattern}`)
    .is('deleted_at', null)

  // Get limited results
  const { data, error } = await supabase
    .from('candidates')
    .select('id, candidate_name, email, location_city, location_country, role_current, company_current')
    .or(`candidate_name.ilike.${searchPattern},email.ilike.${searchPattern},location_city.ilike.${searchPattern},role_current.ilike.${searchPattern}`)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (error) throw error

  const results: SearchResult[] = (data || []).map(candidate => ({
    id: candidate.id,
    type: 'candidate' as const,
    title: candidate.candidate_name,
    subtitle: candidate.email || 'No email',
    metadata: [candidate.location_city, candidate.location_country].filter(Boolean).join(', ') || 'No location',
    route: `/candidates/${candidate.id}`,
    icon: Users
  }))

  return { results, count: count || 0 }
}

async function searchSourcingProjects(query: string, limit: number) {
  const searchPattern = `%${query}%`
  
  // Get count first
  const { count } = await supabase
    .from('sourcing_projects')
    .select('id', { count: 'exact', head: true })
    .or(`name.ilike.${searchPattern},description.ilike.${searchPattern}`)

  // Get limited results
  const { data, error } = await supabase
    .from('sourcing_projects')
    .select('id, name, description, updated_at')
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
