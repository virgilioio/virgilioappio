import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useOrgContext } from '@/contexts/OrgContext'
import { usePermissions } from '@/hooks/usePermissions'
import { isRestrictedRole, fetchAssignedJobIds } from '@/utils/jobScoping'
import { toast } from '@/hooks/use-toast'

export interface CandidateReminder {
  id: string
  candidate_id: string
  job_id: string | null
  created_by: string
  organization_id: string
  tenant_id: string
  subject: string
  description: string | null
  due_at: string
  is_team_visible: boolean
  completed_at: string | null
  created_at: string
  updated_at: string
  // Joined fields
  candidate?: {
    id: string
    candidate_name: string
    email: string | null
  }
  job?: {
    id: string
    title: string
  } | null
  creator?: {
    first_name: string | null
    last_name: string | null
  }
}

interface CreateReminderInput {
  candidate_id: string
  job_id?: string | null
  subject: string
  description?: string | null
  due_at: string
  is_team_visible: boolean
}

interface UpdateReminderInput {
  id: string
  subject?: string
  description?: string | null
  due_at?: string
  is_team_visible?: boolean
  completed_at?: string | null
}

/**
 * Hook for fetching reminders for a specific candidate
 */
export function useCandidateReminders(candidateId: string | null | undefined, jobId?: string | null) {
  const { user } = useAuth()
  const { organizationId } = useOrgContext()
  const queryClient = useQueryClient()

  const queryKey = ['candidate-reminders', candidateId, jobId]

  // Get tenant_id from user's membership
  const { data: memberData } = useQuery({
    queryKey: ['user-tenant', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('members')
        .select('tenant_id')
        .eq('user_id', user?.id)
        .eq('user_status', 'active')
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data
    },
    enabled: !!user?.id
  })
  const tenantId = memberData?.tenant_id

  const { data: reminders = [], isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!candidateId) return []

      const query = supabase
        .from('candidate_reminders')
        .select(`
          *,
          candidate:candidates(id, candidate_name, email),
          job:jobs(id, title)
        `)
        .eq('candidate_id', candidateId)
        .is('completed_at', null)
        .order('due_at', { ascending: true })

      if (jobId) {
        query.eq('job_id', jobId)
      }

      const { data, error } = await query

      if (error) throw error
      return (data || []) as CandidateReminder[]
    },
    enabled: !!candidateId
  })

  const createMutation = useMutation({
    mutationFn: async (input: CreateReminderInput) => {
      if (!user?.id || !organizationId || !tenantId) {
        throw new Error('Not authenticated')
      }

      const { data, error } = await supabase
        .from('candidate_reminders')
        .insert({
          candidate_id: input.candidate_id,
          job_id: input.job_id || null,
          created_by: user.id,
          organization_id: organizationId,
          tenant_id: tenantId,
          subject: input.subject,
          description: input.description || null,
          due_at: input.due_at,
          is_team_visible: input.is_team_visible
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
      queryClient.invalidateQueries({ queryKey: ['dashboard-reminders'] })
      toast({ title: 'Reminder created', description: 'Your reminder has been set' })
    },
    onError: (error) => {
      console.error('Failed to create reminder:', error)
      toast({ title: 'Error', description: 'Failed to create reminder', variant: 'destructive' })
    }
  })

  const updateMutation = useMutation({
    mutationFn: async (input: UpdateReminderInput) => {
      const { id, ...updates } = input
      
      const { data, error } = await supabase
        .from('candidate_reminders')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
      queryClient.invalidateQueries({ queryKey: ['dashboard-reminders'] })
    },
    onError: (error) => {
      console.error('Failed to update reminder:', error)
      toast({ title: 'Error', description: 'Failed to update reminder', variant: 'destructive' })
    }
  })

  const completeMutation = useMutation({
    mutationFn: async (reminderId: string) => {
      const { data, error } = await supabase
        .from('candidate_reminders')
        .update({ completed_at: new Date().toISOString() })
        .eq('id', reminderId)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
      queryClient.invalidateQueries({ queryKey: ['dashboard-reminders'] })
      toast({ title: 'Reminder completed', description: 'Reminder marked as complete' })
    },
    onError: (error) => {
      console.error('Failed to complete reminder:', error)
      toast({ title: 'Error', description: 'Failed to complete reminder', variant: 'destructive' })
    }
  })

  const deleteMutation = useMutation({
    mutationFn: async (reminderId: string) => {
      const { error } = await supabase
        .from('candidate_reminders')
        .delete()
        .eq('id', reminderId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
      queryClient.invalidateQueries({ queryKey: ['dashboard-reminders'] })
      toast({ title: 'Reminder deleted' })
    },
    onError: (error) => {
      console.error('Failed to delete reminder:', error)
      toast({ title: 'Error', description: 'Failed to delete reminder', variant: 'destructive' })
    }
  })

  return {
    reminders,
    isLoading,
    error,
    createReminder: createMutation.mutate,
    updateReminder: updateMutation.mutate,
    completeReminder: completeMutation.mutate,
    deleteReminder: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isCompleting: completeMutation.isPending,
    isDeleting: deleteMutation.isPending
  }
}

/**
 * Hook for fetching reminders for the dashboard (current user's reminders)
 */
export function useDashboardReminders(tab: 'upcoming' | 'past' = 'upcoming') {
  const { user } = useAuth()
  const { organizationId } = useOrgContext()
  const permissions = usePermissions()
  const restricted = isRestrictedRole(permissions)
  const queryClient = useQueryClient()

  const queryKey = ['dashboard-reminders', tab, organizationId, restricted]

  const { data: reminders = [], isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!user?.id || !organizationId) return []

      // For restricted roles, fetch assigned job IDs
      let assignedJobIds: string[] | null = null
      if (restricted) {
        assignedJobIds = await fetchAssignedJobIds(user.id)
      }

      const now = new Date()
      const nowIso = now.toISOString()
      
      // Calculate current month boundaries
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
      const startOfMonthIso = startOfMonth.toISOString()
      const endOfMonthIso = endOfMonth.toISOString()

      let query = supabase
        .from('candidate_reminders')
        .select(`
          *,
          candidate:candidates(id, candidate_name, email),
          job:jobs(id, title)
        `)
        .eq('organization_id', organizationId)

      if (tab === 'upcoming') {
        query = query
          .is('completed_at', null)
          .or(`due_at.lt.${nowIso},and(due_at.gte.${startOfMonthIso},due_at.lte.${endOfMonthIso})`)
      } else {
        query = query
          .not('completed_at', 'is', null)
          .gte('completed_at', startOfMonthIso)
          .lte('completed_at', endOfMonthIso)
      }

      query = query.order('due_at', { ascending: tab === 'upcoming' })

      const { data, error } = await query

      if (error) throw error
      
      let results = (data || []) as CandidateReminder[]

      // For restricted roles, filter to assigned jobs OR reminders created by the user
      if (restricted && assignedJobIds) {
        const jobIdSet = new Set(assignedJobIds)
        results = results.filter(r => 
          r.created_by === user.id || // Always show own reminders
          (r.job_id && jobIdSet.has(r.job_id)) // Show reminders for assigned jobs
        )
      }

      return results
    },
    enabled: !!user?.id && !!organizationId
  })

  const completeMutation = useMutation({
    mutationFn: async (reminderId: string) => {
      const { data, error } = await supabase
        .from('candidate_reminders')
        .update({ completed_at: new Date().toISOString() })
        .eq('id', reminderId)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-reminders'] })
      queryClient.invalidateQueries({ queryKey: ['candidate-reminders'] })
      toast({ title: 'Reminder completed' })
    },
    onError: (error) => {
      console.error('Failed to complete reminder:', error)
      toast({ title: 'Error', description: 'Failed to complete reminder', variant: 'destructive' })
    }
  })

  return {
    reminders,
    isLoading,
    error,
    completeReminder: completeMutation.mutate,
    isCompleting: completeMutation.isPending
  }
}
