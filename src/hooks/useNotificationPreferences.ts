import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'

export type CategoryKey =
  | 'mention'
  | 'application_batch'
  | 'scorecard_submitted'
  | 'interview_event'
  | 'offer_event'
  | 'posting_status'
  | 'daily_digest'

export interface NotificationPreferences {
  user_id: string
  mention_in_app: boolean; mention_email: boolean; mention_push: boolean
  application_batch_in_app: boolean; application_batch_email: boolean; application_batch_push: boolean
  scorecard_submitted_in_app: boolean; scorecard_submitted_email: boolean; scorecard_submitted_push: boolean
  interview_event_in_app: boolean; interview_event_email: boolean; interview_event_push: boolean
  offer_event_in_app: boolean; offer_event_email: boolean; offer_event_push: boolean
  posting_status_in_app: boolean; posting_status_email: boolean; posting_status_push: boolean
  daily_digest_in_app: boolean; daily_digest_email: boolean; daily_digest_push: boolean
  quiet_hours_enabled: boolean
  quiet_hours_start: string | null
  quiet_hours_end: string | null
  quiet_hours_tz: string | null
  sound_on_mention: boolean
}

export const PREFS_CATEGORIES: { key: CategoryKey; label: string; description: string }[] = [
  { key: 'mention', label: 'Mentions & comments', description: 'When teammates @ you' },
  { key: 'application_batch', label: 'New applications', description: 'On jobs you own' },
  { key: 'scorecard_submitted', label: 'Scorecards submitted', description: 'On candidates you’re tracking' },
  { key: 'interview_event', label: 'Interview events', description: 'Confirmed, declined, rescheduled' },
  { key: 'offer_event', label: 'Offers & acceptances', description: '' },
  { key: 'posting_status', label: 'Job posting status', description: 'Expiry, traffic anomalies' },
  { key: 'daily_digest', label: 'Daily digest', description: 'Monday – Friday, 9:00 AM' },
]

export function useNotificationPreferences() {
  const { user } = useAuth()
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['notification-preferences', user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<NotificationPreferences | null> => {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle()
      if (error) throw error
      if (data) return data as NotificationPreferences
      // Auto-create defaults
      const { data: ins, error: insErr } = await supabase
        .from('notification_preferences')
        .insert({ user_id: user!.id })
        .select('*')
        .single()
      if (insErr) throw insErr
      return ins as NotificationPreferences
    },
  })

  const save = useMutation({
    mutationFn: async (patch: Partial<NotificationPreferences>) => {
      const { error } = await supabase
        .from('notification_preferences')
        .update(patch)
        .eq('user_id', user!.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notification-preferences', user?.id] }),
  })

  return { ...query, save }
}
