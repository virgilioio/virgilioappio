/**
 * Calendar page — recruiter-facing weekly schedule.
 * Interviews, debriefs, holds, busy blocks across all jobs +
 * a "Needs scheduling" rail. Frontend wires existing endpoints only.
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  Settings2,
  CalendarPlus,
  Briefcase,
  Users,
  CalendarClock,
  CheckCircle2,
  Video,
  X,
} from 'lucide-react'
import {
  format,
  startOfWeek,
  addDays,
  addWeeks,
  subWeeks,
  isToday,
  isSameDay,
  parseISO,
  startOfDay,
  isWithinInterval,
} from 'date-fns'
import { AuthGate } from '@/components/auth/AuthGate'
import { PermissionGate } from '@/components/auth/PermissionGate'
import { usePermissions } from '@/hooks/usePermissions'
import { useAuth } from '@/contexts/AuthContext'
import { useScheduledBookings, type ScheduledBooking } from '@/hooks/useScheduledBookings'
import { useJobs } from '@/hooks/useJobs'
import { useNeedsSchedulingQueue, type NeedsSchedulingItem } from '@/hooks/useNeedsSchedulingQueue'
import { ScheduleInterviewSheet } from '@/components/candidates/ScheduleInterviewSheet'
import { SimpleScheduleInterviewSheet } from '@/components/candidates/SimpleScheduleInterviewSheet'
import { cn } from '@/lib/utils'

// ─── Tokens ──────────────────────────────────────────────────
const C = {
  pageBg: '#F6F5F1',
  card: '#FFFFFF',
  border: '#E7E8EE',
  hairline: '#F1F0EC',
  ink: '#0d0d09',
  ink2: '#1F2230',
  muted: '#5A6072',
  tertiary: '#8B8F9E',
  disabled: '#B5B9C4',
  purple: '#6F3FF5',
  purpleLight: '#EDE4FF',
  purpleText: '#5B21B6',
  purpleTint: '#FBFAFF',
  amber: '#D97706',
  amberBg: '#FEF3C7',
  amberText: '#92400E',
  holdBorder: '#A5AAB8',
  busyBg: '#F1F0EC',
  busyBorder: '#D2D4DC',
  red: '#FA5252',
  redText: '#DC2626',
  redBg: '#FEE2E2',
  green: '#12B886',
} as const

// ─── Types ───────────────────────────────────────────────────
type EventType = 'interview' | 'debrief' | 'hold' | 'busy'
type ViewMode = 'day' | 'week' | 'month'
type TypeFilter = 'all' | EventType

interface CalEvent {
  id: string
  type: EventType
  title: string
  start: Date
  end: Date
  jobId: string | null
  jobTitle: string | null
  candidateId: string | null
  candidateName: string | null
  interviewerId: string | null
  interviewerName: string | null
  raw: ScheduledBooking
}

// ─── Helpers ─────────────────────────────────────────────────
const HOUR_PX = 56
const DAY_START = 8
const DAY_END = 18

function classifyEvent(b: ScheduledBooking): EventType {
  const source = (b.sync_source ?? '').toLowerCase()
  if (source === 'google' || source === 'outlook' || source === 'external') {
    if (!b.candidate_id && !b.job_id) return 'busy'
  }
  if ((b.isSimpleBooking || (!b.candidate_id && !b.job_id))) return 'busy'
  const stageName = (b.stage?.stage_name ?? '').toLowerCase()
  if (stageName.includes('debrief')) return 'debrief'
  if (b.status === 'tentative') return 'hold'
  return 'interview'
}

function eventTitle(b: ScheduledBooking, type: EventType): string {
  if (type === 'busy') return b.notes || 'Busy'
  const kind =
    type === 'debrief'
      ? 'Debrief'
      : type === 'hold'
      ? 'Hold'
      : b.stage?.stage_name || 'Interview'
  const who = b.candidate_name || b.candidate?.candidate_name || ''
  return who ? `${kind} · ${who}` : kind
}

const TYPE_META: Record<EventType, { label: string; swatch: string; bg: string; edge: string; text: string }> = {
  interview: { label: 'Interviews', swatch: C.purple, bg: C.purpleLight, edge: C.purple, text: '#3D1FA3' },
  debrief: { label: 'Debriefs', swatch: C.amber, bg: C.amberBg, edge: C.amber, text: C.amberText },
  hold: { label: 'Holds', swatch: C.holdBorder, bg: '#FAFAF7', edge: C.holdBorder, text: C.muted },
  busy: { label: 'Busy', swatch: C.busyBorder, bg: C.busyBg, edge: C.busyBorder, text: C.tertiary },
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(s => s[0]?.toUpperCase() ?? '')
    .join('')
}

// ─── Page ────────────────────────────────────────────────────
export default function CalendarPage() {
  const navigate = useNavigate()
  const { user, organizationId } = useAuth()
  const permissions = usePermissions()
  const { bookings, isLoading } = useScheduledBookings('upcoming', permissions)
  const { jobs } = useJobs()
  const { data: needsScheduling = [] } = useNeedsSchedulingQueue()

  const [view, setView] = useState<ViewMode>('week')
  const [weekAnchor, setWeekAnchor] = useState<Date>(new Date())
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [jobFilter, setJobFilter] = useState<string | 'all'>('all')
  const [peopleFilter, setPeopleFilter] = useState<'mine' | 'all'>('mine')
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [openSimpleSheet, setOpenSimpleSheet] = useState(false)
  const [scheduleTarget, setScheduleTarget] = useState<NeedsSchedulingItem | null>(null)

  const weekStart = useMemo(() => startOfWeek(weekAnchor, { weekStartsOn: 1 }), [weekAnchor])
  const days = useMemo(() => Array.from({ length: 5 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const weekEnd = useMemo(() => addDays(weekStart, 4), [weekStart])

  // Build events
  const allEvents: CalEvent[] = useMemo(() => {
    return (bookings || []).map(b => {
      const type = classifyEvent(b)
      return {
        id: b.id,
        type,
        title: eventTitle(b, type),
        start: parseISO(b.scheduled_start),
        end: parseISO(b.scheduled_end),
        jobId: b.job_id,
        jobTitle: b.job?.title ?? null,
        candidateId: b.candidate_id,
        candidateName: b.candidate_name || b.candidate?.candidate_name || null,
        interviewerId: b.interviewer_id,
        interviewerName: b.interviewer_profile
          ? `${b.interviewer_profile.first_name ?? ''} ${b.interviewer_profile.last_name ?? ''}`.trim() ||
            b.interviewer_profile.email
          : null,
        raw: b,
      }
    })
  }, [bookings])

  // Apply filters
  const events = useMemo(() => {
    return allEvents.filter(e => {
      if (typeFilter !== 'all' && e.type !== typeFilter) return false
      if (jobFilter !== 'all' && e.jobId !== jobFilter) return false
      if (peopleFilter === 'mine' && e.interviewerId !== user?.id) return false
      return true
    })
  }, [allEvents, typeFilter, jobFilter, peopleFilter, user?.id])

  // Events within visible week
  const weekEvents = useMemo(
    () =>
      events.filter(e =>
        isWithinInterval(e.start, {
          start: startOfDay(weekStart),
          end: addDays(startOfDay(weekEnd), 1),
        }),
      ),
    [events, weekStart, weekEnd],
  )

  const counts = useMemo(() => {
    const c = { interview: 0, debrief: 0, hold: 0, busy: 0 }
    weekEvents.forEach(e => {
      c[e.type]++
    })
    return c
  }, [weekEvents])

  const selectedEvent = useMemo(
    () => weekEvents.find(e => e.id === selectedEventId) ?? null,
    [weekEvents, selectedEventId],
  )

  const todayInWeek = days.find(d => isToday(d))
  const now = new Date()
  const minutesSinceDayStart = now.getHours() * 60 + now.getMinutes() - DAY_START * 60
  const nowLineTop = (minutesSinceDayStart / 60) * HOUR_PX

  // ─── Render helpers ───
  function renderEvent(e: CalEvent) {
    const startMin = e.start.getHours() * 60 + e.start.getMinutes()
    const endMin = e.end.getHours() * 60 + e.end.getMinutes()
    const top = ((startMin - DAY_START * 60) / 60) * HOUR_PX
    const height = Math.max(20, ((endMin - startMin) / 60) * HOUR_PX - 3)
    const meta = TYPE_META[e.type]
    const short = height < 34
    const isHold = e.type === 'hold'

    return (
      <button
        key={e.id}
        type="button"
        onClick={() => setSelectedEventId(e.id)}
        className="absolute left-[3px] right-[3px] text-left overflow-hidden focus:outline-none focus:ring-2"
        style={{
          top,
          height,
          background: meta.bg,
          color: meta.text,
          borderRadius: 7,
          padding: short ? '3px 8px' : '5px 8px',
          ...(isHold
            ? { border: `1.5px dashed ${C.holdBorder}` }
            : { borderLeft: `3px solid ${meta.edge}` }),
        }}
      >
        <div
          className="font-inter"
          style={{
            fontSize: 10.5,
            fontWeight: 600,
            lineHeight: 1.2,
            display: '-webkit-box',
            WebkitLineClamp: short ? 1 : 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            whiteSpace: short ? 'nowrap' : 'normal',
            textOverflow: 'ellipsis',
          }}
        >
          {e.title}
        </div>
        {!short && (
          <div
            className="font-inter"
            style={{ fontSize: 9.5, opacity: 0.75, marginTop: 1, lineHeight: 1.2 }}
          >
            {format(e.start, 'H:mm')}–{format(e.end, 'H:mm')}
            {e.jobTitle ? ` · ${e.jobTitle}` : ''}
          </div>
        )}
      </button>
    )
  }

  // ─── UI ───
  const weekRangeLabel = `${format(weekStart, 'MMM d')} – ${format(weekEnd, 'd, yyyy')}`

  return (
    <AuthGate>
      <PermissionGate permission="canViewJobs">
        <div className="min-h-[100dvh] w-full" style={{ background: C.pageBg }}>
          <div style={{ padding: '24px 28px' }} className="mx-auto max-w-[1500px]">
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1
                  className="font-poppins text-[#0d0d09]"
                  style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 1.1 }}
                >
                  Calendar
                </h1>
                <div
                  className="mt-1.5 flex flex-wrap items-center font-inter"
                  style={{ fontSize: 12, color: C.tertiary, gap: 8 }}
                >
                  <span>{weekRangeLabel}</span>
                  <span>·</span>
                  <span>{counts.interview} interviews · {counts.debrief} debriefs · {counts.hold} holds</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border bg-white px-3 font-poppins text-[13px] font-medium text-[#0d0d09] hover:bg-[#FAFAF7]"
                  style={{ borderColor: C.border }}
                  onClick={() => navigate('/settings?tab=availability')}
                >
                  <Settings2 size={14} strokeWidth={2} />
                  Availability
                </button>
                <button
                  type="button"
                  onClick={() => setOpenSimpleSheet(true)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 font-poppins text-[13px] font-medium text-white"
                  style={{ background: C.purple }}
                >
                  <CalendarPlus size={14} strokeWidth={2} />
                  Schedule interview
                </button>
              </div>
            </div>

            {/* Toolbar */}
            <div
              className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-white"
              style={{ border: `1px solid ${C.border}`, padding: 10 }}
            >
              {/* Day/Week/Month */}
              <div className="inline-flex h-7 rounded-lg p-0.5" style={{ background: C.hairline }}>
                {(['day', 'week', 'month'] as const).map(v => {
                  const active = view === v
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setView(v)}
                      className={cn(
                        'px-2.5 rounded-md font-inter capitalize transition-colors',
                      )}
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        background: active ? C.ink : 'transparent',
                        color: active ? '#fffcf9' : C.tertiary,
                      }}
                    >
                      {v}
                    </button>
                  )
                })}
              </div>

              {/* Nav cluster */}
              <button
                type="button"
                onClick={() => setWeekAnchor(d => subWeeks(d, 1))}
                className="grid place-items-center rounded-lg border bg-white text-[#5A6072] hover:bg-[#FAFAF7]"
                style={{ width: 28, height: 28, borderColor: C.border }}
                aria-label="Previous"
              >
                <ChevronLeft size={14} strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={() => setWeekAnchor(new Date())}
                className="h-7 rounded-lg border bg-white px-3 font-inter text-[12px] font-medium text-[#0d0d09] hover:bg-[#FAFAF7]"
                style={{ borderColor: C.border }}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setWeekAnchor(d => addWeeks(d, 1))}
                className="grid place-items-center rounded-lg border bg-white text-[#5A6072] hover:bg-[#FAFAF7]"
                style={{ width: 28, height: 28, borderColor: C.border }}
                aria-label="Next"
              >
                <ChevronRight size={14} strokeWidth={2} />
              </button>

              <div style={{ width: 1, height: 20, background: C.border, margin: '0 4px' }} />

              {/* Type pills */}
              {(['all', 'interview', 'debrief', 'hold', 'busy'] as const).map(t => {
                const active = typeFilter === t
                const label = t === 'all' ? 'All' : TYPE_META[t].label
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTypeFilter(t)}
                    className="inline-flex h-7 items-center gap-1.5 rounded-full px-3 font-inter"
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      background: active ? C.ink : 'white',
                      color: active ? '#fffcf9' : C.muted,
                      border: active ? 'none' : `1px solid ${C.border}`,
                    }}
                  >
                    {t !== 'all' && (
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 3,
                          background: TYPE_META[t].swatch,
                          display: 'inline-block',
                        }}
                      />
                    )}
                    {label}
                  </button>
                )
              })}

              <div className="ml-auto flex items-center gap-2">
                <select
                  value={jobFilter}
                  onChange={e => setJobFilter(e.target.value as any)}
                  className="h-7 rounded-lg bg-transparent px-2 font-inter text-[12px] text-[#5A6072] hover:bg-[#FAFAF7]"
                  aria-label="Filter by job"
                >
                  <option value="all">Job · All</option>
                  {jobs?.map(j => (
                    <option key={j.id} value={j.id}>{j.title}</option>
                  ))}
                </select>
                <select
                  value={peopleFilter}
                  onChange={e => setPeopleFilter(e.target.value as any)}
                  className="h-7 rounded-lg bg-transparent px-2 font-inter text-[12px] text-[#5A6072] hover:bg-[#FAFAF7]"
                  aria-label="Filter by people"
                >
                  <option value="mine">People · Mine</option>
                  <option value="all">People · All</option>
                </select>
              </div>
            </div>

            {/* Two-column layout */}
            <div
              className="mt-3.5 grid"
              style={{ gridTemplateColumns: 'minmax(0,1fr) 280px', gap: 14 }}
            >
              {/* Calendar card */}
              <div
                className="rounded-xl bg-white overflow-hidden"
                style={{ border: `1px solid ${C.border}` }}
              >
                {view !== 'week' ? (
                  <div className="grid place-items-center font-inter text-[12px]" style={{ color: C.tertiary, height: 420 }}>
                    {view === 'day' ? 'Day view' : 'Month view'} coming soon — switch to Week.
                  </div>
                ) : (
                  <>
                    {/* Day header row */}
                    <div
                      className="grid"
                      style={{ gridTemplateColumns: `52px repeat(5, 1fr)`, borderBottom: `1px solid ${C.border}` }}
                    >
                      <div />
                      {days.map((d, i) => {
                        const today = isToday(d)
                        return (
                          <div
                            key={i}
                            className="flex flex-col items-center justify-center py-2"
                            style={{
                              borderLeft: `1px solid ${C.hairline}`,
                              background: today ? C.purpleTint : 'transparent',
                            }}
                          >
                            <div
                              className="font-inter"
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                color: today ? C.purple : C.muted,
                              }}
                            >
                              {format(d, 'EEE')}
                            </div>
                            <div
                              className="font-inter"
                              style={{
                                fontSize: 11,
                                color: today ? C.purple : C.disabled,
                              }}
                            >
                              {format(d, 'MMM d')}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Grid body */}
                    <div
                      className="relative grid"
                      style={{
                        gridTemplateColumns: `52px repeat(5, 1fr)`,
                        height: (DAY_END - DAY_START) * HOUR_PX,
                      }}
                    >
                      {/* Hour gutter */}
                      <div className="relative">
                        {Array.from({ length: DAY_END - DAY_START + 1 }, (_, i) => {
                          const hour = DAY_START + i
                          if (i === 0) return null
                          return (
                            <div
                              key={i}
                              className="absolute right-1.5 -translate-y-1/2 font-inter"
                              style={{ top: i * HOUR_PX, fontSize: 9.5, color: C.disabled }}
                            >
                              {hour}:00
                            </div>
                          )
                        })}
                      </div>
                      {/* Day columns */}
                      {days.map((d, di) => {
                        const today = isToday(d)
                        const dayEvents = weekEvents.filter(e => isSameDay(e.start, d))
                        return (
                          <div
                            key={di}
                            className="relative"
                            style={{
                              borderLeft: `1px solid ${C.hairline}`,
                              background: today ? C.purpleTint : 'transparent',
                            }}
                          >
                            {/* Hour lines */}
                            {Array.from({ length: DAY_END - DAY_START }, (_, i) => (
                              <div
                                key={i}
                                className="absolute left-0 right-0"
                                style={{
                                  top: (i + 1) * HOUR_PX,
                                  borderBottom: `1px solid ${C.pageBg}`,
                                }}
                              />
                            ))}
                            {/* Now line */}
                            {today && todayInWeek && nowLineTop >= 0 && nowLineTop <= (DAY_END - DAY_START) * HOUR_PX && (
                              <div
                                className="pointer-events-none absolute left-0 right-0"
                                style={{ top: nowLineTop, height: 2, background: C.red, zIndex: 5 }}
                              >
                                <div
                                  className="absolute -left-1 -top-[3px] rounded-full"
                                  style={{ width: 8, height: 8, background: C.red }}
                                />
                              </div>
                            )}
                            {/* Events */}
                            {dayEvents.map(renderEvent)}
                          </div>
                        )
                      })}

                      {/* Event detail popover */}
                      {selectedEvent && (
                        <EventPopover
                          event={selectedEvent}
                          onClose={() => setSelectedEventId(null)}
                          onOpenCandidate={() => {
                            if (selectedEvent.candidateId) {
                              navigate(
                                selectedEvent.jobId
                                  ? `/jobs/${selectedEvent.jobId}/candidates/${selectedEvent.candidateId}`
                                  : `/candidates/${selectedEvent.candidateId}`,
                              )
                            }
                          }}
                          onJoin={() => {
                            const loc = selectedEvent.raw.meeting_location
                            if (loc && /^https?:\/\//.test(loc)) window.open(loc, '_blank', 'noopener')
                          }}
                        />
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Right rail */}
              <RailNeedsScheduling
                items={needsScheduling}
                onSchedule={item => setScheduleTarget(item)}
              />
            </div>
          </div>

          {/* Sheets */}
          {organizationId && user && (
            <SimpleScheduleInterviewSheet
              open={openSimpleSheet}
              onOpenChange={setOpenSimpleSheet}
              candidateId=""
              candidateName=""
              candidateEmail=""
              organizationId={organizationId}
            />
          )}
          {scheduleTarget && (
            <ScheduleInterviewSheet
              open={!!scheduleTarget}
              onOpenChange={(o) => !o && setScheduleTarget(null)}
              candidateId={scheduleTarget.candidateId}
              candidateName={scheduleTarget.candidateName}
              candidateEmail={scheduleTarget.candidateEmail}
              candidatePhone={scheduleTarget.candidatePhone ?? undefined}
              jobId={scheduleTarget.jobId}
              jobTitle={scheduleTarget.jobTitle}
              organizationId={scheduleTarget.organizationId || organizationId || ''}
              jhsId={scheduleTarget.jhsId}
              stageName={scheduleTarget.stageName}
              associationId={scheduleTarget.associationId}
            />
          )}
        </div>
      </PermissionGate>
    </AuthGate>
  )
}

// ─── Event detail popover ────────────────────────────────────
function EventPopover({
  event,
  onClose,
  onOpenCandidate,
  onJoin,
}: {
  event: CalEvent
  onClose: () => void
  onOpenCandidate: () => void
  onJoin: () => void
}) {
  const meta = TYPE_META[event.type]
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="absolute z-50 bg-white"
        style={{
          top: 12,
          right: 12,
          width: 280,
          borderRadius: 12,
          border: `1px solid ${C.border}`,
          boxShadow: '0 16px 40px -12px rgba(13,13,9,0.25)',
        }}
      >
        <div className="flex items-start justify-between gap-2 px-3.5 pt-3.5">
          <div className="flex min-w-0 items-start gap-2">
            <span
              className="mt-[5px] flex-shrink-0"
              style={{ width: 8, height: 8, borderRadius: 3, background: meta.swatch }}
            />
            <div className="min-w-0">
              <div className="font-inter truncate" style={{ fontSize: 12.5, fontWeight: 600, color: C.ink }}>
                {event.title}
              </div>
              <div className="font-inter mt-0.5" style={{ fontSize: 11, color: C.tertiary }}>
                {format(event.start, 'EEE')} · {format(event.start, 'H:mm')}–{format(event.end, 'H:mm')} · {meta.label.replace(/s$/, '')}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-[#8B8F9E] hover:text-[#0d0d09]" aria-label="Close">
            <X size={14} strokeWidth={2} />
          </button>
        </div>

        <div className="px-3.5 py-3 space-y-1.5">
          {event.jobTitle && (
            <div className="flex items-center gap-2 font-inter" style={{ fontSize: 11.5, color: C.muted }}>
              <Briefcase size={12} strokeWidth={2} />
              <span className="truncate">{event.jobTitle}</span>
            </div>
          )}
          {event.interviewerName && (
            <div className="flex items-center gap-2 font-inter" style={{ fontSize: 11.5, color: C.muted }}>
              <Users size={12} strokeWidth={2} />
              <span className="truncate">{event.interviewerName}</span>
            </div>
          )}
          {event.type === 'hold' && (
            <div
              className="mt-2 font-inter"
              style={{
                background: C.amberBg,
                color: C.amberText,
                borderRadius: 7,
                fontSize: 11,
                padding: '6px 8px',
              }}
            >
              Tentative slot — awaiting candidate pick.
            </div>
          )}
          {event.type === 'busy' && (
            <div className="font-inter" style={{ fontSize: 10.5, color: C.tertiary, fontStyle: 'italic' }}>
              Synced from Google Calendar
            </div>
          )}
        </div>

        {event.type !== 'busy' && (
          <div className="flex items-center justify-end gap-2 border-t px-3.5 py-2.5" style={{ borderColor: C.hairline }}>
            {event.type === 'interview' && (
              <>
                <button
                  type="button"
                  onClick={onOpenCandidate}
                  className="h-7 rounded-lg border bg-white px-2.5 font-inter text-[11.5px] font-medium text-[#0d0d09] hover:bg-[#FAFAF7]"
                  style={{ borderColor: C.border }}
                >
                  Candidate
                </button>
                <button
                  type="button"
                  onClick={onJoin}
                  className="inline-flex h-7 items-center gap-1 rounded-lg px-2.5 font-inter text-[11.5px] font-medium text-white"
                  style={{ background: C.purple }}
                >
                  <Video size={11} strokeWidth={2} /> Join
                </button>
              </>
            )}
            {event.type === 'hold' && (
              <>
                <button className="h-7 rounded-lg border bg-white px-2.5 font-inter text-[11.5px] font-medium text-[#0d0d09]" style={{ borderColor: C.border }}>
                  Release
                </button>
                <button className="h-7 rounded-lg px-2.5 font-inter text-[11.5px] font-medium text-white" style={{ background: C.purple }}>
                  Confirm slot
                </button>
              </>
            )}
            {event.type === 'debrief' && (
              <button className="h-7 rounded-lg px-2.5 font-inter text-[11.5px] font-medium text-white" style={{ background: C.purple }}>
                Open notes
              </button>
            )}
          </div>
        )}
      </div>
    </>
  )
}

// ─── Right rail ──────────────────────────────────────────────
function RailNeedsScheduling({
  items,
  onSchedule,
}: {
  items: NeedsSchedulingItem[]
  onSchedule: (item: NeedsSchedulingItem) => void
}) {
  return (
    <div
      className="rounded-xl bg-white flex flex-col"
      style={{
        border: `1px solid ${C.border}`,
        maxHeight: 'calc(100dvh - 220px)',
        position: 'sticky',
        top: 16,
      }}
    >
      <div className="px-3.5 pt-3 pb-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <CalendarClock size={14} strokeWidth={2} color={C.ink2} />
          <span className="font-poppins" style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>
            Needs scheduling
          </span>
          <span
            className="ml-auto inline-flex items-center font-inter"
            style={{
              background: C.hairline,
              color: C.tertiary,
              fontSize: 11,
              fontWeight: 600,
              borderRadius: 999,
              padding: '1px 8px',
            }}
          >
            {items.length}
          </span>
        </div>
        <div className="mt-1 font-inter" style={{ fontSize: 11, color: C.tertiary }}>
          Candidates in an interview stage with nothing on the calendar.
        </div>
      </div>

      <div className="px-3 pb-3 overflow-y-auto" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8">
            <CheckCircle2 size={20} color={C.green} strokeWidth={2} />
            <div className="font-inter" style={{ fontSize: 12, color: C.muted }}>
              Everyone's scheduled.
            </div>
          </div>
        ) : (
          items.map(item => {
            const urgent = item.waitDays > 7
            return (
              <div
                key={item.associationId}
                className="bg-white"
                style={{
                  border: `1px solid ${C.border}`,
                  borderRadius: 10,
                  padding: '9px 11px',
                }}
              >
                <div className="flex items-start gap-2">
                  <div
                    className="grid place-items-center flex-shrink-0 font-poppins font-semibold text-white"
                    style={{ width: 22, height: 22, borderRadius: 999, background: C.purple, fontSize: 9.5 }}
                  >
                    {initials(item.candidateName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-inter truncate" style={{ fontSize: 11.5, fontWeight: 600, color: C.ink }}>
                      {item.candidateName}
                    </div>
                    <div className="font-inter truncate" style={{ fontSize: 10, color: C.tertiary }}>
                      {item.jobTitle}
                    </div>
                  </div>
                  <span
                    className="font-inter flex-shrink-0"
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      borderRadius: 999,
                      padding: '2px 7px',
                      background: urgent ? C.redBg : C.hairline,
                      color: urgent ? C.redText : C.muted,
                    }}
                  >
                    {item.waitDays}d
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div
                    className="font-inter flex-1 min-w-0 truncate"
                    style={{ fontSize: 10, color: C.tertiary }}
                  >
                    {item.stageName}
                  </div>
                  <button
                    type="button"
                    onClick={() => onSchedule(item)}
                    className="font-inter flex-shrink-0"
                    style={{
                      height: 24,
                      borderRadius: 7,
                      background: C.purpleLight,
                      color: C.purpleText,
                      fontSize: 10.5,
                      fontWeight: 600,
                      padding: '0 10px',
                    }}
                  >
                    Schedule
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
