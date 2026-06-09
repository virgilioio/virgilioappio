
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { refreshOnboardingProgress } from '@/utils/refreshOnboardingProgress'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'
import { useJobSpecNormalization } from './useJobSpecNormalization'
import { withAuthRetry, extractErrorMessage } from '@/lib/authUtils'
import { log } from '@/lib/logger'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { logActivity } from '@/lib/activityLogger'
import { useUserJobRoles } from './useUserJobRoles'

export type JobWorkMode = 'remote' | 'hybrid' | 'onsite'
export type JobEmploymentType = 'full_time' | 'part_time' | 'contract' | 'internship' | 'temporary'

export interface Job {
  id: string
  title: string
  description: string | null
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
  hiring_team_names: string[] | null
  organization_id: string
  department_id?: string | null
  organization_name?: string
  created_by: string | null
  created_at: string
  updated_at: string
  standardized_skills?: string[] | null
  standardized_title?: string | null
  standardized_location?: string | null
  normalization_metadata?: any
  // New Job-information wizard fields
  internal_title?: string | null
  job_level?: string | null
  work_mode?: JobWorkMode | null
  employment_type?: JobEmploymentType | null
  additional_locations?: string[] | null
  show_salary_public?: boolean | null
  include_equity?: boolean | null
  include_signing_bonus?: boolean | null
  min_years_experience?: number | null
  max_years_experience?: number | null
}

export interface CreateJobData {
  title: string
  description?: string
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
  department_id?: string | null
  internal_title?: string
  job_level?: string
  work_mode?: JobWorkMode
  employment_type?: JobEmploymentType
  additional_locations?: string[]
  show_salary_public?: boolean
  include_equity?: boolean
  include_signing_bonus?: boolean
  min_years_experience?: number
  max_years_experience?: number
}

export interface UpdateJobData {
  title?: string
  description?: string
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
  department_id?: string | null
  internal_title?: string | null
  job_level?: string | null
  work_mode?: JobWorkMode | null
  employment_type?: JobEmploymentType | null
  additional_locations?: string[]
  show_salary_public?: boolean
  include_equity?: boolean
  include_signing_bonus?: boolean
  min_years_experience?: number | null
  max_years_experience?: number | null
}

// Cached tenant_id per organization to avoid repeated lookups
const tenantIdCache = new Map<string, string>()

async function resolveTenantId(organizationId: string): Promise<string | null> {
  if (tenantIdCache.has(organizationId)) return tenantIdCache.get(organizationId)!
  const { data } = await supabase
    .from('organizations')
    .select('tenant_id')
    .eq('id', organizationId)
    .single()
  const tid = data?.tenant_id || null
  if (tid) tenantIdCache.set(organizationId, tid)
  return tid
}

async function fetchJobs(userId: string, userType: string | null, organizationId: string | null): Promise<Job[]> {
  let tenantId: string | null = null
  if (organizationId) {
    tenantId = await resolveTenantId(organizationId)
  }

  let query = supabase
    .from('jobs')
    .select(`*, organizations!inner(id, name, tenant_id)`)
    .order('created_at', { ascending: false })

  if (tenantId) {
    query = query.eq('organizations.tenant_id', tenantId)
  }

  const { data, error } = await query
  if (error) throw error

  return (data || []).map((job: any) => ({
    ...job,
    hiring_team: Array.isArray(job.hiring_team) ? job.hiring_team : [],
    hiring_team_names: [],
    organization_name: job.organizations?.name || 'Unknown Organization'
  } as Job))
}

export function useJobs() {
  const { user, userId, userType, memberRole, organizationId } = useAuth()
  const { normalizeJobSpecs } = useJobSpecNormalization()
  const queryClient = useQueryClient()
  const { assignedJobIds, isPrivileged, isLoading: rolesLoading } = useUserJobRoles()
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const queryKey = ['jobs', organizationId] as const

  const { data: jobs = [], isLoading, error: queryError, refetch } = useQuery({
    queryKey,
    queryFn: () => fetchJobs(userId!, userType, organizationId),
    enabled: !!userId,
    staleTime: 60_000, // 1 minute
    refetchOnWindowFocus: false,
  })

  const error = queryError ? (queryError instanceof Error ? queryError.message : 'Failed to fetch jobs') : null

  // Backward-compat: external callers (dialogs, pages) can call getJobs() to refresh
  const getJobs = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['jobs'] })
  }, [queryClient])

  const getJob = async (id: string): Promise<Job> => {
    const { data, error: fetchError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError) throw fetchError

    let organizationName = 'Unknown Organization'
    if (data.organization_id) {
      const { data: orgData } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', data.organization_id)
        .single()
      if (orgData) organizationName = orgData.name
    }

    return {
      ...data,
      hiring_team: Array.isArray(data.hiring_team) ? data.hiring_team : [],
      hiring_team_names: [],
      organization_name: organizationName
    }
  }

  const createJob = async (jobData: CreateJobData) => {
    if (!user) throw new Error('User not authenticated')

    try {
      // Normalize job specs
      let normalizedData: any = {}
      const jobSpecs = {
        title: jobData.title,
        skills: jobData.skills,
        location: jobData.location || undefined
      }

      if (jobSpecs.title || jobSpecs.skills || jobSpecs.location) {
        const normalized = await normalizeJobSpecs(jobSpecs)
        if (normalized) {
          normalizedData = {
            standardized_title: normalized.standardized_title,
            standardized_skills: normalized.standardized_skills,
            standardized_location: normalized.standardized_location,
            normalization_metadata: normalized.normalization_metadata
          }
        }
      }

      let targetOrganizationId: string
      if (userType === 'platform_admin') {
        if (!jobData.organization_id) throw new Error('Organization must be specified for job creation')
        targetOrganizationId = jobData.organization_id
      } else if (userType === 'workspace_owner' || memberRole === 'admin') {
        if (!jobData.organization_id) throw new Error('Please select a job folder for this job')
        targetOrganizationId = jobData.organization_id
      } else {
        if (!organizationId) throw new Error('No organization context found for user')
        targetOrganizationId = organizationId
      }

      const tenantId = await resolveTenantId(targetOrganizationId)
      if (!tenantId) throw new Error('Could not determine tenant for organization')

      // If a department was selected, denormalize its name into jobs.department for legacy display
      let departmentName: string | undefined
      if (jobData.department_id) {
        const { data: deptRow } = await supabase
          .from('departments')
          .select('name')
          .eq('id', jobData.department_id)
          .maybeSingle()
        if (deptRow?.name) departmentName = deptRow.name
      }

      const { data: newJob, error: createError } = await withAuthRetry(async () =>
        await supabase
          .from('jobs')
          .insert([{
            ...jobData,
            ...normalizedData,
            ...(departmentName ? { department: departmentName } : {}),
            organization_id: targetOrganizationId,
            tenant_id: tenantId,
            created_by: user.id,
          }])
          .select()
          .single()
      )

      if (createError) throw createError

      toast({ title: 'Success', description: 'Job created successfully' })

      await logActivity({
        activityType: 'job_created',
        title: `Job created: ${newJob.title}`,
        description: `New job opening created`,
        entityType: 'job',
        entityId: newJob.id,
        organizationId: newJob.organization_id,
        metadata: {
          job_title: newJob.title,
          location: newJob.location,
          employment_type: newJob.department,
          status: newJob.status
        }
      })

      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      refreshOnboardingProgress(queryClient, user?.id, tenantId)

      return newJob
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create job'
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' })
      throw err
    }
  }

  const updateJob = async (id: string, jobData: UpdateJobData) => {
    try {
      const patch: Record<string, any> = { ...jobData }
      if (jobData.department_id) {
        const { data: deptRow } = await supabase
          .from('departments')
          .select('name')
          .eq('id', jobData.department_id)
          .maybeSingle()
        if (deptRow?.name) patch.department = deptRow.name
      }
      const { data: updatedJob, error: updateError } = await withAuthRetry(async () =>
        await supabase
          .from('jobs')
          .update(patch)
          .eq('id', id)
          .select()
          .single()
      )

      if (updateError) throw updateError

      toast({ title: 'Success', description: 'Job updated successfully' })

      await logActivity({
        activityType: 'job_updated',
        title: `Job updated: ${updatedJob.title}`,
        description: `Job details modified`,
        entityType: 'job',
        entityId: updatedJob.id,
        organizationId: updatedJob.organization_id,
        metadata: { updated_fields: Object.keys(jobData) }
      })

      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      if (jobData.status && jobData.status !== 'open') {
        queryClient.invalidateQueries({ queryKey: ['job-postings'] })
      }
      return updatedJob
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update job'
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' })
      throw err
    }
  }

  const archiveJob = async (id: string) => {
    try {
      const { data: archivedJob, error: archiveError } = await supabase
        .from('jobs')
        .update({ status: 'archived' })
        .eq('id', id)
        .select()
        .single()

      if (archiveError) throw archiveError

      toast({ title: 'Success', description: 'Job archived successfully' })

      await logActivity({
        activityType: 'job_archived',
        title: `Job archived: ${archivedJob.title}`,
        description: `Job moved to archived status`,
        entityType: 'job',
        entityId: archivedJob.id,
        organizationId: archivedJob.organization_id,
        metadata: { previous_status: 'open' }
      })

      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      return archivedJob
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to archive job'
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' })
      throw err
    }
  }

  const deleteJob = async (id: string) => {
    try {
      if (userType === 'platform_admin') {
        const { data, error: edgeFunctionError } = await supabase.functions.invoke('admin-operations', {
          body: { action: 'delete-job', job_id: id }
        })

        if (edgeFunctionError) throw edgeFunctionError
        if (!data?.success) throw new Error(data?.error || 'Failed to delete job')

        toast({ title: 'Success', description: data.message || 'Job deleted successfully' })
      } else {
        const { error: deleteError } = await withAuthRetry(async () =>
          await supabase.from('jobs').delete().eq('id', id)
        )
        if (deleteError) throw deleteError
        toast({ title: 'Success', description: 'Job deleted successfully' })
      }

      await logActivity({
        activityType: 'job_deleted',
        title: `Job deleted`,
        description: `Job permanently removed from system`,
        entityType: 'job',
        entityId: id,
        metadata: { deleted_by_admin: userType === 'platform_admin' }
      })

      queryClient.invalidateQueries({ queryKey: ['jobs'] })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete job'
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' })
      throw err
    }
  }

  // Debounced invalidation for real-time events
  const debouncedInvalidate = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
    }, 2000)
  }, [queryClient])

  // Real-time subscriptions
  useEffect(() => {
    if (!userId) return

    const channelId = Math.random().toString(36).substr(2, 9)

    const jobsChannel = supabase
      .channel(`jobs-changes-${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => debouncedInvalidate())
      .subscribe()

    const jobRequestsChannel = supabase
      .channel(`job-requests-changes-${channelId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'job_requests', filter: 'status=eq.approved' }, () => debouncedInvalidate())
      .subscribe()

    const jobAssignmentsChannel = supabase
      .channel(`job-assignments-changes-${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_assignments' }, () => debouncedInvalidate())
      .subscribe()

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      supabase.removeChannel(jobsChannel)
      supabase.removeChannel(jobRequestsChannel)
      supabase.removeChannel(jobAssignmentsChannel)
    }
  }, [userId, userType, organizationId, debouncedInvalidate])

  // Job-scoped filtering: non-privileged members only see assigned jobs
  const scopedJobs = useMemo(() => {
    if (isPrivileged) return jobs
    if (assignedJobIds.length === 0) return []
    const idSet = new Set(assignedJobIds)
    return jobs.filter(j => idSet.has(j.id))
  }, [jobs, assignedJobIds, isPrivileged])

  return {
    jobs: scopedJobs,
    isLoading: isLoading || rolesLoading,
    error,
    getJobs,
    getJob,
    createJob,
    updateJob,
    archiveJob,
    deleteJob
  }
}
