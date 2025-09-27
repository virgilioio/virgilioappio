
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'
import { useJobSpecNormalization } from './useJobSpecNormalization'

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
  level: 'L1 - Specialists' | 'L2 - Managers' | 'L3 - Directors / VPs / Executive Search' | 'L4 - C-Level'
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
  const { user, userType, organizationId } = useAuth()
  const { normalizeJobSpecs } = useJobSpecNormalization()

  const resolveHiringTeamNames = async (jobs: any[]) => {
    console.log('Starting hiring team name resolution for', jobs.length, 'jobs')
    
    // Collect all unique member IDs from hiring teams
    const memberIds = new Set<string>()
    jobs.forEach(job => {
      if (job.hiring_team && Array.isArray(job.hiring_team)) {
        console.log(`Job "${job.title}" has hiring team:`, job.hiring_team)
        job.hiring_team.forEach((member: any) => {
          if (typeof member === 'string') {
            memberIds.add(member)
            console.log(`Found member ID string: ${member}`)
          } else if (member?.id) {
            memberIds.add(member.id)
            console.log(`Found member ID in object: ${member.id}`)
          }
        })
      }
    })

    console.log('All collected member IDs:', Array.from(memberIds))

    // Create a map from member ID to resolved name
    const memberIdToNameMap: Record<string, string> = {}
    
    if (memberIds.size > 0) {
      const memberIdsArray = Array.from(memberIds)
      
      // Fetch member records with their user information
      console.log('Fetching members and their profiles:', memberIdsArray)
      const { data: members, error: membersError } = await supabase
        .from('members')
        .select(`
          id,
          user_id, 
          invited_email,
          profiles(first_name, last_name, email)
        `)
        .in('id', memberIdsArray)

      if (membersError) {
        console.error('Error fetching members:', membersError)
      } else {
        console.log('Fetched members with profiles:', members)
        members?.forEach(member => {
          let resolvedName: string | null = null
          
          // If member has a user_id and profile data, use that
          if (member.user_id && member.profiles) {
            const profile = member.profiles
            const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ')
            if (fullName.trim()) {
              resolvedName = fullName
            } else if (profile.email) {
              resolvedName = profile.email
            }
          }
          
          // If no profile name found but member has invited_email, use that
          if (!resolvedName && member.invited_email) {
            resolvedName = member.invited_email
          }
          
          // Store the resolved name in our map
          if (resolvedName) {
            memberIdToNameMap[member.id] = resolvedName
            console.log(`Resolved member ${member.id} to name: ${resolvedName}`)
          } else {
            console.log(`Could not resolve name for member ${member.id}`)
          }
        })
      }

      console.log('Final member ID to name map:', memberIdToNameMap)
    }

    // Update jobs with resolved names using member IDs
    return jobs.map(job => {
      const hiringTeamNames: string[] = []
      if (job.hiring_team && Array.isArray(job.hiring_team)) {
        job.hiring_team.forEach((member: any) => {
          let memberId: string | null = null
          let existingName: string | null = null

          if (typeof member === 'string') {
            memberId = member
          } else if (member?.id) {
            memberId = member.id
            existingName = member.name
          } else if (member?.name) {
            existingName = member.name
          }

          // Use existing name if available, otherwise look up by member ID
          if (existingName) {
            hiringTeamNames.push(existingName)
          } else if (memberId && memberIdToNameMap[memberId]) {
            hiringTeamNames.push(memberIdToNameMap[memberId])
          } else if (memberId) {
            // Skip unresolved member IDs instead of creating fallback names
            // This prevents "User xyz..." entries from appearing in filters
            console.log(`No name found for member ID ${memberId}, skipping from hiring team display`)
          }
        })
      }

      console.log(`Job "${job.title}" resolved hiring team names:`, hiringTeamNames)
      return {
        ...job,
        hiring_team_names: hiringTeamNames
      }
    })
  }

  const getJobs = useCallback(async () => {
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
      // Debug logging for skills data before transformation
      console.log('Jobs data before transformation - checking skills:', filteredJobs.map(job => ({
        id: job.id,
        title: job.title,
        skills: job.skills,
        auto_generated_skills: job.auto_generated_skills,
        userType: userType
      })))

      const jobsWithResolvedNames = await resolveHiringTeamNames(filteredJobs)

      // Transform the data to match our Job interface
      const transformedJobs = jobsWithResolvedNames.map(job => ({
        ...job,
        hiring_team: Array.isArray(job.hiring_team) ? job.hiring_team : [],
        organization_name: organizationsMap[job.organization_id] || 'Unknown Organization'
      }))

      // Debug logging after transformation
      console.log('Jobs data after transformation - checking skills:', transformedJobs.map(job => ({
        id: job.id,
        title: job.title,
        skills: job.skills,
        auto_generated_skills: job.auto_generated_skills,
        userType: userType
      })))
      
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
  }, [user, userType, organizationId, normalizeJobSpecs])

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
          ...normalizedData,
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
          console.log('Jobs table change detected:', payload)
          // Refresh jobs when changes occur
          getJobs()
        }
      )
      .subscribe()

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
