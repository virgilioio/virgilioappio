import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { toast } from '@/hooks/use-toast'

interface Args {
  booking_id: string
  new_email: string
}

async function extractDetails(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const text = await error.context.text()
      return text || error.message
    } catch {
      return error.message
    }
  }
  return (error as Error)?.message || 'Please try again.'
}

export function useUpdateBookingAttendee(opts?: {
  onSuccess?: (newEmail: string) => void
  invalidateKeys?: Array<readonly unknown[]>
}) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ booking_id, new_email }: Args) => {
      const { data, error } = await supabase.functions.invoke('update-booking-attendee', {
        body: { booking_id, new_email },
      })
      if (error) {
        const details = await extractDetails(error)
        throw new Error(details)
      }
      return data as { success: true; new_email: string }
    },
    onSuccess: (_data, vars) => {
      for (const key of opts?.invalidateKeys ?? []) {
        queryClient.invalidateQueries({ queryKey: key })
      }
      queryClient.invalidateQueries({ queryKey: ['scheduled-bookings'] })
      queryClient.invalidateQueries({ queryKey: ['stage-bookings'] })
      toast({
        title: 'Invite updated',
        description: `A new invite has been sent to ${vars.new_email}.`,
      })
      opts?.onSuccess?.(vars.new_email)
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Update failed', description: err.message })
    },
  })
}
