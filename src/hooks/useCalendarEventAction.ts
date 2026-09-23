import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'

export type CalendarServerAction = 'move' | 'reschedule' | 'confirm' | 'resend' | 'cancel'

export interface CalendarActionRequest {
  event_id: string
  action: CalendarServerAction
  new_start?: string
  new_end?: string
  notify_candidate: boolean
  notify_interviewers: boolean
  message?: string
  reason?: string
  requeue?: boolean
}

/** Invokes the calendar-event-action edge function and refreshes the calendar. */
export function useCalendarEventAction() {
  const queryClient = useQueryClient()
  const [syncingEventId, setSyncingEventId] = useState<string | null>(null)
  const [isSubmitting, setSubmitting] = useState(false)

  const run = useCallback(
    async (req: CalendarActionRequest): Promise<{ ok: boolean; error?: string; warning?: string }> => {
      setSyncingEventId(req.event_id)
      setSubmitting(true)
      try {
        const { data, error } = await supabase.functions.invoke('calendar-event-action', {
          body: req,
        })
        if (error) {
          let details = error.message
          try {
            const ctx = (error as any).context
            if (ctx?.text) details = await ctx.text()
          } catch {
            /* keep original message */
          }
          console.error('[calendar-event-action] failed:', details)
          return { ok: false, error: details }
        }
        if (data && (data as any).error) {
          return { ok: false, error: String((data as any).error) }
        }
        return { ok: true, warning: (data as any)?.warning }
      } finally {
        setSyncingEventId(null)
        setSubmitting(false)
        queryClient.invalidateQueries({ queryKey: ['scheduled-bookings'] })
        queryClient.invalidateQueries({ queryKey: ['needs-scheduling-queue'] })
      }
    },
    [queryClient],
  )

  return { run, syncingEventId, isSubmitting }
}
