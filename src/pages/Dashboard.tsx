/**
 * Dashboard — "The Queue".
 * One prioritized work feed (left) + today rail (right). Strict spec.
 */
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import {
  Inbox,
  Check,
  Calendar as CalendarIcon,
  Briefcase,
  Video,
  ArrowRight,
} from 'lucide-react'
import { EmptyState, EmptyAction } from '@/components/ui/empty-state'
import { SoftPlane, SoftMagnifier, SoftFlag } from '@/components/ui/EmptyIllustrations'
import { AnimatedEmpty } from '@/components/empty/AnimatedEmpty'
import { LoadError } from '@/components/empty/LoadError'
import { format } from 'date-fns'
import { useUserProfile } from '@/hooks/useUserProfile'
import { usePermissions } from '@/hooks/usePermissions'
import { useOrgContext } from '@/contexts/OrgContext'
import { useReportSplashReady } from '@/contexts/SplashReadyContext'
import { usePendingActivities, PendingActivity } from '@/hooks/usePendingActivities'
import { useStaleCandidates } from '@/hooks/useStaleCandidates'
import { useScheduledBookings, ScheduledBooking } from '@/hooks/useScheduledBookings'
import { useJobs } from '@/hooks/useJobs'
import { usePipelineJobMetrics } from '@/hooks/usePipelineJobMetrics'
import { useNewApplicationsQueue } from '@/hooks/useNewApplicationsQueue'
import { useQueueDismissals } from '@/hooks/useQueueDismissals'
import { useQueueDoneToday } from '@/hooks/useQueueDoneToday'
import { QueueRow } from '@/components/dashboard/QueueRow'
import { useQueueRowActions } from '@/components/dashboard/useQueueRowActions'
import { profileHref } from '@/lib/queueActions'
import {
  arrangeQueue,
  buildQueue,
  snoozedRows,
  snoozeLabel,
  snoozeTimes,
  orderedQueue,
  queueCounts,
  visibleApplications,
  withoutHidden,
  type QueueItem,
  type QueueType,
  type Urgency,
} from '@/lib/queue'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabaseClient'
import { useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { PhoneToday } from '@/components/phone/PhoneToday'

// ─── Color tokens (page-local; matches global tokens) ───────────────
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
  purpleBorder: '#D7C5FB',
  purpleText: '#5B21B6',
  green: '#12B886',
  amberText: '#B45309',
  amberBg: '#FEF3C7',
  redText: '#DC2626',
  redBg: '#FEE2E2',
} as const

// ─── Helpers ────────────────────────────────────────────────────────
function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase() ?? '')
    .join('') || '?'
}

function daysSince(iso?: string | null): number {
  if (!iso) return 0
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000))
}

function greetingFor(d: Date) {
  const h = d.getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function urgencyChipColors(u: Urgency) {
  if (u === 'overdue') return { color: C.redText, bg: C.redBg }
  if (u === 'today') return { color: C.amberText, bg: C.amberBg }
  return { color: C.muted, bg: C.hairline }
}

function isMeetingUrl(s: string | null | undefined): boolean {
  if (!s) return false
  return /^https?:\/\//i.test(s) || /(zoom|meet|teams|whereby)/i.test(s)
}

// ─── Page ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { profile, isLoading: profileLoading } = useUserProfile()
  const permissions = usePermissions()
  const { isLoading: orgLoading, hasOrganizationContext } = useOrgContext()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const isPhone = useIsMobile()

  const { data: pending, isLoading: pendingLoading } = usePendingActivities()
  const { data: stale } = useStaleCandidates()
  const { data: newApps, isLoading: appsLoading } = useNewApplicationsQueue()
  const { bookings: todayBookings, isLoading: bookingsLoading, error: bookingsError, refetch: refetchBookings } =
    useScheduledBookings('upcoming', permissions)
  const { jobs, isLoading: jobsLoading } = useJobs()
  const openJobs = useMemo(() => (jobs ?? []).filter(j => j.status === 'open'), [jobs])
  const { data: jobMetrics } = usePipelineJobMetrics(openJobs.map(j => j.id))

  const [filter, setFilter] = useState<'all' | QueueType>('all')

  // Hidden queue rows are kept server-side per person, by a stable key, so they
  // survive reloads, other browsers and devices (useQueueDismissals).
  const {
    dismissed: doneIds,
    hiddenForGood,
    snoozed,
    hide: hideKeys,
    show: showKeys,
    snooze: snoozeKeys,
  } = useQueueDismissals()
  // Snoozes end at 9:00 AM in your own time zone (your profile's, else Mexico City).
  const timeZone = profile?.timezone || 'America/Mexico_City'
  const rowActions = useQueueRowActions({ hide: hideKeys, show: showKeys, snooze: snoozeKeys, timeZone })
  const doneToday = useQueueDoneToday()

  // Your queue (2026-11-14): rows from src/lib/queue.ts; a job's applications are one
  // row, and an applicant hidden on their own stays out of it. `q.id` is also checked
  // so keys migrated from the old localStorage version keep hiding their rows.
  const queue = useMemo(
    () =>
      withoutHidden(buildQueue(pending, visibleApplications(newApps, doneIds)), doneIds).filter(
        q => !rowActions.gone.has(q.id),
      ),
    [pending, newApps, doneIds, rowActions.gone],
  )

  const counts = useMemo(() => queueCounts(queue), [queue])

  // Snoozed rows wait in their own group at the bottom until their time comes.
  const snoozedItems = useMemo(
    () => snoozedRows(pending, newApps, snoozed, hiddenForGood),
    [pending, newApps, snoozed, hiddenForGood],
  )
  const snoozeHints = useMemo(() => {
    const t = snoozeTimes(new Date(), timeZone)
    return {
      tomorrow: new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' }).format(t.tomorrow),
      monday: new Intl.DateTimeFormat('en-US', { timeZone, month: 'short', day: 'numeric' }).format(t.monday),
    }
  }, [timeZone])

  const filtered = filter === 'all' ? queue : queue.filter(q => q.type === filter)

  // Today's bookings (between now and end-of-day)
  const todayList = useMemo(() => {
    const now = new Date()
    const end = new Date()
    end.setHours(23, 59, 59, 999)
    return (todayBookings ?? [])
      .filter(b => b.status !== 'cancelled')
      .filter(b => {
        const t = new Date(b.scheduled_start).getTime()
        return t >= now.getTime() - 30 * 60_000 && t <= end.getTime()
      })
      .sort((a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime())
  }, [todayBookings])

  const nextEventId = todayList[0]?.id

  // Free evening nudge
  const freeAfter = useMemo(() => {
    if (todayList.length === 0) return null
    const last = todayList[todayList.length - 1]
    const lastEnd = new Date(last.scheduled_end)
    const cutoff = new Date()
    cutoff.setHours(17, 0, 0, 0)
    if (lastEnd <= cutoff) return '17:00'
    const h = lastEnd.getHours()
    const m = lastEnd.getMinutes()
    if (h >= 19) return null
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }, [todayList])

  useReportSplashReady(!orgLoading && hasOrganizationContext && !profileLoading)

  // The gio ats splash covers a cold load; inside a session the page's own skeleton shows.
  if (orgLoading || !hasOrganizationContext) {
    return <DashboardSkeleton />
  }
  if (permissions.isSalesUser) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center gap-2 font-inter text-[13px] text-[#5C6070]">
        <p>Companies and deals now live in Gio Sales.</p>
        <a href="https://sales.gogio.io/companies" target="_blank" rel="noopener noreferrer" className="underline text-[#1F2230]">Open Gio Sales</a>
      </div>
    )
  }

  // ─── Digest ────────────────────────────────────────────────
  const scorecardCount = counts.scorecard
  const decisionCount = counts.decision
  const interviewsToday = todayList.length
  const stuckLong = (stale ?? []).filter(s => s.daysInStage >= 21)
  const stuckByJob = stuckLong.reduce<Record<string, number>>((acc, s) => {
    acc[s.jobTitle] = (acc[s.jobTitle] ?? 0) + 1
    return acc
  }, {})
  const topStuckJob = Object.entries(stuckByJob).sort((a, b) => b[1] - a[1])[0]

  const firstName = profile?.first_name ?? 'there'
  const today = new Date()
  const dateLine = format(today, 'EEEE, MMMM d')

  const queueLoading = pendingLoading || appsLoading

  // Phones get the consulting view: agenda, booking link, what needs you.
  if (isPhone) {
    return (
      <PhoneToday
        greeting={`${greetingFor(today)}, ${firstName}`}
        dateLine={dateLine}
        scorecardCount={scorecardCount}
        decisionCount={decisionCount}
        digestLoading={queueLoading || bookingsLoading}
        bookings={todayBookings ?? []}
        bookingsLoading={bookingsLoading}
        queue={orderedQueue(queue)}
        queueLoading={queueLoading}
        openJobs={openJobs}
        jobCounts={new Map((jobMetrics ?? []).map(m => [m.job_id, m.active_candidates]))}
        jobsLoading={jobsLoading}
      />
    )
  }

  return (
    <div style={{ background: C.pageBg, minHeight: '100%', padding: '24px 28px' }}>
      {/* Greeting */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ font: '500 11.5px/1.4 Inter', color: C.tertiary }}>{dateLine}</div>
        <h1
          style={{
            font: '600 26px/1.15 Poppins',
            letterSpacing: '-0.03em',
            color: C.ink,
            margin: '4px 0 6px',
          }}
        >
          {greetingFor(today)}, {firstName}
          <span style={{ color: C.purpleBorder }}>.</span>
        </h1>
        {queueLoading || bookingsLoading ? (
          // §5/§6: no "0 scorecards…" before the counts are in — hold the line instead.
          <div aria-hidden="true" style={{ height: 20, display: 'flex', alignItems: 'center' }}>
            <span className="gio-shimmer" style={{ display: 'block', width: 'min(420px, 80%)', height: 12, borderRadius: 4 }} />
          </div>
        ) : (
        <p style={{ font: '400 13.5px/1.5 Inter', color: C.muted, margin: 0 }}>
          You have{' '}
          <strong style={{ color: C.ink, fontWeight: 600 }}>
            {scorecardCount} {scorecardCount === 1 ? 'scorecard' : 'scorecards'} due
          </strong>
          ,{' '}
          <strong style={{ color: C.ink, fontWeight: 600 }}>
            {decisionCount} stage {decisionCount === 1 ? 'decision' : 'decisions'} waiting
          </strong>{' '}
          and{' '}
          <strong style={{ color: C.ink, fontWeight: 600 }}>
            {interviewsToday} {interviewsToday === 1 ? 'interview' : 'interviews'}
          </strong>{' '}
          today.
          {topStuckJob ? (
            <>
              {' '}
              {topStuckJob[1]} {topStuckJob[1] === 1 ? 'candidate' : 'candidates'} in{' '}
              {topStuckJob[0]} {topStuckJob[1] === 1 ? 'has' : 'have'} been stuck for 3+ weeks.
            </>
          ) : null}
        </p>
        )}
      </div>

      {/* Two-column grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 340px',
          gap: 14,
          alignItems: 'start',
        }}
      >
        {/* LEFT: Queue card */}
        <QueueCard
          counts={counts}
          filter={filter}
          onFilter={setFilter}
          items={filtered}
          loading={queueLoading}
          doneToday={doneToday}
          snoozedItems={snoozedItems}
          renderRow={(item, isLast) => {
            const snoozedUntil = (item as QueueItem & { snoozedUntil?: string }).snoozedUntil
            return (
              <QueueRow
                key={item.id}
                item={item}
                isLast={isLast}
                busy={rowActions.busyFor(item)}
                onOpen={() => navigate(item.href)}
                onAction={(id) => void rowActions.run(item, id)}
                onOpenProfile={() =>
                  navigate(item.candidateId ? profileHref(item.jobId, item.candidateId) : `/jobs/${item.jobId}`)
                }
                onHide={() => void rowActions.hideRow(item)}
                onSnooze={(when) => void rowActions.snoozeRow(item, when)}
                snoozeHints={snoozeHints}
                snoozedLabel={snoozedUntil ? snoozeLabel(new Date(snoozedUntil), timeZone) : undefined}
                onUnsnooze={snoozedUntil ? () => void rowActions.unsnooze(item) : undefined}
              />
            )
          }}
        />
        {rowActions.dialogs}

        {/* RIGHT rail */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <TodayCard
            bookings={todayList}
            isLoading={bookingsLoading}
            loadFailed={!!bookingsError && !todayBookings?.length}
            onRetry={() => { void refetchBookings() }}
            nextEventId={nextEventId}
            freeAfter={freeAfter}
            onFullCalendar={permissions.isExternal ? undefined : () => navigate('/calendar')}
            onRowClick={(b) => {
              if (b.job_id && b.candidate_id) {
                navigate(`/jobs/${b.job_id}?candidate=${b.candidate_id}`)
              }
            }}
          />
          <OpenJobsCard
            jobs={openJobs}
            metrics={jobMetrics ?? []}
            stale={stale ?? []}
            isLoading={jobsLoading}
            onPipeline={() => navigate('/pipeline')}
            onJobClick={(id) => navigate(`/jobs/${id}`)}
            onCreateJob={() => navigate('/jobs')}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Queue Card ──────────────────────────────────────────────────────

interface QueueCardProps {
  counts: { all: number; scorecard: number; decision: number; reply: number; application: number }
  filter: 'all' | QueueType
  onFilter: (f: 'all' | QueueType) => void
  items: QueueItem[]
  loading: boolean
  renderRow: (item: QueueItem, isLast: boolean) => ReactNode
  /** What you finished today; null while it's being counted. */
  doneToday: number | null
  snoozedItems: QueueItem[]
}

function QueueCard({ counts, filter, onFilter, items, loading, renderRow, doneToday, snoozedItems }: QueueCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [showSnoozed, setShowSnoozed] = useState(false)
  const chips: { id: 'all' | QueueType; label: string; count: number }[] = [
    { id: 'all', label: 'Everything', count: counts.all },
    { id: 'scorecard', label: 'Scorecards', count: counts.scorecard },
    { id: 'decision', label: 'Decisions', count: counts.decision },
    { id: 'reply', label: 'Replies', count: counts.reply },
    { id: 'application', label: 'Applications', count: counts.application },
  ]
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 0 }}>
      {/* Header */}
      <div
        style={{
          padding: '14px 16px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <Inbox size={14} strokeWidth={2} color={C.muted} />
        <span style={{ font: '600 13px/1 Poppins', color: C.ink }}>Your queue</span>
        <span
          style={{
            font: '600 11px/1 Inter',
            color: C.tertiary,
            background: C.hairline,
            padding: '3px 8px',
            borderRadius: 999,
          }}
        >
          {counts.all}
        </span>
        {doneToday !== null && doneToday > 0 ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              marginLeft: 4,
              font: '500 11.5px/1 Inter',
              color: '#0B7A52',
              fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap',
            }}
          >
            <Check size={12} strokeWidth={2.4} aria-hidden="true" />
            {doneToday} done today
          </span>
        ) : null}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {chips.map(c => {
            const active = filter === c.id
            return (
              <button
                key={c.id}
                onClick={() => onFilter(c.id)}
                style={{
                  height: 28,
                  padding: '0 12px',
                  borderRadius: 999,
                  border: `1px solid ${active ? C.ink : C.border}`,
                  background: active ? C.ink : '#fff',
                  color: active ? '#fffcf9' : C.ink2,
                  font: '500 12px/1 Inter',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                  transition: 'background 140ms, color 140ms, border-color 140ms',
                }}
              >
                {c.label}
                <span style={{ fontSize: 10.5, opacity: 0.75 }}>{c.count}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Feed */}
      {loading ? (
        <QueueSkeleton />
      ) : items.length === 0 ? (
        <EmptyQueue filter={filter} totalAll={counts.all} onClear={() => onFilter('all')} />
      ) : (
        <QueueGroups items={items} expanded={expanded} renderRow={renderRow} />
      )}

      {/* Snoozed rows (2026-11-14): their own group, opened from the footer. */}
      {!loading && showSnoozed && snoozedItems.length > 0 ? (
        <section aria-label="Snoozed">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 16px 6px',
              borderTop: `1px solid ${C.hairline}`,
            }}
          >
            <span style={{ font: '600 12px/16px Inter', color: C.muted }}>Snoozed</span>
            <span style={{ font: '400 11.5px/16px Inter', color: '#6B7080' }}>Soonest first</span>
          </div>
          {snoozedItems.map((item, i) => renderRow(item, i === snoozedItems.length - 1))}
        </section>
      ) : null}

      {/* Footer: the rest opens in the card (2026-11-14), never another page. */}
      {!loading && (items.length > QUEUE_MAX || snoozedItems.length > 0) ? (
        <div
          style={{
            padding: '10px 16px',
            display: 'flex',
            justifyContent: 'center',
            gap: 16,
            borderTop: `1px solid ${C.hairline}`,
          }}
        >
          {items.length > QUEUE_MAX ? (
            <button type="button" onClick={() => setExpanded(v => !v)} style={footerLink}>
              {expanded ? 'Show less' : `Show ${items.length - QUEUE_MAX} more`}
            </button>
          ) : null}
          {snoozedItems.length > 0 ? (
            <button type="button" onClick={() => setShowSnoozed(v => !v)} style={{ ...footerLink, color: C.muted }}>
              {showSnoozed ? 'Hide snoozed' : `${snoozedItems.length} snoozed · Show`}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

const footerLink: React.CSSProperties = {
  font: '500 12px/1 Inter',
  color: C.purple,
  background: 'none',
  border: 0,
  padding: '6px 8px',
  cursor: 'pointer',
  fontVariantNumeric: 'tabular-nums',
}

const QUEUE_MAX = 10

/**
 * Overdue first (oldest first), then New (newest first), each under a small header;
 * the first ten rows show until the card is expanded.
 */
function QueueGroups({
  items,
  expanded,
  renderRow,
}: {
  items: QueueItem[]
  expanded: boolean
  renderRow: (item: QueueItem, isLast: boolean) => ReactNode
}) {
  const { overdue, fresh } = arrangeQueue(items)
  const limit = expanded ? Infinity : QUEUE_MAX
  const shownOverdue = overdue.slice(0, limit)
  const shownFresh = fresh.slice(0, Math.max(0, limit - shownOverdue.length))
  const header = (label: string, hint: string, tone: 'red' | 'muted') => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 16px 6px',
        borderTop: `1px solid ${C.hairline}`,
        background: tone === 'red' ? '#FFFBFA' : undefined,
      }}
    >
      <span style={{ font: '600 12px/16px Inter', color: tone === 'red' ? '#B91C1C' : C.muted }}>{label}</span>
      <span style={{ font: '400 11.5px/16px Inter', color: '#6B7080' }}>{hint}</span>
    </div>
  )
  return (
    <div>
      {shownOverdue.length > 0 && (
        <section aria-label="Overdue">
          {header('Overdue', 'Oldest first', 'red')}
          {shownOverdue.map((item, i) => renderRow(item, i === shownOverdue.length - 1))}
        </section>
      )}
      {shownFresh.length > 0 && (
        <section aria-label="New">
          {header('New', 'Newest first', 'muted')}
          {shownFresh.map((item, i) => renderRow(item, i === shownFresh.length - 1))}
        </section>
      )}
    </div>
  )
}

/** §6 loading: the page's footprint (greeting, queue, Today, Open jobs) before the workspace is known. */
function DashboardSkeleton() {
  const card = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 12 }
  return (
    <div style={{ background: C.pageBg, minHeight: '100%', padding: '24px 28px' }} aria-busy="true">
      <div style={{ marginBottom: 18 }}>
        <div className="gio-shimmer" style={{ width: 120, height: 11, borderRadius: 4 }} />
        <div className="gio-shimmer" style={{ width: 280, height: 26, borderRadius: 6, margin: '8px 0 10px' }} />
        <div className="gio-shimmer" style={{ width: 420, maxWidth: '100%', height: 13, borderRadius: 4 }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 14, alignItems: 'start' }}>
        <div style={card}>
          <div style={{ padding: '14px 16px' }}>
            <div className="gio-shimmer" style={{ width: 110, height: 14, borderRadius: 4 }} />
          </div>
          <QueueSkeleton />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="gio-shimmer" style={{ ...card, height: 220 }} />
          <div className="gio-shimmer" style={{ ...card, height: 160 }} />
        </div>
      </div>
    </div>
  )
}

/** §6 loading: shimmering rows laid out like QueueRow. */
function QueueSkeleton() {
  return (
    <div>
      {[0, 1, 2, 3].map(i => (
        <div
          key={i}
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            padding: '11px 12px 11px 16px',
            minHeight: 60,
            boxSizing: 'border-box',
            borderBottom: i === 3 ? 'none' : `1px solid ${C.hairline}`,
          }}
        >
          <div className="gio-shimmer" style={{ width: 28, height: 28, borderRadius: 8 }} />
          <div style={{ flex: 1 }}>
            <div className="gio-shimmer" style={{ width: '50%', height: 11, borderRadius: 4 }} />
            <div className="gio-shimmer" style={{ width: '35%', height: 9, borderRadius: 4, marginTop: 6 }} />
          </div>
          <div className="gio-shimmer" style={{ width: 60, height: 16, borderRadius: 999 }} />
          <div className="gio-shimmer" style={{ width: 92, height: 28, borderRadius: 8 }} />
          <div style={{ width: 28 }} />
        </div>
      ))}
    </div>
  )
}

function EmptyQueue({
  filter,
  totalAll,
  onClear,
}: {
  filter: 'all' | QueueType
  totalAll: number
  onClear: () => void
}) {
  const isFiltered = filter !== 'all' && totalAll > 0
  const filterLabel =
    filter === 'scorecard' ? 'scorecards'
    : filter === 'decision' ? 'decisions'
    : filter === 'reply' ? 'replies'
    : filter === 'application' ? 'applications'
    : 'tasks'
  return (
    <div style={{ padding: '16px' }}>
      {isFiltered ? (
        <EmptyState
          size="card"
          illustration={<SoftMagnifier />}
          title="No matches"
          body={`No ${filterLabel} need you right now. Clear the filter to see everything in your queue.`}
          primary={<EmptyAction onClick={onClear}>Clear filter</EmptyAction>}
        />
      ) : (
        <EmptyState
          size="card"
          illustration={<SoftPlane />}
          title="All clear"
          body="Nothing needs you right now — new scorecards, decisions, replies and applications will appear here."
        />
      )}
    </div>
  )
}

// ─── Today Card ──────────────────────────────────────────────────────

interface TodayCardProps {
  bookings: ScheduledBooking[]
  isLoading: boolean
  loadFailed?: boolean
  onRetry?: () => void
  nextEventId?: string
  freeAfter: string | null
  /** Left out for external users, who don't have the Calendar. */
  onFullCalendar?: () => void
  onRowClick: (b: ScheduledBooking) => void
}

function TodayCard({ bookings, isLoading, loadFailed, onRetry, nextEventId, freeAfter, onFullCalendar, onRowClick }: TodayCardProps) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12 }}>
      <div
        style={{
          padding: '14px 16px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <CalendarIcon size={14} strokeWidth={2} color={C.muted} />
        <span style={{ font: '600 13px/1 Poppins', color: C.ink }}>Today</span>
        <span
          style={{
            font: '600 11px/1 Inter',
            color: C.tertiary,
            background: C.hairline,
            padding: '3px 8px',
            borderRadius: 999,
          }}
        >
          {bookings.length}
        </span>
        {onFullCalendar && (
        <button
          onClick={onFullCalendar}
          style={{
            marginLeft: 'auto',
            font: '500 11.5px/1 Inter',
            color: C.purple,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: 0,
          }}
        >
          Full calendar <ArrowRight size={11} strokeWidth={2} />
        </button>
        )}
      </div>

      {isLoading ? (
        <div style={{ padding: '16px' }} aria-hidden="true">
          {[0, 1, 2].map(i => (
            <div key={i} className="gio-shimmer" style={{ height: 44, borderRadius: 6, marginBottom: 8 }} />
          ))}
        </div>
      ) : loadFailed ? (
        <div style={{ borderTop: `1px solid ${C.hairline}`, padding: '32px 20px' }}>
          <LoadError what="today's schedule" compact onRetry={onRetry} />
        </div>
      ) : bookings.length === 0 ? (
        <div style={{ borderTop: `1px solid ${C.hairline}`, padding: '28px 20px 32px' }}>
          <AnimatedEmpty
            scene="scheduling"
            size="compact"
            onceKey="dashboard-today"
            title="Nothing on today"
            body="Your schedule is clear. Newly booked interviews will show up here."
          />
        </div>
      ) : (
        bookings.map((b, idx) => {
          const isNext = b.id === nextEventId
          const start = new Date(b.scheduled_start)
          const timeLabel = format(start, 'HH:mm')
          const candidateName = b.candidate?.candidate_name || b.candidate_name || 'Unknown'
          const showJoin = isNext && isMeetingUrl(b.meeting_location)
          return (
            <div
              key={b.id}
              onClick={() => onRowClick(b)}
              style={{
                display: 'flex',
                gap: 12,
                padding: '10px 16px',
                borderTop: `1px solid ${C.hairline}`,
                cursor: 'pointer',
                alignItems: 'flex-start',
              }}
            >
              <div style={{ width: 42, textAlign: 'right', flexShrink: 0 }}>
                <div
                  style={{
                    font: '600 12.5px/1.2 Poppins',
                    color: isNext ? C.purple : C.ink,
                  }}
                >
                  {timeLabel}
                </div>
                <div style={{ font: '400 9.5px/1 Inter', color: C.disabled, marginTop: 2 }}>
                  {b.duration_minutes} min
                </div>
              </div>
              <div
                style={{
                  width: 3,
                  alignSelf: 'stretch',
                  borderRadius: 2,
                  background: isNext ? C.purple : C.border,
                  flexShrink: 0,
                  minHeight: 30,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    font: '600 12px/1.35 Inter',
                    color: C.ink2,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {candidateName}
                </div>
                <div
                  style={{
                    font: '400 11px/1.35 Inter',
                    color: C.tertiary,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    marginTop: 2,
                  }}
                >
                  {b.job?.title ?? (b.notes ? b.notes : '—')}
                </div>
                {showJoin && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      window.open(b.meeting_location!, '_blank')
                    }}
                    style={{
                      marginTop: 6,
                      height: 24,
                      padding: '0 10px',
                      borderRadius: 7,
                      background: C.purpleLight,
                      color: C.purpleText,
                      border: 'none',
                      font: '600 11px/1 Inter',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Video size={11} strokeWidth={2} /> Join
                  </button>
                )}
              </div>
            </div>
          )
        })
      )}

      {freeAfter && (
        <div
          style={{
            padding: '9px 16px',
            borderTop: `1px solid ${C.hairline}`,
            font: '400 11px/1.4 Inter',
            color: C.tertiary,
          }}
        >
          Free after {freeAfter} — good slot for scorecards.
        </div>
      )}
    </div>
  )
}

// ─── Open Jobs Card ──────────────────────────────────────────────────

interface OpenJobsCardProps {
  jobs: ReturnType<typeof useJobs>['jobs']
  metrics: ReturnType<typeof usePipelineJobMetrics>['data']
  stale: ReturnType<typeof useStaleCandidates>['data'] extends infer T ? (T extends undefined ? never : T) : never
  isLoading: boolean
  onPipeline: () => void
  onJobClick: (id: string) => void
  onCreateJob: () => void
}

function OpenJobsCard({ jobs, metrics, stale, isLoading, onPipeline, onJobClick, onCreateJob }: OpenJobsCardProps) {
  const list = jobs ?? []
  const metricsById = new Map((metrics ?? []).map(m => [m.job_id, m]))
  const stuckByJob = (stale ?? []).reduce<Record<string, number>>((acc, s) => {
    acc[s.jobId] = (acc[s.jobId] ?? 0) + 1
    return acc
  }, {})

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12 }}>
      <div
        style={{
          padding: '14px 16px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Briefcase size={14} strokeWidth={2} color={C.muted} />
        <span style={{ font: '600 13px/1 Poppins', color: C.ink }}>Open jobs</span>
        <span
          style={{
            font: '600 11px/1 Inter',
            color: C.tertiary,
            background: C.hairline,
            padding: '3px 8px',
            borderRadius: 999,
          }}
        >
          {list.length}
        </span>
        <button
          onClick={onPipeline}
          style={{
            marginLeft: 'auto',
            font: '500 11.5px/1 Inter',
            color: C.purple,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: 0,
          }}
        >
          Pipeline <ArrowRight size={11} strokeWidth={2} />
        </button>
      </div>

      {isLoading ? (
        // §6 loading: rows the size of an open-job row (dot, title, context line).
        <div aria-hidden="true">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              style={{ display: 'flex', gap: 10, padding: '8px 16px', alignItems: 'center', borderTop: `1px solid ${C.hairline}`, height: 50 }}
            >
              <span className="gio-shimmer" style={{ width: 7, height: 7, borderRadius: 999, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div className="gio-shimmer" style={{ width: '55%', height: 11, borderRadius: 4 }} />
                <div className="gio-shimmer" style={{ width: '30%', height: 9, borderRadius: 4, marginTop: 6 }} />
              </div>
            </div>
          ))}
        </div>
      ) : list.length === 0 ? (
        <div style={{ borderTop: `1px solid ${C.hairline}` }}>
          <EmptyState
            size="card"
            illustration={<SoftFlag />}
            title="No open jobs"
            body="Create a job to start tracking candidates and pipeline activity."
            primary={<EmptyAction onClick={onCreateJob}>Go to Jobs</EmptyAction>}
          />
        </div>
      ) : (
        list.map((j, idx) => {
          const m = metricsById.get(j.id)
          const active = m?.active_candidates ?? 0
          const stuckCount = stuckByJob[j.id] ?? 0
          const quietDays = daysSince(j.updated_at)
          const isQuiet = quietDays >= 6 && active === 0
          const dotColor = stuckCount > 0 ? '#D97706' : isQuiet ? C.disabled : C.green
          const topStage = (m?.stages ?? []).slice().sort((a, b) => b.count_in_stage - a.count_in_stage)[0]
          const contextParts: string[] = []
          if (topStage) contextParts.push(`most in ${topStage.stage_name}`)
          if (stuckCount > 0) contextParts.push(`${stuckCount} stuck`)
          else if (isQuiet) contextParts.push(`quiet ${quietDays}d`)
          return (
            <div
              key={j.id}
              onClick={() => onJobClick(j.id)}
              style={{
                display: 'flex',
                gap: 10,
                padding: '8px 16px',
                alignItems: 'center',
                borderTop: `1px solid ${C.hairline}`,
                cursor: 'pointer',
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 999,
                  background: dotColor,
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    font: '500 12px/1.35 Inter',
                    color: C.ink2,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {j.title}
                </div>
                <div
                  style={{
                    font: '400 10.5px/1.4 Inter',
                    color: C.tertiary,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    marginTop: 2,
                  }}
                >
                  {contextParts.join(' · ') || '—'}
                </div>
              </div>
              <span
                style={{
                  font: '600 13px/1 Poppins',
                  color: active === 0 ? C.disabled : C.ink,
                  flexShrink: 0,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {active}
              </span>
            </div>
          )
        })
      )}
    </div>
  )
}
