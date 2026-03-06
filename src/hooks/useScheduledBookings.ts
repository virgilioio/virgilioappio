import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { toast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import type { PermissionsState } from '@/hooks/usePermissions'

export type BookingStatus = 'upcoming' | 'past'

export interface ScheduledBooking {
  id: string
  tenant_id: string | null
  interviewer_id: string
  candidate_id: string | null
  candidate_email: string
  candidate_name: string
  candidate_timezone: string | null
  scheduled_start: string
  scheduled_end: string
  duration_minutes: number
  meeting_location: string | null
  status: string
  notes: string | null
  created_at: string
  updated_at: string
  job_id: string | null
  job_hiring_stage_id: string | null
  last_synced_at?: string | null
  sync_source?: string | null
  sync_errors?: Array<{
    timestamp: string
    error_message: string
    event_id: string
  }> | null
  google_calendar_cancelled?: boolean | null
  interviewer_profile?: {
    user_id: string
    first_name: string | null
    last_name: string | null
    email: string
    avatar_url: string | null
  }
  candidate?: {
    id: string
    candidate_name: string
    email: string | null
    phone: string | null
    linkedin_url: string | null
  }
  job?: {
    id: string
    title: string
  }
  stage?: {
    id: string
    stage_name: string
  }
  // Flag for simple/generic bookings (Calendly-like, no pipeline context)
  isSimpleBooking?: boolean
}

interface BookingFromDB {
  id: string
  tenant_id: string
  interviewer_id: string
  candidate_id: string | null
  candidate_email: string
  candidate_name: string
  candidate_timezone: string | null
  scheduled_start: string
  scheduled_end: string
  duration_minutes: number
  meeting_location: string | null
  status: string
  notes: string | null
  created_at: string
  updated_at: string
  job_id: string | null
  job_hiring_stage_id: string | null
  candidates?: {
    id: string
    candidate_name: string
    email: string | null
    phone: string | null
    linkedin_url: string | null
  } | null
  jobs?: {
    id: string
    title: string
  } | null
  job_hiring_stages?: {
    id: string
    job_stages?: {
      stage_name: string
    } | null
  } | null
}

export function useScheduledBookings(status?: BookingStatus, permissions?: PermissionsState) {
  const { user, organizationId } = useAuth()
  const queryClient = useQueryClient()

  const { data: bookings, isLoading } = useQuery({
    queryKey: ['scheduled-bookings', user?.id, status, organizationId],
    queryFn: async () => {
      if (!user) return []

      // CRITICAL: Get user's tenant_id for multi-tenancy isolation
      const { data: memberData } = await supabase
        .from('members')
        .select('tenant_id')
        .eq('user_id', user.id)
        .eq('user_status', 'active')
        .single()

      const userTenantId = memberData?.tenant_id

      // Step 1: Get user's accessible job IDs (for recruiters/hiring managers)
      let accessibleJobIds: string[] = []
      
      if (permissions?.isMember && !permissions?.isAdmin) {
        // Get jobs user is assigned to
        const { data: assignments } = await supabase
          .from('job_assignments')
          .select('job_id')
          .eq('user_id', user.id)

        // Get jobs user created
        const { data: createdJobs } = await supabase
          .from('jobs')
          .select('id')
          .eq('created_by', user.id)

        accessibleJobIds = [
          ...(assignments?.map(a => a.job_id) || []),
          ...(createdJobs?.map(j => j.id) || []),
        ]
      }

      // Step 2: Build conditional query based on permissions
      let query = supabase
        .from('scheduled_bookings')
        .select(`
          *,
          candidates(id, candidate_name, email, phone, linkedin_url),
          jobs(id, title),
          job_hiring_stages(id, job_stages(stage_name))
        `)

      // CRITICAL: ALWAYS filter by tenant_id first to prevent cross-tenant data leakage
      // This applies to ALL users including platform admins
      if (userTenantId) {
        query = query.eq('tenant_id', userTenantId)
      }

      // Apply additional role-based visibility filters within the tenant
      if (permissions?.isPlatformAdmin || permissions?.isWorkspaceOwner || permissions?.isAdmin) {
        // Admins see all bookings within their tenant (tenant filter already applied above)
      } else if ((permissions?.isRecruiter || permissions?.isHiringManager) && accessibleJobIds.length > 0) {
        // Recruiters/hiring managers see bookings where they're interviewer OR for their jobs
        query = query.or(`interviewer_id.eq.${user.id},job_id.in.(${accessibleJobIds.join(',')})`)
      } else {
        // Default: only see bookings where user is the interviewer
        query = query.eq('interviewer_id', user.id)
      }

      // Apply status-based filters
      // Use scheduled_end for filtering so interviews remain visible during the meeting
      if (status === 'upcoming') {
        query = query
          .gte('scheduled_end', new Date().toISOString())
          .in('status', ['confirmed', 'rescheduled'])
          .order('scheduled_start', { ascending: true })
      } else if (status === 'past') {
        const startOfMonth = new Date()
        startOfMonth.setDate(1)
        startOfMonth.setHours(0, 0, 0, 0)
        query = query
          .gte('scheduled_start', startOfMonth.toISOString())
          .or(`scheduled_end.lt.${new Date().toISOString()},status.in.(completed,cancelled,no_show)`)
          .order('scheduled_start', { ascending: false })
      } else {
        query = query.order('scheduled_start', { ascending: false })
      }

      const { data, error } = await query

      if (error) throw error
      if (!data) return []

      // Fetch interviewer profiles separately
      const interviewerIds = [...new Set(data.map((b: any) => b.interviewer_id))]
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email, avatar_url')
        .in('user_id', interviewerIds)

      const profilesMap = new Map(profiles?.map(p => [p.user_id, p]) || [])

      return data.map((booking: BookingFromDB) => ({
        ...booking,
        interviewer_profile: profilesMap.get(booking.interviewer_id),
        candidate: booking.candidates || undefined,
        job: booking.jobs || undefined,
        stage: booking.job_hiring_stages?.job_stages ? {
          id: booking.job_hiring_stages.id,
          stage_name: booking.job_hiring_stages.job_stages.stage_name,
        } : undefined,
        // Flag simple/generic bookings (Calendly-like, no pipeline context)
        isSimpleBooking: !booking.job_id && !booking.candidate_id,
      })) as ScheduledBooking[]
    },
    enabled: !!user,
  })

  const cancelBookingMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const { error } = await supabase.functions.invoke('cancel-booking', {
        body: { booking_id: bookingId },
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-bookings'] })
      queryClient.invalidateQueries({ queryKey: ['booking-details'] })
      queryClient.invalidateQueries({ queryKey: ['next-interview'] })
      queryClient.invalidateQueries({ queryKey: ['candidate-all-bookings'] })
      queryClient.invalidateQueries({ queryKey: ['stage-bookings'] })
      queryClient.invalidateQueries({ queryKey: ['activity-feed'] })
      toast({
        title: 'Booking cancelled',
        description: 'The booking has been cancelled and notifications sent.',
      })
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Failed to cancel booking'
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      })
    },
  })

  const updateStatusMutation = useMutation({
    mutationFn: async ({ bookingId, status }: { bookingId: string; status: string }) => {
      const { error } = await supabase
        .from('scheduled_bookings')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', bookingId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-bookings'] })
      queryClient.invalidateQueries({ queryKey: ['booking-details'] })
      queryClient.invalidateQueries({ queryKey: ['next-interview'] })
      queryClient.invalidateQueries({ queryKey: ['candidate-all-bookings'] })
      queryClient.invalidateQueries({ queryKey: ['stage-bookings'] })
      queryClient.invalidateQueries({ queryKey: ['activity-feed'] })
      toast({
        title: 'Status updated',
        description: 'The booking status has been updated.',
      })
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Failed to update status'
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      })
    },
  })

  return {
    bookings: bookings || [],
    isLoading,
    cancelBooking: cancelBookingMutation.mutate,
    updateStatus: updateStatusMutation.mutate,
    isCancelling: cancelBookingMutation.isPending,
    isUpdating: updateStatusMutation.isPending,
  }
}
