import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'

export type NotificationCategory =
  | 'mention'
  | 'application_batch'
  | 'scorecard_submitted'
  | 'interview_event'
  | 'offer_event'
  | 'posting_status'
  | 'daily_digest'

export type NotificationChannel = 'in_app' | 'email' | 'push'

export interface NotificationPreferences {
  user_id: string
  mention_in_app: boolean
  mention_email: boolean
  mention_push: boolean
  application_batch_in_app: boolean
  application_batch_email: boolean
  application_batch_push: boolean
  scorecard_submitted_in_app: boolean
  scorecard_submitted_email: boolean
  scorecard_submitted_push: boolean
  interview_event_in_app: boolean
  interview_event_email: boolean
  interview_event_push: boolean
  offer_event_in_app: boolean
  offer_event_email: boolean
  offer_event_push: boolean
  posting_status_in_app: boolean
  posting_status_email: boolean
  posting_status_push: boolean
  daily_digest_in_app: boolean
  daily_digest_email: boolean
  daily_digest_push: boolean
  quiet_hours_enabled: boolean
  quiet_hours_start: string | null
  quiet_hours_end: string | null
  quiet_hours_tz: string
  sound_on_mention: boolean
}

const DEFAULTS: Omit<NotificationPreferences, 'user_id'> = {
  mention_in_app: true,
  mention_email: true,
  mention_push: false,
  application_batch_in_app: true,
  application_batch_email: false,
  application_batch_push: false,
  scorecard_submitted_in_app: true,
  scorecard_submitted_email: false,
  scorecard_submitted_push: false,
  interview_event_in_app: true,
  interview_event_email: true,
  interview_event_push: false,
  offer_event_in_app: true,
  offer_event_email: true,
  offer_event_push: false,
  posting_status_in_app: true,
  posting_status_email: false,
  posting_status_push: false,
  daily_digest_in_app: false,
  daily_digest_email: false,
  daily_digest_push: false,
  quiet_hours_enabled: false,
  quiet_hours_start: '22:00',
  quiet_hours_end: '08:00',
  quiet_hours_tz:
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  sound_on_mention: false,
}

export function useNotificationPreferences() {
  const { user } = useAuth()
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    setLoading(true)
    ;(async () => {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()
      if (cancelled) return
      if (error) {
        console.error('Failed to load notification prefs', error)
      }
      setPrefs(
        (data as NotificationPreferences | null) ?? {
          user_id: user.id,
          ...DEFAULTS,
        },
      )
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [user?.id])

  const update = useCallback(
    async (patch: Partial<NotificationPreferences>) => {
      if (!user?.id || !prefs) return
      const next = { ...prefs, ...patch }
      setPrefs(next)
      const { error } = await supabase
        .from('notification_preferences')
        .upsert({ ...next, user_id: user.id }, { onConflict: 'user_id' })
      if (error) {
        toast.error('Could not save preference')
        console.error(error)
      }
    },
    [user?.id, prefs],
  )

  return { prefs, loading, update }
}
