import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardCheck, GitBranch, Inbox, Mail } from 'lucide-react'
import type { ScheduledBooking } from '@/hooks/useScheduledBookings'
import { AgendaDays } from './PhoneAgenda'
import { BookingLinkCard } from './BookingLinkCard'
import {
  Initials, PhoneCard, PhoneEmpty, PhonePage, PhoneRow, PhoneSection, PhoneSkeletonRows, PhoneTitle, Pill,
} from './PhoneUI'

/**
 * Today on a phone (2026-10-12): the greeting, what's on the agenda for the
 * next week, your booking link, what needs you, and open jobs at a glance.
 * The same numbers as the desktop dashboard, laid out for one hand.
 */

export interface PhoneQueueItem {
  id: string
  type: 'scorecard' | 'decision' | 'reply' | 'application'
  label: string
  candidateName: string
  candidateId: string
  context: string
  urgency: 'overdue' | 'today' | 'normal'
  urgencyLabel: string
}

interface Props {
  greeting: string
  dateLine: string
  scorecardCount: number
  decisionCount: number
  digestLoading: boolean
  bookings: ScheduledBooking[]
  bookingsLoading: boolean
  queue: PhoneQueueItem[]
  queueLoading: boolean
  openJobs: { id: string; title: string; organization_name?: string | null; location?: string | null }[]
  jobCounts: Map<string, number>
  jobsLoading: boolean
}

const TYPE_ICON = { scorecard: ClipboardCheck, decision: GitBranch, reply: Mail, application: Inbox }

export function PhoneToday(p: Props) {
  const week = useMemo(() => {
    const now = Date.now()
    const until = now + 7 * 86_400_000
    return p.bookings.filter(b => {
      if (b.status === 'cancelled') return false
      const s = new Date(b.scheduled_start).getTime()
      const e = new Date(b.scheduled_end).getTime()
      return e >= now - 15 * 60_000 && s <= until
    })
  }, [p.bookings])
  const todayCount = week.filter(b => new Date(b.scheduled_start).toDateString() === new Date().toDateString()).length

  return (
    <PhonePage>
      <PhoneTitle
        eyebrow={p.dateLine}
        title={p.greeting}
        sub={p.digestLoading
          ? <span aria-hidden className="gio-shimmer mt-1 block h-3 w-4/5 rounded" />
          : <>
              <strong className="font-semibold text-[#0d0d09]">{todayCount} {todayCount === 1 ? 'interview' : 'interviews'}</strong> today,{' '}
              <strong className="font-semibold text-[#0d0d09]">{p.scorecardCount} {p.scorecardCount === 1 ? 'scorecard' : 'scorecards'}</strong> due and{' '}
              <strong className="font-semibold text-[#0d0d09]">{p.decisionCount} {p.decisionCount === 1 ? 'decision' : 'decisions'}</strong> waiting.
            </>}
      />

      <PhoneSection label="Agenda" count={p.bookingsLoading ? null : week.length} action={<Link to="/calendar" className="font-inter font-medium text-[12.5px] text-[#6F3FF5]">Calendar</Link>}>
        {p.bookingsLoading ? <PhoneCard><PhoneSkeletonRows rows={2} /></PhoneCard> : (
          <AgendaDays bookings={week} emptyText="Nothing booked in the next 7 days. Share your link below to fill it." />
        )}
      </PhoneSection>

      <div className="mb-6"><BookingLinkCard /></div>

      <PhoneSection label="Needs you" count={p.queueLoading ? null : p.queue.length}>
        <PhoneCard>
          {p.queueLoading ? <PhoneSkeletonRows rows={3} /> : p.queue.length === 0 ? (
            <PhoneEmpty>All clear: no scorecards, decisions or replies waiting.</PhoneEmpty>
          ) : p.queue.slice(0, 6).map(q => {
            const Icon = TYPE_ICON[q.type]
            return (
              <PhoneRow
                key={q.id}
                to={q.candidateId ? `/candidates/${q.candidateId}` : undefined}
                leading={
                  <span className="relative inline-flex">
                    <Initials name={q.candidateName} />
                    <span className="absolute -bottom-0.5 -right-0.5 inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[#0d0d09] text-[#fffcf9] ring-2 ring-white">
                      <Icon className="h-[10px] w-[10px]" strokeWidth={2.2} />
                    </span>
                  </span>
                }
                title={q.candidateName}
                meta={`${q.label} · ${q.context}`}
                trailing={<Pill tone={q.urgency === 'overdue' ? 'red' : q.urgency === 'today' ? 'amber' : 'neutral'}>{q.urgencyLabel}</Pill>}
                chevron={false}
              />
            )
          })}
        </PhoneCard>
        {p.queue.length > 6 && (
          <p className="mt-2 px-1 font-inter text-[12px] text-[#6B7080]">{p.queue.length - 6} more on the dashboard on your computer.</p>
        )}
      </PhoneSection>

      <PhoneSection label="Open jobs" count={p.jobsLoading ? null : p.openJobs.length} action={<Link to="/jobs" className="font-inter font-medium text-[12.5px] text-[#6F3FF5]">All jobs</Link>}>
        <PhoneCard>
          {p.jobsLoading ? <PhoneSkeletonRows rows={2} /> : p.openJobs.length === 0 ? (
            <PhoneEmpty>No open jobs.</PhoneEmpty>
          ) : p.openJobs.slice(0, 5).map(j => (
            <PhoneRow
              key={j.id}
              to={`/jobs/${j.id}`}
              title={j.title}
              meta={[j.organization_name, j.location].filter(Boolean).join(' · ') || undefined}
              trailing={<Pill>{p.jobCounts.get(j.id) ?? 0} active</Pill>}
            />
          ))}
        </PhoneCard>
      </PhoneSection>
    </PhonePage>
  )
}
