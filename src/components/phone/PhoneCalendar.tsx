import { useMemo, useState } from 'react'
import { addDays, startOfDay } from 'date-fns'
import { usePermissions } from '@/hooks/usePermissions'
import { useScheduledBookings } from '@/hooks/useScheduledBookings'
import { AgendaDays } from './PhoneAgenda'
import { BookingLinkCard } from './BookingLinkCard'
import { PhoneCard, PhonePage, PhoneSkeletonRows, PhoneTitle } from './PhoneUI'
import { LoadError } from '@/components/empty/LoadError'

/**
 * The calendar on a phone (2026-10-12): an agenda, two weeks at a time,
 * instead of the week grid. Scheduling and availability stay on the
 * computer.
 */
export default function PhoneCalendar() {
  const permissions = usePermissions()
  const [weeks, setWeeks] = useState(2)
  const start = useMemo(() => startOfDay(new Date()), [])
  const end = useMemo(() => addDays(start, weeks * 7), [start, weeks])
  const { bookings, isLoading, error, refetch } = useScheduledBookings(undefined, permissions, start, end)
  const live = useMemo(
    () => (bookings ?? []).filter(b => b.status !== 'cancelled' && new Date(b.scheduled_end).getTime() >= Date.now() - 15 * 60_000),
    [bookings],
  )

  return (
    <PhonePage>
      <PhoneTitle
        eyebrow="Calendar"
        title="Agenda"
        sub={isLoading ? 'Loading your interviews…' : `${live.length} ${live.length === 1 ? 'interview' : 'interviews'} in the next ${weeks * 7} days`}
      />
      {error && !bookings?.length ? (
        <PhoneCard><LoadError what="your calendar" compact onRetry={() => { void refetch() }} /></PhoneCard>
      ) : isLoading && !bookings?.length ? (
        <PhoneCard><PhoneSkeletonRows rows={4} /></PhoneCard>
      ) : (
        <AgendaDays bookings={live} emptyText={`Nothing booked in the next ${weeks * 7} days.`} />
      )}
      {!isLoading && weeks < 8 && (
        <button
          type="button"
          onClick={() => setWeeks(w => w + 2)}
          className="gio-pressable mt-4 inline-flex h-10 w-full items-center justify-center rounded-[10px] border border-[#E7E8EE] bg-white font-poppins font-semibold text-[13.5px] text-[#0d0d09]"
        >
          Show two more weeks
        </button>
      )}
      <div className="mt-6"><BookingLinkCard /></div>
    </PhonePage>
  )
}
