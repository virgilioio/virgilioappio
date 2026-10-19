import { describe, expect, it, vi } from 'vitest'

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }))
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }))

import { inQuietHours } from '@/lib/notificationSound'
import { soundFor } from '@/hooks/useNotificationSound'
import type { NotificationRow } from '@/hooks/useNotifications'

const row = (o: Partial<NotificationRow>): NotificationRow => ({
  id: 'n', tenant_id: null, user_id: 'me', category: 'mention', actor_user_id: 'someone', actor_name: null,
  actor_avatar_url: null, title: 't', subtitle: null, preview: null, entity_kind: null, entity_id: null,
  job_id: null, candidate_id: null, action_url: null, metadata: {}, read_at: null, created_at: new Date().toISOString(), ...o,
})

describe('soundFor', () => {
  it('a mention of you plays the mention sound', () => {
    expect(soundFor(row({}), 'me')).toBe('mention')
  })
  it('an offer waiting for your approval, or a reminder, plays the approval sound', () => {
    expect(soundFor(row({ category: 'offer_event', metadata: { event: 'approval_requested' } }), 'me')).toBe('approval')
    expect(soundFor(row({ category: 'offer_event', metadata: { event: 'approval_reminder' } }), 'me')).toBe('approval')
    expect(soundFor(row({ category: 'offer_event', metadata: { event: 'approval_complete' } }), 'me')).toBe('approval')
  })
  it('other offer news, other categories, read rows and your own actions stay quiet', () => {
    expect(soundFor(row({ category: 'offer_event', metadata: { event: 'approved' } }), 'me')).toBeNull()
    expect(soundFor(row({ category: 'interview_event' }), 'me')).toBeNull()
    expect(soundFor(row({ read_at: new Date().toISOString() }), 'me')).toBeNull()
    expect(soundFor(row({ actor_user_id: 'me' }), 'me')).toBeNull()
  })
})

describe('inQuietHours', () => {
  const at = (iso: string) => new Date(iso)
  it('a window inside one day', () => {
    expect(inQuietHours('13:00', '14:00', 'UTC', at('2026-10-18T13:30:00Z'))).toBe(true)
    expect(inQuietHours('13:00', '14:00', 'UTC', at('2026-10-18T14:00:00Z'))).toBe(false)
  })
  it('a window across midnight, in the person\'s time zone', () => {
    // 23:30 in Mexico City is 05:30 UTC the next day.
    expect(inQuietHours('22:00', '08:00', 'America/Mexico_City', at('2026-10-19T05:30:00Z'))).toBe(true)
    expect(inQuietHours('22:00', '08:00', 'America/Mexico_City', at('2026-10-18T18:00:00Z'))).toBe(false)
  })
  it('no window when either end is missing or both are the same', () => {
    expect(inQuietHours(null, '08:00', 'UTC')).toBe(false)
    expect(inQuietHours('08:00', '08:00', 'UTC')).toBe(false)
  })
})
