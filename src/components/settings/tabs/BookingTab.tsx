import { SettingsCard } from '@/components/settings/shared/SettingsCard'
import { BookingLinkSection } from '@/components/settings/BookingLinkSection'

/**
 * Phase 2 wrapper: hosts the existing booking link + event types editor under
 * Settings · Booking & event types.
 */
export function BookingTab() {
  return (
    <div className="space-y-4">
      <SettingsCard
        title="Public booking page"
        description="Share one link. Candidates pick a time that fits your real calendar and any rules you set."
      >
        <BookingLinkSection />
      </SettingsCard>
    </div>
  )
}
