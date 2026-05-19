import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export interface JobWithPosting {
  id: string
  title: string
  department: string | null
  updated_at: string
  posting_id: string
  posting_details: any
  field_count: number
}

export function useJobsWithPostings(excludeJobId?: string | null) {
  const [jobs, setJobs] = useState<JobWithPosting[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('jobs')
        .select('id, title, department, updated_at, job_postings!inner(id, details)')
        .order('updated_at', { ascending: false })
        .limit(50)
      if (cancelled) return
      if (error) {
        console.error('useJobsWithPostings error', error)
        setJobs([])
      } else {
        const mapped: JobWithPosting[] = (data || [])
          .filter((j: any) => j.id !== excludeJobId)
          .map((j: any) => {
            const posting = Array.isArray(j.job_postings) ? j.job_postings[0] : j.job_postings
            const details = posting?.details ?? {}
            const fields =
              details?.application_fields ??
              details?.fields ??
              []
            return {
              id: j.id,
              title: j.title,
              department: j.department,
              updated_at: j.updated_at,
              posting_id: posting?.id,
              posting_details: details,
              field_count: Array.isArray(fields) ? fields.length : 0,
            }
          })
        setJobs(mapped)
      }
      setIsLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [excludeJobId])

  return { jobs, isLoading }
}
