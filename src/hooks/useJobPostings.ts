
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/hooks/use-toast'

export interface JobPosting {
  id: string
  job_id: string
  title: string
  slug: string
  description: string | null
  details: any
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

// Helper to create a URL-friendly slug and reduce collisions with a short suffix
function generateSlug(input: string) {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')

  const suffix = Math.random().toString(36).slice(2, 8)
  return `${base}-${suffix}`
}

export function useJobPostings(jobId: string) {
  const { toast } = useToast()
  const [postings, setPostings] = useState<JobPosting[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const fetchPostings = useCallback(async () => {
    setIsLoading(true)
    const { data, error } = await supabase
      .from('job_postings')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false })
    if (error) {
      console.error('Error loading postings:', error)
      toast({ title: 'Error', description: 'Failed to load postings', variant: 'destructive' })
      setPostings([])
    } else {
      setPostings((data || []) as JobPosting[])
    }
    setIsLoading(false)
  }, [jobId, toast])

  useEffect(() => {
    fetchPostings()
  }, [fetchPostings])

  const getPosting = useCallback(async (id: string) => {
    const { data, error } = await supabase
      .from('job_postings')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) {
      console.error('Error fetching posting:', error)
      return null
    }
    return data as JobPosting | null
  }, [])

  const createPosting = useCallback(async ({ title, description, details }: { title: string; description?: string; details?: any }) => {
    const slug = generateSlug(title)
    const { data, error } = await supabase
      .from('job_postings')
      .insert({
        job_id: jobId,
        title,
        description: description || null,
        slug,
        details: details ?? {},
      })
      .select()
      .maybeSingle()
    if (error) {
      console.error('Error creating posting:', error)
      toast({ title: 'Error', description: 'Could not create posting', variant: 'destructive' })
      return null
    }
    await fetchPostings()
    return data as JobPosting
  }, [jobId, fetchPostings, toast])

  const updatePosting = useCallback(async (id: string, updates: Partial<JobPosting>) => {
    const { error } = await supabase
      .from('job_postings')
      .update(updates)
      .eq('id', id)
    if (error) {
      console.error('Error updating posting:', error)
      toast({ title: 'Error', description: 'Could not update posting', variant: 'destructive' })
    } else {
      await fetchPostings()
    }
  }, [fetchPostings, toast])

  const deletePosting = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('job_postings')
      .delete()
      .eq('id', id)
    if (error) {
      console.error('Error deleting posting:', error)
      toast({ title: 'Error', description: 'Could not delete posting', variant: 'destructive' })
    } else {
      toast({ title: 'Deleted', description: 'Posting removed' })
      await fetchPostings()
    }
  }, [fetchPostings, toast])

  const duplicatePosting = useCallback(async (sourcePostingId: string, overrides?: { title?: string; description?: string; details?: any }) => {
    const { data, error } = await supabase.rpc('duplicate_job_posting', {
      source_posting_id: sourcePostingId,
      new_title: overrides?.title ?? null,
      new_description: overrides?.description ?? null,
      new_details: overrides?.details ?? null,
    })
    if (error) {
      console.error('Error duplicating posting:', error)
      toast({ title: 'Error', description: 'Could not duplicate posting', variant: 'destructive' })
      return null
    }
    await fetchPostings()
    return data as unknown as string | null
  }, [fetchPostings, toast])

  return { postings, isLoading, refetch: fetchPostings, createPosting, updatePosting, deletePosting, duplicatePosting, getPosting }
}
