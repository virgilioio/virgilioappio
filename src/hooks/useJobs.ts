import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'

export interface Job {
  id: string
  title: string
  description: string | null
  level: 'L1 - Specialists' | 'L2 - Managers' | 'L3 - Directors / VPs / Executive Search' | 'L4 - C-Level'
  location: string | null
  department: string | null
  salary_min: number | null
  salary_max: number | null
  currency: string | null
  status: 'draft' | 'open' | 'closed' | 'archived'
  hiring_team: any[] | null
  organization_id: string
  organization_name?: string
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CreateJobData {
  title: string
  description?: string
  level: 'L1 - Specialists' | 'L2 - Managers' | 'L3 - Directors / VPs / Executive Search' | 'L4 - C-Level'
  location?: string
  department?: string
  salary_min?: number
  salary_max?: number
  currency?: string
  status?: 'draft' | 'open' | 'closed' | 'archived'
  hiring_team?: any[]
}

export interface UpdateJobData {
  title?: string
  description?: string
  level?: 'L1 - Specialists' | 'L2 - Managers' | 'L3 - Directors / VPs / Executive Search' | 'L4 - C-Level'
  location?: string
  department?: string
  salary_min?: number
  salary_max?: number
  currency?: string
  status?: 'draft' | 'open' | 'closed' | 'archived'
  hiring_team?: any[]
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
      
      // Fetch jobs without join to avoid RLS conflicts
      const { data: jobsData, error: fetchError } = await supabase
        .from('jobs')
        .select('*')
        .order('created_at', { ascending: false })

      if (fetchError) {
        console.error('Error fetching jobs:', fetchError)
        throw fetchError
      }

      console.log('Fetched jobs data:', jobsData)

      // Fetch organization names separately
      const organizationIds = [...new Set(jobsData?.map(job => job.organization_id).filter(Boolean) || [])]
      let organizationsMap: Record<string, string> = {}

      if (organizationIds.length > 0) {
        const { data: orgsData, error: orgsError } = await supabase
          .from('organizations')
          .select('id, name')
          .in('id', organizationIds)

        if (!orgsError && orgsData) {
          organizationsMap = orgsData.reduce((acc, org) => {
            acc[org.id] = org.name
            return acc
          }, {} as Record<string, string>)
        }
      }

      // Transform the data to match our Job interface
      const transformedJobs = jobsData?.map(job => ({
        ...job,
        hiring_team: Array.isArray(job.hiring_team) ? job.hiring_team : [],
        organization_name: organizationsMap[job.organization_id] || 'Unknown Organization'
      })) || []
      
      setJobs(transformedJobs)
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

  const getJob = async (id: string): Promise<Job> => {
    setIsLoading(true)
    setError(null)

    try {
      console.log('Fetching job:', id)
      
      const { data, error: fetchError } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', id)
        .single()

      if (fetchError) {
        console.error('Error fetching job:', fetchError)
        throw fetchError
      }

      console.log('Fetched job:', data)

      // Fetch organization name separately
      let organizationName = 'Unknown Organization'
      if (data.organization_id) {
        const { data: orgData } = await supabase
          .from('organizations')
          .select('name')
          .eq('id', data.organization_id)
          .single()
        
        if (orgData) {
          organizationName = orgData.name
        }
      }
      
      // Transform the data to match our Job interface
      const transformedJob = {
        ...data,
        hiring_team: Array.isArray(data.hiring_team) ? data.hiring_team : [],
        organization_name: organizationName
      }
      
      return transformedJob
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

  const createJob = async (jobData: CreateJobData) => {
    if (!user) throw new Error('User not authenticated')
    
    const organizationId = user.user_metadata?.organization_id
    if (!organizationId) {
      throw new Error('No organization found for user')
    }

    setIsLoading(true)
    setError(null)

    try {
      console.log('Creating job:', jobData)
      const { data: newJob, error: createError } = await supabase
        .from('jobs')
        .insert([{
          ...jobData,
          organization_id: organizationId,
          created_by: user.id,
        }])
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

  const updateJob = async (id: string, jobData: UpdateJobData) => {
    setIsLoading(true)
    setError(null)

    try {
      console.log('Updating job:', id, jobData)
      const { data: updatedJob, error: updateError } = await supabase
        .from('jobs')
        .update(jobData)
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
      const { data: archivedJob, error: archiveError } = await supabase
        .from('jobs')
        .update({ status: 'archived' })
        .eq('id', id)
        .select()
        .single()

      if (archiveError) {
        console.error('Error archiving job:', archiveError)
        throw archiveError
      }

      console.log('Archived job:', archivedJob)
      toast({
        title: 'Success',
        description: 'Job archived successfully'
      })

      await getJobs() // Refresh the list
      return archivedJob
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to archive job'
      console.error('Job archive error:', err)
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

  const deleteJob = async (id: string) => {
    setIsLoading(true)
    setError(null)

    try {
      console.log('Deleting job:', id)
      const { error: deleteError } = await supabase
        .from('jobs')
        .delete()
        .eq('id', id)

      if (deleteError) {
        console.error('Error deleting job:', deleteError)
        throw deleteError
      }

      console.log('Deleted job:', id)
      toast({
        title: 'Success',
        description: 'Job deleted successfully'
      })

      await getJobs() // Refresh the list
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete job'
      console.error('Job deletion error:', err)
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
    archiveJob,
    deleteJob
  }
}
