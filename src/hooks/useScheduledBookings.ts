import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { toast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'

export type BookingStatus = 'upcoming' | 'past'

export interface ScheduledBooking {
  id: string
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
}

interface BookingFromDB {
  id: string
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

export function useScheduledBookings(status?: BookingStatus) {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const { data: bookings, isLoading } = useQuery({
    queryKey: ['scheduled-bookings', user?.id, status],
    queryFn: async () => {
      if (!user) return []
      
      let query = supabase
        .from('scheduled_bookings')
        .select(`
          *,
          candidates(id, candidate_name, email, phone, linkedin_url),
          jobs(id, title),
          job_hiring_stages(id, job_stages(stage_name))
        `)
        .eq('interviewer_id', user.id)

      if (status === 'upcoming') {
        query = query
          .gte('scheduled_start', new Date().toISOString())
          .in('status', ['confirmed', 'rescheduled'])
          .order('scheduled_start', { ascending: true })
      } else if (status === 'past') {
        query = query
          .or(`scheduled_start.lt.${new Date().toISOString()},status.in.(completed,cancelled,no_show)`)
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
