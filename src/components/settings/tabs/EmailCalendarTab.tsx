import { SettingsCard } from '@/components/settings/shared/SettingsCard'
import { EmailSettingsTab } from '@/components/settings/EmailSettingsTab'
import CalendarSettingsTab from '@/components/settings/CalendarSettingsTab'

/**
 * Phase 2 wrapper: hosts the existing Email + Calendar identity managers under
 * the new Settings · Email & calendar route. Avoids duplicating OAuth logic.
 */
export function EmailCalendarTab() {
  return (
    <div className="space-y-4">
      <SettingsCard
        title="Email"
        description="Connect Gmail or Outlook to send candidate emails from your own address. Send-only — we never read your inbox."
      >
        <EmailSettingsTab />
      </SettingsCard>
      <SettingsCard
        title="Calendar"
        description="Two-way sync for interviews and bookings. We read free/busy and write events you create from Gio."
      >
        <CalendarSettingsTab />
      </SettingsCard>
    </div>
  )
}
