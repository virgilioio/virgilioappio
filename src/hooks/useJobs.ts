
import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'

export interface Job {
  id: string
  title: string
  description: string | null
  department: string | null
  level: 'L1 - Specialists' | 'L2 - Managers' | 'L3 - Directors / VPs / Executive Search' | 'L4 - C-Level'
  location: string | null
  salary_min: number | null
  salary_max: number | null
  currency: string | null
  hiring_team: string[] | null
  organization_id: string
  created_by: string | null
  status: 'draft' | 'open' | 'closed' | 'archived'
  created_at: string
  updated_at: string
  organization_name?: string
}

export interface CreateJobData {
  title: string
  description?: string | null
  department?: string | null
  level: 'L1 - Specialists' | 'L2 - Managers' | 'L3 - Directors / VPs / Executive Search' | 'L4 - C-Level'
  location?: string | null
  salary_min?: number | null
  salary_max?: number | null
  currency?: string | null
  hiring_team?: string[]
  organization_id: string
  status?: 'draft' | 'open' | 'closed' | 'archived'
}

export interface UpdateJobData {
  title?: string
  description?: string | null
  department?: string | null
  level?: 'L1 - Specialists' | 'L2 - Managers' | 'L3 - Directors / VPs / Executive Search' | 'L4 - C-Level'
  location?: string | null
  salary_min?: number | null
  salary_max?: number | null
  currency?: string | null
  hiring_team?: string[]
  status?: 'draft' | 'open' | 'closed' | 'archived'
}

export function useJobs() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()

  const getJobs = async () => {
    if (!user) return

    setIsLoading(true)
    setError(null)

    try {
      console.log('Fetching jobs for user:', user.id)
      const { data, error: fetchError } = await supabase
        .from('jobs')
        .select(`
          *,
          organizations!inner (
            name
          )
        `)
        .order('created_at', { ascending: false })

      if (fetchError) {
        console.error('Error fetching jobs:', fetchError)
        throw fetchError
      }

      console.log('Fetched jobs:', data)
      
      const jobsWithDetails = (data || []).map((job) => ({
        ...job,
        level: job.level as 'L1 - Specialists' | 'L2 - Managers' | 'L3 - Directors / VPs / Executive Search' | 'L4 - C-Level',
        status: job.status as 'draft' | 'open' | 'closed' | 'archived',
        hiring_team: Array.isArray(job.hiring_team) ? job.hiring_team as string[] : [],
        organization_name: job.organizations?.name
      }))

      setJobs(jobsWithDetails)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch jobs'
      console.error('Jobs fetch error:', err)
      setError(errorMessage)
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const getJob = async (id: string) => {
    setIsLoading(true)
    setError(null)

    try {
      console.log('Fetching job:', id)
      const { data, error: fetchError } = await supabase
        .from('jobs')
        .select(`
          *,
          organizations!inner (
            name
          )
        `)
        .eq('id', id)
        .single()

      if (fetchError) {
        console.error('Error fetching job:', fetchError)
        throw fetchError
      }

      console.log('Fetched job:', data)
      return {
        ...data,
        level: data.level as 'L1 - Specialists' | 'L2 - Managers' | 'L3 - Directors / VPs / Executive Search' | 'L4 - C-Level',
        status: data.status as 'draft' | 'open' | 'closed' | 'archived',
        hiring_team: Array.isArray(data.hiring_team) ? data.hiring_team as string[] : [],
        organization_name: data.organizations?.name
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch job'
      console.error('Job fetch error:', err)
      setError(errorMessage)
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const createJob = async (data: CreateJobData) => {
    setIsLoading(true)
    setError(null)

    try {
      console.log('Creating job:', data)
      const jobData = {
        ...data,
        created_by: user?.id
      }

      const { data: newJob, error: createError } = await supabase
        .from('jobs')
        .insert([jobData])
        .select()
        .single()

      if (createError) {
        console.error('Error creating job:', createError)
        throw createError
      }

      console.log('Created job:', newJob)
      toast({
        title: 'Success',
        description: 'Job created successfully'
      })

      await getJobs() // Refresh the list
      return newJob
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create job'
      console.error('Job creation error:', err)
      setError(errorMessage)
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const updateJob = async (id: string, data: UpdateJobData) => {
    setIsLoading(true)
    setError(null)

    try {
      console.log('Updating job:', id, data)
      const { data: updatedJob, error: updateError } = await supabase
        .from('jobs')
        .update(data)
        .eq('id', id)
        .select()
        .single()

      if (updateError) {
        console.error('Error updating job:', updateError)
        throw updateError
      }

      console.log('Updated job:', updatedJob)
      toast({
        title: 'Success',
        description: 'Job updated successfully'
      })

      await getJobs() // Refresh the list
      return updatedJob
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update job'
      console.error('Job update error:', err)
      setError(errorMessage)
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const archiveJob = async (id: string) => {
    setIsLoading(true)
    setError(null)

    try {
      console.log('Archiving job:', id)
      const { error: updateError } = await supabase
        .from('jobs')
        .update({ status: 'archived' })
        .eq('id', id)

      if (updateError) {
        console.error('Error archiving job:', updateError)
        throw updateError
      }

      console.log('Archived job:', id)
      toast({
        title: 'Success',
        description: 'Job archived successfully'
      })

      await getJobs() // Refresh the list
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to archive job'
      console.error('Job archiving error:', err)
      setError(errorMessage)
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (user) {
      getJobs()
    }
  }, [user])

  return {
    jobs,
    isLoading,
    error,
    getJobs,
    getJob,
    createJob,
    updateJob,
    archiveJob
  }
}
