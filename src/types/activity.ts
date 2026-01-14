import type { ScheduledBooking } from '@/hooks/useScheduledBookings'
import type { CandidateReminder } from '@/hooks/useCandidateReminders'

export type ActivityType = 'interview' | 'reminder'

export interface UnifiedActivity {
  type: ActivityType
  id: string
  candidateId: string
  candidateName: string
  jobId: string | null
  jobTitle: string | null
  dateTime: string // ISO string for sorting
  // Interview-specific
  interview?: ScheduledBooking
  // Reminder-specific
  reminder?: CandidateReminder
}
