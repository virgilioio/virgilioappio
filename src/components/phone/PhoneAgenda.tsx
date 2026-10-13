import { format, isToday, isTomorrow } from 'date-fns'
import { Video, MapPin } from 'lucide-react'
import type { ScheduledBooking } from '@/hooks/useScheduledBookings'
import { PhoneCard, PhoneEmpty, Pill } from './PhoneUI'
import { Link } from 'react-router-dom'

/**
 * The agenda on a phone: interviews grouped by day, each with the time, who,
 * for which job and stage, and a Join button when there's a meeting link.
 * Tapping the person opens their glance.
 */

function joinUrl(b: ScheduledBooking): string | null {
  if (b.google_meet_link) return b.google_meet_link
  const loc = b.meeting_location?.trim()
  return loc && /^https?:\/\//i.test(loc) ? loc : null
}

export function dayLabel(d: Date): string {
  if (isToday(d)) return 'Today'
  if (isTomorrow(d)) return 'Tomorrow'
  return format(d, 'EEEE, MMM d')
}

export function groupByDay(bookings: ScheduledBooking[]): { key: string; date: Date; items: ScheduledBooking[] }[] {
  const groups = new Map<string, { key: string; date: Date; items: ScheduledBooking[] }>()
  for (const b of [...bookings].sort((a, b) => a.scheduled_start.localeCompare(b.scheduled_start))) {
    const d = new Date(b.scheduled_start)
    const key = format(d, 'yyyy-MM-dd')
    const g = groups.get(key) ?? { key, date: d, items: [] }
    g.items.push(b)
    groups.set(key, g)
  }
  return [...groups.values()]
}

export function AgendaRow({ b, next = false }: { b: ScheduledBooking; next?: boolean }) {
  const start = new Date(b.scheduled_start)
  const end = new Date(b.scheduled_end)
  const now = Date.now()
  const live = start.getTime() <= now && end.getTime() >= now
  const url = joinUrl(b)
  const name = b.candidate?.candidate_name || b.candidate_name || 'Interview'
  const where = b.meeting_location && !url ? b.meeting_location : null
  const context = [b.job?.title, b.stage?.stage_name].filter(Boolean).join(' · ')

  const who = (
    <>
      <div className="truncate font-inter font-semibold text-[14px] text-[#0d0d09]">{name}</div>
      <div className="mt-0.5 truncate font-inter text-[12.5px] text-[#5A6072]">{context || b.event_title || (b.isSimpleBooking ? 'Booked from your link' : 'Interview')}</div>
      {where && (
        <div className="mt-0.5 flex items-center gap-1 truncate font-inter text-[12px] text-[#6B7080]">
          <MapPin className="h-3 w-3 shrink-0" /> <span className="truncate">{where}</span>
        </div>
      )}
    </>
  )

  return (
    <div className="flex items-center gap-3 border-b border-[#F1F0EC] px-4 py-3 last:border-b-0">
      <div className="w-[52px] shrink-0">
        <div className="font-poppins font-semibold text-[14px] tabular-nums text-[#0d0d09]">{format(start, 'HH:mm')}</div>
        <div className="font-inter text-[11.5px] tabular-nums text-[#6B7080]">{b.duration_minutes} min</div>
      </div>
      <span aria-hidden className={`h-9 w-[3px] shrink-0 rounded-full ${live || next ? 'bg-[#6F3FF5]' : 'bg-[#E7E8EE]'}`} />
      {b.candidate_id ? (
        <Link to={`/candidates/${b.candidate_id}`} className="gio-pressable min-w-0 flex-1">{who}</Link>
      ) : (
        <div className="min-w-0 flex-1">{who}</div>
      )}
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={`gio-pressable inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] px-3 font-poppins font-semibold text-[13px] ${live || next ? 'bg-[#6F3FF5] text-white' : 'border border-[#E7E8EE] bg-white text-[#0d0d09]'}`}
        >
          <Video className="h-4 w-4" />
          Join
        </a>
      ) : live ? (
        <Pill tone="purple">Now</Pill>
      ) : null}
    </div>
  )
}

export function AgendaDays({ bookings, emptyText }: { bookings: ScheduledBooking[]; emptyText: string }) {
  const days = groupByDay(bookings)
  const nextId = bookings
    .filter(b => new Date(b.scheduled_end).getTime() >= Date.now())
    .sort((a, b) => a.scheduled_start.localeCompare(b.scheduled_start))[0]?.id
  if (days.length === 0) {
    return <PhoneCard><PhoneEmpty>{emptyText}</PhoneEmpty></PhoneCard>
  }
  return (
    <div className="space-y-4">
      {days.map(d => (
        <div key={d.key}>
          <div className="mb-1.5 flex items-baseline justify-between px-1">
            <span className="font-inter font-semibold text-[12.5px] text-[#0d0d09]">{dayLabel(d.date)}</span>
            <span className="font-inter text-[11.5px] tabular-nums text-[#6B7080]">
              {d.items.length} {d.items.length === 1 ? 'interview' : 'interviews'}
            </span>
          </div>
          <PhoneCard>
            {d.items.map(b => <AgendaRow key={b.id} b={b} next={b.id === nextId} />)}
          </PhoneCard>
        </div>
      ))}
    </div>
  )
}
