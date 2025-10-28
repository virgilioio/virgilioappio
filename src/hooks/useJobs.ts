
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'
import { useJobSpecNormalization } from './useJobSpecNormalization'
import { withAuthRetry, extractErrorMessage } from '@/lib/authUtils'
import { log } from '@/lib/logger'

export interface Job {
  id: string
  title: string
  description: string | null
  level?: 'L1 - Specialists' | 'L2 - Managers' | 'L3 - Directors / VPs / Executive Search' | 'L4 - C-Level' | null
  location: string | null
  department: string | null
  salary_min: number | null
  salary_max: number | null
  currency: string | null
  status: 'draft' | 'open' | 'closed' | 'archived'
  skills: string[] | null
  auto_generated_skills?: any
  last_skills_generation?: string | null
  hiring_team: any[] | null
  hiring_team_names: string[] | null // Add resolved names for filtering
  organization_id: string
  organization_name?: string
  created_by: string | null
  created_at: string
  updated_at: string
  // Standardization fields
  standardized_skills?: string[] | null
  standardized_title?: string | null
  standardized_location?: string | null
  normalization_metadata?: any
}

export interface CreateJobData {
  title: string
  description?: string
  level?: 'L1 - Specialists' | 'L2 - Managers' | 'L3 - Directors / VPs / Executive Search' | 'L4 - C-Level' | null
  location?: string
  department?: string
  salary_min?: number
  salary_max?: number
  currency?: string
  status?: 'draft' | 'open' | 'closed' | 'archived'
  skills?: string[]
  auto_generated_skills?: any
  last_skills_generation?: string
  hiring_team?: any[]
  organization_id?: string
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
  skills?: string[]
  auto_generated_skills?: any
  last_skills_generation?: string
  hiring_team?: any[]
}

export function useJobs() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { user, userId, userType, organizationId } = useAuth()
  const { normalizeJobSpecs } = useJobSpecNormalization()

  // Optimized single query function to replace N+1 pattern
  const getJobsOptimized = async () => {
    if (!user) return []

    console.log('Fetching jobs with optimized query for user:', user.id, 'userType:', userType, 'organizationId:', organizationId)

    // Build the main query with all JOINs to eliminate N+1 queries
    let baseQuery = `
      *,
      organizations!inner(id, name),
      job_assignments(user_id)
    `

    // Get user's current member role once
    const { data: memberData } = await supabase
      .from('members')
      .select('member_role, organization_id')
      .eq('user_id', user.id)
      .eq('organization_id', organizationId || '')
      .single()

    const memberRole = memberData?.member_role
    const isRecruiter = memberRole === 'recruiter'

    let query = supabase
      .from('jobs')
      .select(baseQuery)
      .order('created_at', { ascending: false })

    // RLS policies handle organization filtering:
    // - Virgilio staff: see all jobs in hierarchy (excluding SaaS)
    // - Other users: see only their org jobs
    // Guest/recruiter filtering applied below

    const { data: jobsData, error: fetchError } = await query

    if (fetchError) {
      console.error('Error fetching jobs:', fetchError)
      throw fetchError
    }

    console.log('Fetched jobs with optimized query:', jobsData?.length)

    let filteredJobs = jobsData || []

    // Apply role-based filtering for recruiter users
    if (isRecruiter) {
      // Get job assignments for this user (already optimized with indexes)
      const { data: jobAssignments } = await supabase
        .from('job_assignments')
        .select('job_id')
        .eq('user_id', user.id)

      const assignedJobIds = new Set(jobAssignments?.map(assignment => assignment.job_id) || [])

      filteredJobs = filteredJobs.filter((job: any) => {
        // Recruiters see jobs they're assigned to OR in their hiring team
        const isAssigned = assignedJobIds.has(job.id)
        const isInHiringTeam = Array.isArray(job.hiring_team) && 
          job.hiring_team.some((member: any) => 
            member?.user_id === user.id || member?.id === user.id || member === user.id
          )
        return isAssigned || isInHiringTeam
      })
    }

    // Transform data to include basic hiring team information
    return filteredJobs.map((job: any) => {
      return {
        ...job,
        hiring_team: Array.isArray(job.hiring_team) ? job.hiring_team : [],
        hiring_team_names: [], // Will be populated when needed
        organization_name: job.organizations?.name || 'Unknown Organization'
      } as Job
    })
  }

  const getJobs = useCallback(async () => {
    if (!user) return

    setIsLoading(true)
    setError(null)

    try {
      const jobsData = await getJobsOptimized()
      setJobs(jobsData)
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
  }, [user, userType, organizationId])

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
        hiring_team_names: [], // Single job fetch doesn't need complex resolution
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
    
    setIsLoading(true)
    setError(null)

    try {
      console.log('Creating job:', jobData)
      
      // Normalize job specs if skills/title/location are present
      let normalizedData: any = {}
      const jobSpecs = {
        title: jobData.title,
        skills: jobData.skills, // Add skills to CreateJobData interface
        location: jobData.location || undefined
      }
      
      if (jobSpecs.title || jobSpecs.skills || jobSpecs.location) {
        console.log('🔄 Normalizing job specs before creation:', jobSpecs)
        const normalized = await normalizeJobSpecs(jobSpecs)
        if (normalized) {
          normalizedData = {
            standardized_title: normalized.standardized_title,
            standardized_skills: normalized.standardized_skills,
            standardized_location: normalized.standardized_location,
            normalization_metadata: normalized.normalization_metadata
          }
          console.log('✅ Job specs normalized:', normalizedData)
        }
      }
      
      // Determine which organization to use based on user type
      let targetOrganizationId: string
      
      if (userType === 'platform_admin') {
        // Platform admins can create jobs for any organization they specify
        if (!jobData.organization_id) {
          throw new Error('Organization must be specified for job creation')
        }
        targetOrganizationId = jobData.organization_id
        console.log('Platform admin creating job for organization:', targetOrganizationId)
      } else {
        // Regular users can only create jobs for their own organization (from DB context)
        if (!organizationId) {
          throw new Error('No organization context found for user')
        }
        targetOrganizationId = organizationId
        console.log('Regular user creating job for their organization:', targetOrganizationId)
      }

      const { data: newJob, error: createError } = await withAuthRetry(async () =>
        await supabase
          .from('jobs')
          .insert([{
            ...jobData,
            ...normalizedData,
            organization_id: targetOrganizationId,
            created_by: user.id,
          }])
          .select()
          .single()
      )

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
      log.debug('Updating job:', id, jobData)
      const { data: updatedJob, error: updateError } = await withAuthRetry(async () =>
        await supabase
          .from('jobs')
          .update(jobData)
          .eq('id', id)
          .select()
          .single()
      )

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
      log.debug('Deleting job:', id)
      const { error: deleteError } = await withAuthRetry(async () =>
        await supabase
          .from('jobs')
          .delete()
          .eq('id', id)
      )

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
    if (userId) {
      getJobs()
    }
  }, [userId, userType, organizationId])

  // Add real-time subscriptions for jobs
  useEffect(() => {
    if (!userId) return

    console.log('🔄 Setting up real-time subscriptions for jobs')
    
    // Create unique channel names to avoid subscription conflicts
    const channelId = Math.random().toString(36).substr(2, 9)

    // Subscribe to jobs changes
    const jobsChannel = supabase
      .channel(`jobs-changes-${channelId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'jobs'
        },
        (payload) => {
          console.log('📡 Real-time job change detected:', payload)
          // Refresh jobs when changes occur
          getJobs()
        }
      )
      .subscribe((status) => {
        console.log('📡 Jobs subscription status:', status)
      })

    // Subscribe to job requests changes (to catch when they're approved and jobs are created)
    const jobRequestsChannel = supabase
      .channel(`job-requests-changes-${channelId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'job_requests',
          filter: 'status=eq.approved'
        },
        (payload) => {
          console.log('Job request approved:', payload)
          // Refresh jobs when a job request is approved
          setTimeout(() => {
            getJobs()
          }, 1000) // Small delay to ensure job creation is complete
        }
      )
      .subscribe()

    // Subscribe to job assignments changes to refresh when recruiters are assigned/unassigned
    const jobAssignmentsChannel = supabase
      .channel(`job-assignments-changes-${channelId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_assignments'
        },
        (payload) => {
          console.log('Job assignments change detected:', payload)
          // Refresh jobs when job assignments change
          getJobs()
        }
      )
      .subscribe()

    return () => {
      console.log('Cleaning up real-time subscriptions')
      supabase.removeChannel(jobsChannel)
      supabase.removeChannel(jobRequestsChannel)
      supabase.removeChannel(jobAssignmentsChannel)
    }
  }, [userId, userType, organizationId])

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
