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
  hiring_team_names: string[] | null // Add resolved names for filtering
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
  hiring_team?: any[]
}

export function useJobs() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { user, userType, organizationId } = useAuth()

  const resolveHiringTeamNames = async (jobs: any[]) => {
    // Collect all unique user IDs from hiring teams
    const userIds = new Set<string>()
    jobs.forEach(job => {
      if (job.hiring_team && Array.isArray(job.hiring_team)) {
        job.hiring_team.forEach((member: any) => {
          if (typeof member === 'string') {
            userIds.add(member)
          } else if (member?.user_id) {
            userIds.add(member.user_id)
          } else if (member?.id) {
            userIds.add(member.id)
          }
        })
      }
    })

    // Fetch profiles for all user IDs
    let profilesMap: Record<string, string> = {}
    if (userIds.size > 0) {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name')
        .in('user_id', Array.from(userIds))

      if (!error && profiles) {
        profilesMap = profiles.reduce((acc, profile) => {
          const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ')
          acc[profile.user_id] = fullName || 'Unknown User'
          return acc
        }, {} as Record<string, string>)
      }
    }

    // Update jobs with resolved names
    return jobs.map(job => {
      const hiringTeamNames: string[] = []
      if (job.hiring_team && Array.isArray(job.hiring_team)) {
        job.hiring_team.forEach((member: any) => {
          let userId: string | null = null
          let existingName: string | null = null

          if (typeof member === 'string') {
            userId = member
          } else if (member?.user_id) {
            userId = member.user_id
            existingName = member.name
          } else if (member?.id) {
            userId = member.id
            existingName = member.name
          } else if (member?.name) {
            existingName = member.name
          }

          if (existingName) {
            hiringTeamNames.push(existingName)
          } else if (userId && profilesMap[userId]) {
            hiringTeamNames.push(profilesMap[userId])
          }
        })
      }

      return {
        ...job,
        hiring_team_names: hiringTeamNames
      }
    })
  }

  const getJobs = async () => {
    if (!user) return

    setIsLoading(true)
    setError(null)

    try {
      console.log('Fetching jobs for user:', user.id, 'userType:', userType, 'organizationId:', organizationId)
      
      // Build query based on user type and organization
      let query = supabase
        .from('jobs')
        .select('*')
        .order('created_at', { ascending: false })

      // Get member role to determine filtering strategy
      const { data: memberData } = await supabase
        .from('members')
        .select('member_role')
        .eq('user_id', user.id)
        .eq('organization_id', organizationId || '')
        .single()

      const memberRole = memberData?.member_role
      const isRecruiter = memberRole === 'recruiter'
      const isGuest = userType === 'guest'

      // Apply filtering based on user role
      if (userType === 'platform_admin') {
        // Platform admins see all jobs - no additional filtering needed
        console.log('Platform admin - showing all jobs')
      } else if (isGuest) {
        // Guest users can ONLY see jobs they are specifically assigned to via job_assignments
        console.log('Guest user - will filter to only assigned jobs across all organizations')
        // Don't filter by organization here - we'll do it after getting job assignments
      } else if (isRecruiter) {
        // Recruiters can see jobs across organizations if they're assigned
        console.log('Recruiter - will filter by assignments across all organizations')
        // Don't filter by organization here - we'll do it after getting job assignments
      } else if (organizationId) {
        console.log('Filtering jobs for organization:', organizationId)
        query = query.eq('organization_id', organizationId)
      }

      const { data: jobsData, error: fetchError } = await query

      if (fetchError) {
        console.error('Error fetching jobs:', fetchError)
        throw fetchError
      }

      console.log('Fetched jobs data:', jobsData)

      // Client-side filtering based on user type and role
      let filteredJobs = jobsData || []
      
      if (userType !== 'platform_admin' && organizationId) {
        if (isGuest) {
          console.log('Applying STRICT guest filtering - only assigned jobs via job_assignments table')
          
          // Get job assignments for this guest user across ALL organizations
          const { data: jobAssignments, error: assignmentsError } = await supabase
            .from('job_assignments')
            .select('job_id')
            .eq('user_id', user.id)

          if (assignmentsError) {
            console.error('Error fetching job assignments:', assignmentsError)
          }

          const assignedJobIds = new Set(jobAssignments?.map(assignment => assignment.job_id) || [])
          console.log('Guest user assigned to jobs via job_assignments table:', Array.from(assignedJobIds))

          // Guest users can ONLY see jobs they are explicitly assigned to
          filteredJobs = filteredJobs.filter(job => {
            const isAssignedViaTable = assignedJobIds.has(job.id)
            
            if (isAssignedViaTable) {
              console.log(`Guest has access to job "${job.title}" from organization ${job.organization_id} via job_assignments`)
            }
            
            return isAssignedViaTable
          })
          
          console.log(`Guest filtered jobs: ${filteredJobs.length} out of ${jobsData?.length || 0}`)
          console.log('Accessible job titles for guest:', filteredJobs.map(job => job.title))
        } else if (isRecruiter) {
          console.log('Applying recruiter filtering for hiring team membership and job assignments across all organizations')
          
          // Get job assignments for this recruiter across ALL organizations
          const { data: jobAssignments, error: assignmentsError } = await supabase
            .from('job_assignments')
            .select('job_id')
            .eq('user_id', user.id)

          if (assignmentsError) {
            console.error('Error fetching job assignments:', assignmentsError)
          }

          const assignedJobIds = new Set(jobAssignments?.map(assignment => assignment.job_id) || [])
          console.log('Recruiter assigned to jobs via job_assignments table:', Array.from(assignedJobIds))

          filteredJobs = filteredJobs.filter(job => {
            // Check if user is in hiring_team array
            const hiringTeam = Array.isArray(job.hiring_team) ? job.hiring_team : []
            const isInHiringTeam = hiringTeam.some((member: any) => 
              member?.user_id === user.id || member?.id === user.id || member === user.id
            )
            
            // Check if user is assigned via job_assignments table
            const isAssignedViaTable = assignedJobIds.has(job.id)
            
            const hasAccess = isInHiringTeam || isAssignedViaTable
            
            if (hasAccess) {
              console.log(`Recruiter has access to job "${job.title}" from organization ${job.organization_id} via ${isInHiringTeam ? 'hiring_team' : 'job_assignments'}`)
            }
            
            return hasAccess
          })
          
          console.log(`Recruiter filtered jobs: ${filteredJobs.length} out of ${jobsData?.length || 0}`)
          console.log('Accessible job titles:', filteredJobs.map(job => job.title))
        }
      }

      // Fetch organization names separately for jobs that don't belong to current user's org
      const organizationIds = [...new Set(filteredJobs.map(job => job.organization_id).filter(Boolean))]
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

      // Resolve hiring team member names
      const jobsWithResolvedNames = await resolveHiringTeamNames(filteredJobs)

      // Transform the data to match our Job interface
      const transformedJobs = jobsWithResolvedNames.map(job => ({
        ...job,
        hiring_team: Array.isArray(job.hiring_team) ? job.hiring_team : [],
        organization_name: organizationsMap[job.organization_id] || 'Unknown Organization'
      }))
      
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

      // Resolve hiring team names for single job
      const jobsWithResolvedNames = await resolveHiringTeamNames([data])
      const jobWithResolvedNames = jobsWithResolvedNames[0]
      
      // Transform the data to match our Job interface
      const transformedJob = {
        ...jobWithResolvedNames,
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
    
    setIsLoading(true)
    setError(null)

    try {
      console.log('Creating job:', jobData)
      
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
        // Regular users can only create jobs for their own organization
        const userOrganizationId = user.user_metadata?.organization_id || organizationId
        if (!userOrganizationId) {
          throw new Error('No organization found for user')
        }
        targetOrganizationId = userOrganizationId
        console.log('Regular user creating job for their organization:', targetOrganizationId)
      }

      const { data: newJob, error: createError } = await supabase
        .from('jobs')
        .insert([{
          ...jobData,
          organization_id: targetOrganizationId,
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
  }, [user, userType, organizationId])

  // Add real-time subscriptions for jobs
  useEffect(() => {
    if (!user) return

    console.log('Setting up real-time subscriptions for jobs')

    // Subscribe to jobs changes
    const jobsChannel = supabase
      .channel('jobs-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'jobs'
        },
        (payload) => {
          console.log('Jobs table change detected:', payload)
          // Refresh jobs when changes occur
          getJobs()
        }
      )
      .subscribe()

    // Subscribe to job requests changes (to catch when they're approved and jobs are created)
    const jobRequestsChannel = supabase
      .channel('job-requests-changes')
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
      .channel('job-assignments-changes')
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
  }, [user, userType, organizationId])

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
